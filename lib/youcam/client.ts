import { loadYouCamEnv } from './env';
import {
  CreditResponse,
  FileInitResponse,
  TaskCreateResponse,
  TaskPollResponse,
  type Feature,
} from './types';

/**
 * The ONLY place YouCam API calls are made. The key stays server-side.
 * Implements the universal async flow (file → task → poll) plus the failure &
 * rate-limit contract from specs/architecture.md:
 *   - token-bucket limiter (≤5 QPS, ≤250 req / 300s — the documented ceiling)
 *   - retry with exponential backoff + jitter on 429 / 5xx / transient network
 *   - never retry a typed `task_status: error` (that would double-charge)
 *   - bounded polling with a max wall-clock (no infinite poll)
 */

export class YouCamError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus?: number,
    readonly raw?: unknown,
  ) {
    super(message);
    this.name = 'YouCamError';
  }
}

// ---- token-bucket rate limiter: ≤5 QPS AND ≤250 requests / 300s ----
class RateLimiter {
  private lastAt = 0;
  private readonly minGapMs = 200; // 5 QPS
  private readonly window: number[] = [];
  private readonly windowMs = 300_000;
  private readonly windowMax = 240; // stay just under the 250 ceiling

  async acquire(): Promise<void> {
    // rolling 300s window
    const now = Date.now();
    while (this.window.length && now - this.window[0] > this.windowMs) {
      this.window.shift();
    }
    if (this.window.length >= this.windowMax) {
      const wait = this.windowMs - (now - this.window[0]) + 10;
      await sleep(wait);
      return this.acquire();
    }
    // per-request min gap (5 QPS)
    const gap = Date.now() - this.lastAt;
    if (gap < this.minGapMs) await sleep(this.minGapMs - gap);
    this.lastAt = Date.now();
    this.window.push(this.lastAt);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ClientOptions {
  /** poll interval in ms (default 1500) */
  pollIntervalMs?: number;
  /** max wall-clock per task in ms before giving up (default 120000) */
  pollTimeoutMs?: number;
  /** max retry attempts on transient errors (default 3) */
  maxRetries?: number;
  /** log every HTTP call + poll tick */
  verbose?: boolean;
}

export class YouCamClient {
  private readonly limiter = new RateLimiter();
  private readonly host: string;
  private readonly apiKey: string;
  private readonly opts: Required<Omit<ClientOptions, 'verbose'>> & {
    verbose: boolean;
  };

  constructor(options: ClientOptions = {}) {
    const env = loadYouCamEnv();
    this.host = env.baseHost;
    this.apiKey = env.apiKey;
    this.opts = {
      pollIntervalMs: options.pollIntervalMs ?? 1500,
      pollTimeoutMs: options.pollTimeoutMs ?? 120_000,
      maxRetries: options.maxRetries ?? 3,
      verbose: options.verbose ?? false,
    };
  }

  private log(...args: unknown[]) {
    if (this.opts.verbose) console.log('[youcam]', ...args);
  }

  /** Authenticated fetch with retry/backoff on 429 / 5xx / network. */
  private async request(
    path: string,
    init: RequestInit & { auth?: boolean } = {},
  ): Promise<Response> {
    const { auth = true, ...rest } = init;
    const url = path.startsWith('http') ? path : `${this.host}${path}`;
    const headers = new Headers(rest.headers);
    if (auth) headers.set('Authorization', `Bearer ${this.apiKey}`);

    let attempt = 0;
    for (;;) {
      await this.limiter.acquire();
      let res: Response;
      try {
        this.log(rest.method ?? 'GET', url);
        res = await fetch(url, { ...rest, headers });
      } catch (err) {
        if (attempt++ >= this.opts.maxRetries) {
          throw new YouCamError(
            `network error after ${attempt} attempts: ${String(err)}`,
            'network',
          );
        }
        await sleep(backoff(attempt));
        continue;
      }
      if ((res.status === 429 || res.status >= 500) && attempt < this.opts.maxRetries) {
        attempt++;
        this.log(`retry ${attempt} after HTTP ${res.status}`);
        await sleep(backoff(attempt));
        continue;
      }
      return res;
    }
  }

  private async json<T>(res: Response): Promise<T> {
    const text = await res.text();
    if (!res.ok) {
      throw new YouCamError(
        `HTTP ${res.status}: ${text.slice(0, 300)}`,
        `http_${res.status}`,
        res.status,
        text,
      );
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new YouCamError(`non-JSON response: ${text.slice(0, 200)}`, 'bad_json');
    }
  }

  // ---- Unit balance ----
  async getCredit(): Promise<number> {
    const res = await this.request('/s2s/v1.0/client/credit');
    const data = CreditResponse.parse(await this.json(res));
    return data.results[0]?.amount_dec ?? 0;
  }

  // ---- File API: init upload + PUT bytes → file_id ----
  async uploadFile(
    bytes: Uint8Array | Buffer,
    contentType: string,
    fileName: string,
  ): Promise<string> {
    const initRes = await this.request('/s2s/v2.0/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [{ content_type: contentType, file_name: fileName, file_size: bytes.length }],
      }),
    });
    const init = FileInitResponse.parse(await this.json(initRes));
    const file = init.data.files[0];
    const put = file.requests?.[0];
    if (!put) throw new YouCamError('file init returned no presigned request', 'no_presigned');

    // PUT raw bytes to the presigned S3 URL (no auth header — the URL is signed).
    const putRes = await this.request(put.url, {
      method: put.method ?? 'PUT',
      auth: false,
      headers: put.headers ?? { 'Content-Type': contentType },
      body: bytes as unknown as BodyInit,
    });
    if (!putRes.ok) {
      throw new YouCamError(`S3 PUT failed HTTP ${putRes.status}`, 'put_failed', putRes.status);
    }
    return file.file_id;
  }

  // ---- Task: create → returns task_id ----
  async createTask(feature: Feature, body: Record<string, unknown>): Promise<string> {
    const res = await this.request(`/s2s/v2.0/task/${feature}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = TaskCreateResponse.parse(await this.json(res));
    const taskId = data.data.task_id;
    if (!taskId)
      throw new YouCamError('task create returned no task_id', 'no_task_id', undefined, data);
    return taskId;
  }

  // ---- Task: poll until success|error (bounded) → raw result object ----
  async pollTask(feature: Feature, taskId: string): Promise<Record<string, unknown>> {
    const deadline = Date.now() + this.opts.pollTimeoutMs;
    for (;;) {
      const res = await this.request(`/s2s/v2.0/task/${feature}/${taskId}`);
      const parsed = TaskPollResponse.parse(await this.json(res));
      const inner = parsed.data as Record<string, unknown>;
      const status = inner.task_status as string | undefined;

      if (status === 'success') return inner;
      if (status === 'error') {
        const code = (inner.error ?? 'task_error') as string;
        const detail = (inner.error_message as string) ?? '';
        throw new YouCamError(
          `task ${feature} failed: ${code}${detail ? ` (${detail})` : ''}`,
          String(code),
          undefined,
          inner,
        );
      }
      if (Date.now() > deadline) {
        throw new YouCamError(
          `task ${feature} timed out after ${this.opts.pollTimeoutMs}ms`,
          'poll_timeout',
        );
      }
      await sleep(this.opts.pollIntervalMs);
    }
  }

  /** Convenience: create a task and poll it to completion. */
  async runTask(feature: Feature, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const taskId = await this.createTask(feature, body);
    this.log(`task ${feature} → ${taskId}`);
    return this.pollTask(feature, taskId);
  }
}

function backoff(attempt: number): number {
  const base = Math.min(1000 * 2 ** (attempt - 1), 8000);
  return base + Math.random() * 250; // jitter
}

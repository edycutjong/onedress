import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Credentials never live inside this repo. In production (Vercel) they come from
 * real environment variables. For local dev / the spike / the bench, we fall back
 * to `~/.config/youcam/credentials.env` (chmod 600, outside the tree). Nothing here
 * ever writes a secret to disk under build/.
 */
export interface YouCamEnv {
  apiKey: string;
  baseHost: string;
}

let cached: YouCamEnv | null = null;

function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line
      .slice(0, eq)
      .trim()
      .replace(/^export\s+/, '');
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function loadYouCamEnv(): YouCamEnv {
  if (cached) return cached;

  let apiKey = process.env.YOUCAM_API_KEY;
  let baseHost = process.env.YOUCAM_BASE_HOST;

  if (!apiKey) {
    // Dev fallback: the credentials file outside the repo.
    try {
      const path = join(homedir(), '.config', 'youcam', 'credentials.env');
      const parsed = parseEnvFile(readFileSync(path, 'utf8'));
      apiKey = apiKey ?? parsed.YOUCAM_API_KEY;
      baseHost = baseHost ?? parsed.YOUCAM_BASE_HOST;
    } catch {
      // ignore — surfaced below
    }
  }

  if (!apiKey) {
    throw new Error(
      'YOUCAM_API_KEY not set. Provide it as an env var, or place ~/.config/youcam/credentials.env for local dev.',
    );
  }

  cached = {
    apiKey,
    baseHost: baseHost ?? 'https://yce-api-01.makeupar.com',
  };
  return cached;
}

import { getRun, subscribe } from '@/lib/pipeline/store';
import type { PartyRun, RunEvent } from '@/lib/pipeline/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/party/[id]/events — Server-Sent Events for one run.
 *
 * Why SSE and not polling: the render cascade is the moment the product is built
 * around (design.md §Cascade choreography). Each card must flip from skeleton to
 * render the instant THAT task lands — a 1s poll would quantise six independent
 * arrivals into visible steps and lose the stagger.
 *
 * Wire format: one `snapshot` event with the full run on connect, then a `patch`
 * event per stage transition carrying `{ event, run }`. The client applies both
 * through the same reducer, so a dropped connection recovers by reconnecting.
 */

const HEARTBEAT_MS = 15_000;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = getRun(id);

  if (!run) {
    return Response.json({ error: { code: 'run_not_found' } }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;

      const send = (event: string, data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          open = false;
        }
      };

      const close = () => {
        if (!open) return;
        open = false;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed by the client */
        }
      };

      // Full state first, so a late subscriber never misses what already happened.
      send('snapshot', run);

      const unsubscribe = subscribe(id, (event: RunEvent, current: PartyRun) => {
        send('patch', { event, run: current });
        if (current.status !== 'running') {
          send('end', { status: current.status });
          close();
        }
      });

      // Comment frames keep proxies from reaping an idle connection mid-render.
      const heartbeat = setInterval(() => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          close();
        }
      }, HEARTBEAT_MS);

      // A run that finished before the client connected: replay, then end.
      if (run.status !== 'running') {
        send('end', { status: run.status });
        close();
        return;
      }

      req.signal.addEventListener('abort', close);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Vercel's edge buffers by default; this opts the stream out.
      'X-Accel-Buffering': 'no',
    },
  });
}

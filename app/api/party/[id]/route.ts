import { getRun } from '@/lib/pipeline/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/party/[id] — the whole run object as it currently stands.
 *
 * This is the poll fallback for the SSE stream (and what the E2E tests assert
 * against). It is the same shape the SSE `snapshot` events carry, so the UI has one
 * reducer regardless of transport.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = getRun(id);

  if (!run) {
    return Response.json(
      {
        error: {
          code: 'run_not_found',
          title: 'Run not found',
          guidance:
            'Runs live in memory for the session only. Start a new party, or view the demo party.',
          recovery: 'config' as const,
        },
      },
      { status: 404 },
    );
  }

  return Response.json(run);
}

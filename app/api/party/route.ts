import { z } from 'zod';
import { getClient, notConfigured } from '@/lib/api/http';
import { fileSystemRefs } from '@/lib/pipeline/asset-refs';
import { runParty } from '@/lib/pipeline/run-party';
import { publish, putRun } from '@/lib/pipeline/store';
import { estimateUnits } from '@/lib/youcam/features';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** A 6-bridesmaid run is ~18 analyzer tasks + 7 renders + 6 earring chains. */
export const maxDuration = 300;

/**
 * POST /api/party — start a live run and return immediately with a run id.
 *
 * The flow takes minutes, not milliseconds, so this does NOT wait for it: the run
 * is registered in the in-memory store, work continues in the background, and the
 * browser follows along on /api/party/[id]/events (SSE) or /api/party/[id] (poll).
 * That is what lets the render cascade animate per card as each one lands, instead
 * of the whole screen blocking on one fat response.
 */

const Body = z.object({
  name: z.string().max(120).optional(),
  bridesmaids: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        name: z.string().max(120).optional(),
        faceFileId: z.string().min(1),
        bodyFileId: z.string().min(1),
      }),
    )
    .min(1, 'at least one bridesmaid is required')
    .max(12, 'the demo flow is scoped to at most 12 bridesmaids'),
});

export async function POST(req: Request) {
  const client = getClient();
  if (!client) return notConfigured();

  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return Response.json(
      { error: { code: 'bad_json', message: 'Body must be JSON.' } },
      { status: 400 },
    );
  }
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: 'invalid_body',
          message: parsed.error.issues[0]?.message ?? 'Invalid body.',
        },
      },
      { status: 400 },
    );
  }

  const { name, bridesmaids } = parsed.data;

  // Duplicate ids would collide in the run's state map and in the SSE event paths.
  const ids = new Set(bridesmaids.map((b) => b.id));
  if (ids.size !== bridesmaids.length) {
    return Response.json(
      { error: { code: 'duplicate_ids', message: 'Each bridesmaid needs a unique id.' } },
      { status: 400 },
    );
  }

  let runId: string | undefined;

  const started = runParty(
    bridesmaids,
    {
      api: client,
      refs: fileSystemRefs(client),
      onCreate: (run) => {
        runId = run.id;
        putRun(run);
      },
      emit: (run, event) => {
        putRun(run);
        publish(run, event);
      },
    },
    { name },
  );

  // Deliberately not awaited: the response returns as soon as the run is registered.
  // Failures are recorded on the run object itself, which the client is already
  // watching — there is no silent path here.
  started.catch(() => {
    /* terminal errors are already on run.error via runParty */
  });

  // onCreate fires synchronously inside runParty before its first await.
  if (!runId) {
    return Response.json(
      { error: { code: 'run_not_started', message: 'Could not start the run.' } },
      { status: 500 },
    );
  }

  return Response.json(
    {
      runId,
      estimatedUnits: estimateUnits(bridesmaids.length, { counterfactual: true }),
      events: `/api/party/${runId}/events`,
      snapshot: `/api/party/${runId}`,
    },
    { status: 202 },
  );
}

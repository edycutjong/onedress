'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PartyRun } from '@/lib/pipeline/types';
import type { UserFacingError } from '@/lib/youcam/errors';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chips';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { ScreenHeading, SectionHeading } from '@/components/ui/ScreenHeading';
import { DEMO_ESTIMATED_UNITS } from '@/lib/demo/demo-party';

/**
 * Create — six slots, two photos each, and the only screen that talks to the API on
 * the visitor's behalf.
 *
 * Everything here is real: the file inputs POST to `/api/upload`, the failures come
 * back as the mapped `UserFacingError` from lib/youcam/errors.ts (so "face the
 * camera" and "more light" are the API's own diagnosis, not our guess), and Start
 * the run POSTs `/api/party` and follows the SSE stream. On a deployment with no
 * key the upload answers 503 `not_configured` and this screen shows exactly that —
 * which is the honest state, and a better demonstration of the error surface than
 * any mock.
 */

const SLOT_COUNT = 6;
const SLOTS = Array.from({ length: SLOT_COUNT }, (_, i) => ({
  id: `b${i + 1}`,
  defaultName: `Bridesmaid ${i + 1}`,
}));

const SHOTS = [
  {
    key: 'face',
    label: 'Face selfie',
    guidance: 'Front-facing, eye level, even light. Face fills most of the frame.',
  },
  {
    key: 'body',
    label: 'Full-length photo',
    guidance: 'Standing, head to toe, arms clear of the body, filling ~80% of the frame.',
  },
] as const;

type ShotKey = (typeof SHOTS)[number]['key'];

type UploadState =
  | { kind: 'empty' }
  | { kind: 'uploading'; fileName: string }
  | { kind: 'done'; fileId: string; fileName: string }
  | { kind: 'failed'; error: UserFacingError };

type SlotState = { name: string; face: UploadState; body: UploadState };

const emptySlots = (): Record<string, SlotState> =>
  Object.fromEntries(
    SLOTS.map((s) => [s.id, { name: '', face: { kind: 'empty' }, body: { kind: 'empty' } }]),
  ) as Record<string, SlotState>;

const GENERIC_ERROR: UserFacingError = {
  code: 'upload_failed',
  title: 'Upload failed',
  guidance: 'The photo could not be sent. Check the connection and try again.',
  recovery: 'retry',
};

/** The route always answers with a `{ error: UserFacingError }` body; be defensive anyway. */
function readError(body: unknown): UserFacingError {
  const candidate = (body as { error?: Partial<UserFacingError> } | null)?.error;
  if (candidate?.title && candidate.guidance && candidate.code && candidate.recovery) {
    return candidate as UserFacingError;
  }
  return GENERIC_ERROR;
}

function ShotRow({
  slotId,
  shot,
  state,
  onPick,
}: {
  slotId: string;
  shot: (typeof SHOTS)[number];
  state: UploadState;
  onPick: (slotId: string, key: ShotKey, file: File) => void;
}) {
  const inputId = `${slotId}-${shot.key}`;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-8)] border border-dashed border-[var(--border-default)] px-3 py-2 transition-colors hover:border-[var(--winner)] focus-within:border-[var(--winner)]"
      >
        <span className="min-w-0">
          <span className="block text-xs font-medium text-text-hi">{shot.label}</span>
          <span className="block truncate text-[0.6875rem] leading-snug text-text-mid">
            {state.kind === 'done'
              ? state.fileName
              : state.kind === 'uploading'
                ? `Uploading ${state.fileName}…`
                : shot.guidance}
          </span>
        </span>
        <span aria-hidden="true" className="chip shrink-0">
          {state.kind === 'done' ? 'replace' : state.kind === 'uploading' ? '…' : 'choose'}
        </span>
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(slotId, shot.key, file);
          e.target.value = '';
        }}
      />
      {state.kind === 'uploading' ? (
        <span
          aria-hidden="true"
          className="shimmer mt-1.5 block h-1 w-full rounded-[var(--radius-full)] bg-white/10"
        />
      ) : null}
      {state.kind === 'done' ? (
        <p className="tabular mt-1.5 truncate font-mono text-[0.625rem] text-text-low">
          file_id {state.fileId}
        </p>
      ) : null}
      {state.kind === 'failed' ? <ErrorNote error={state.error} className="mt-2" /> : null}
    </div>
  );
}

export function CreateScreen({
  onParty,
  onGoToVerdict,
}: {
  onParty: (run: PartyRun) => void;
  onGoToVerdict: () => void;
}) {
  const [slots, setSlots] = useState<Record<string, SlotState>>(emptySlots);
  const [starting, setStarting] = useState(false);
  const [runError, setRunError] = useState<UserFacingError | null>(null);
  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => () => streamRef.current?.close(), []);

  const setShot = useCallback((slotId: string, key: ShotKey, next: UploadState) => {
    setSlots((prev) => ({ ...prev, [slotId]: { ...prev[slotId], [key]: next } }));
  }, []);

  const onPick = useCallback(
    async (slotId: string, key: ShotKey, file: File) => {
      setShot(slotId, key, { kind: 'uploading', fileName: file.name });
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: form });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setShot(slotId, key, { kind: 'failed', error: readError(body) });
          return;
        }
        setShot(slotId, key, {
          kind: 'done',
          fileId: (body as { fileId: string }).fileId,
          fileName: file.name,
        });
      } catch {
        setShot(slotId, key, { kind: 'failed', error: GENERIC_ERROR });
      }
    },
    [setShot],
  );

  const ready = SLOTS.map((s) => ({ slot: s, state: slots[s.id] })).filter(
    ({ state }) => state.face.kind === 'done' && state.body.kind === 'done',
  );

  const start = async () => {
    setStarting(true);
    setRunError(null);
    try {
      const res = await fetch('/api/party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bridesmaids: ready.map(({ slot, state }) => ({
            id: slot.id,
            name: state.name.trim() || slot.defaultName,
            faceFileId: (state.face as { fileId: string }).fileId,
            bodyFileId: (state.body as { fileId: string }).fileId,
          })),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setRunError(readError(body));
        return;
      }
      // Follow the run: the SSE stream emits the whole run object on connect and
      // again on every stage transition, so the same screens re-render unchanged.
      const { events } = body as { events: string };
      streamRef.current?.close();
      const stream = new EventSource(events);
      streamRef.current = stream;
      const apply = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as PartyRun | { run: PartyRun };
          onParty('run' in data ? data.run : data);
        } catch {
          /* a malformed frame must not take down the stream */
        }
      };
      stream.addEventListener('snapshot', apply);
      stream.addEventListener('patch', apply);
      stream.addEventListener('end', () => stream.close());
      stream.onerror = () => stream.close();
    } catch {
      setRunError(GENERIC_ERROR);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col gap-12">
      <ScreenHeading
        eyebrow="Create · six bridesmaids, two photos each"
        title="Start a party"
        lead={
          <>
            Two photos per person: a face selfie the three analyzers read, and a full-length
            standing shot the try-on renders onto. Nothing is uploaded until you choose a file, and
            no units are spent until you press start.
          </>
        }
        trailing={
          <button type="button" onClick={onGoToVerdict} className="btn">
            Skip to the cached demo party
          </button>
        }
      />

      <section aria-labelledby="guidance-heading">
        <SectionHeading
          id="guidance-heading"
          title="What makes a usable photo"
          note="These are the documented input rules. A photo that breaks them is rejected before it costs anything."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {SHOTS.map((shot) => (
            <Card key={shot.key}>
              <CardHeader
                eyebrow={shot.key === 'face' ? 'drives the scoring' : 'drives the render'}
                title={shot.label}
              />
              <CardBody className="pt-2">
                <p className="text-sm leading-relaxed text-text-mid">{shot.guidance}</p>
                <p className="mt-2 text-xs leading-relaxed text-text-low">
                  JPG, PNG or WebP · under 10 MB · short side at least 320 px. Screenshots and
                  thumbnails are rejected — use the original file.
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="slots-heading">
        <SectionHeading
          id="slots-heading"
          title="The party"
          note="Slots fill independently. A bridesmaid who cannot be measured drops out of the render, and the verdict still stands for everyone else."
          trailing={
            <Chip tone={ready.length > 0 ? 'ok' : 'default'}>
              <span className="tabular font-mono text-text-hi">{ready.length}</span>/{SLOT_COUNT}{' '}
              ready
            </Chip>
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SLOTS.map((slot, i) => {
            const state = slots[slot.id];
            const complete = state.face.kind === 'done' && state.body.kind === 'done';
            const failed = state.face.kind === 'failed' || state.body.kind === 'failed';
            return (
              <Card
                key={slot.id}
                tone={failed ? 'warning' : complete ? 'winner' : 'muted'}
                stagger={i}
              >
                <CardHeader
                  eyebrow={`slot ${i + 1}`}
                  title={
                    <label className="block">
                      <span className="sr-only">Name for bridesmaid {i + 1}</span>
                      <input
                        type="text"
                        value={state.name}
                        placeholder={slot.defaultName}
                        onChange={(e) =>
                          setSlots((prev) => ({
                            ...prev,
                            [slot.id]: { ...prev[slot.id], name: e.target.value },
                          }))
                        }
                        className="w-full bg-transparent font-display text-lg text-text-hi outline-none placeholder:text-text-low"
                      />
                    </label>
                  }
                />
                <CardBody className="flex flex-col gap-3 pt-2">
                  {SHOTS.map((shot) => (
                    <ShotRow
                      key={shot.key}
                      slotId={slot.id}
                      shot={shot}
                      state={state[shot.key]}
                      onPick={onPick}
                    />
                  ))}
                </CardBody>
                <CardFooter>
                  <Chip tone={complete ? 'ok' : 'default'}>
                    {complete ? 'ready' : failed ? 'needs another photo' : 'waiting for photos'}
                  </Chip>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="start-heading">
        <SectionHeading
          id="start-heading"
          title="Start the run"
          note="The pre-flight estimate comes from the published per-feature unit costs. The unit meter in the header shows the real balance."
        />
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-4 py-5">
            <p className="max-w-lg text-sm leading-relaxed text-text-mid">
              A full six-bridesmaid run is roughly{' '}
              <span className="tabular font-mono text-text-hi">{DEMO_ESTIMATED_UNITS}</span> units:
              18 analyzer calls, seven try-ons including the counterfactual, and six earring chains.
              Nothing is charged for an upload — units are spent on task success only.
            </p>
            <button
              type="button"
              onClick={start}
              disabled={ready.length === 0 || starting}
              className="btn btn--primary"
            >
              {starting
                ? 'Starting…'
                : `Start the run · ${ready.length} bridesmaid${ready.length === 1 ? '' : 's'}`}
            </button>
          </CardBody>
          {runError ? (
            <CardBody className="pt-0">
              <ErrorNote error={runError} />
            </CardBody>
          ) : null}
        </Card>
      </section>
    </div>
  );
}

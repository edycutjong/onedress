import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { displayPath } from './paths';
import { syntheticSubject } from './synth';

/**
 * Subject photos for a bench run: a face selfie (drives the three analyzers) and a
 * full-length standing shot (drives `cloth-v3`), per person.
 *
 * The pairs below come from the Phase-0 spike fixture set, which is **gitignored** —
 * they are throwaway stock images that never enter history. So a clone of this repo
 * has no subject photos, and the bench must say so clearly instead of dying on ENOENT.
 * A dry run therefore synthesises subjects and needs no fixtures at all.
 *
 * The first pair is the one the spike verified end to end (`face_body.jpg` is a tight
 * frontal crop of the same person as `body_c.jpg`) — same subject measured as is
 * rendered, which is the only pairing that makes the fidelity number mean anything.
 */

export interface SubjectPair {
  id: string;
  name: string;
  face: string;
  body: string;
}

export const SUBJECT_PAIRS: readonly SubjectPair[] = [
  { id: 'b1', name: 'Subject A', face: 'face_body.jpg', body: 'body_c.jpg' },
  { id: 'b2', name: 'Subject B', face: 'face_a.jpg', body: 'body_a.jpg' },
  { id: 'b3', name: 'Subject C', face: 'face_b.jpg', body: 'body_b.jpg' },
  { id: 'b4', name: 'Subject D', face: 'face_d.jpg', body: 'body_d.jpg' },
];

export interface LoadedSubject {
  id: string;
  name: string;
  faceBytes: Buffer;
  bodyBytes: Buffer;
}

export interface SubjectSet {
  subjects: LoadedSubject[];
  /** one line for the report */
  describe: string;
  synthetic: boolean;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export class MissingSubjectsError extends Error {
  constructor(
    readonly dir: string,
    readonly missing: string[],
  ) {
    super(
      `subject photos not found in ${displayPath(dir)}\n  missing: ${missing.join(', ')}\n` +
        '  These are the gitignored Phase-0 fixtures. Supply your own with --fixtures <dir>\n' +
        '  (expects the file names above), or run without --yes for the zero-cost dry run.',
    );
    this.name = 'MissingSubjectsError';
  }
}

/**
 * @param allowSynthetic dry-run only. NEVER true for a live run: spending real units
 *   analysing a generated image would produce a measurement of nothing.
 */
export async function loadSubjects(
  count: number,
  dir: string,
  allowSynthetic: boolean,
): Promise<SubjectSet> {
  if (count > SUBJECT_PAIRS.length) {
    throw new Error(
      `--subjects ${count} exceeds the ${SUBJECT_PAIRS.length} configured photo pairs`,
    );
  }
  const wanted = SUBJECT_PAIRS.slice(0, count);
  const missing: string[] = [];
  for (const pair of wanted) {
    if (!(await exists(join(dir, pair.face)))) missing.push(pair.face);
    if (!(await exists(join(dir, pair.body)))) missing.push(pair.body);
  }

  if (missing.length > 0) {
    if (!allowSynthetic) throw new MissingSubjectsError(dir, missing);
    return {
      synthetic: true,
      describe: `generated stand-ins (no fixtures in ${displayPath(dir)})`,
      subjects: await Promise.all(
        wanted.map(async (pair) => ({
          id: pair.id,
          name: pair.name,
          faceBytes: await syntheticSubject(`face:${pair.id}`),
          bodyBytes: await syntheticSubject(`body:${pair.id}`),
        })),
      ),
    };
  }

  return {
    synthetic: false,
    describe: `disk — ${displayPath(dir)}`,
    subjects: await Promise.all(
      wanted.map(async (pair) => ({
        id: pair.id,
        name: pair.name,
        faceBytes: await readFile(join(dir, pair.face)),
        bodyBytes: await readFile(join(dir, pair.body)),
      })),
    ),
  };
}

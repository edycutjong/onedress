import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { YouCamError } from '../youcam/client';
import type { TaskRunner } from '../youcam/features';
import type { Metal, Silhouette } from '../earring/selector';

/**
 * Reference images (the `ref_file_id` side of every render call) live on disk and
 * are uploaded ONCE per process, then reused by file_id.
 *
 * Why a cache and not an upload-per-render: a 6-bridesmaid run renders the same
 * winning dress six times. Re-uploading the same JPEG six times is six pointless
 * round-trips against a 5 QPS budget. Uploads themselves are free (units are charged
 * on task success, not on file upload) — this is a latency optimisation, not a cost one.
 *
 * Layout, both licensed for public-repo REDISTRIBUTION (spec.md §Exact scope):
 *   public/refs/colorways/<colorway-id>.jpg     — 24 garment product shots
 *   public/refs/earrings/<silhouette>-<metal>.jpg — 3 silhouettes × 2 metals
 */

const REF_ROOT = join(process.cwd(), 'public', 'refs');

/** colorwayId | "silhouette-metal" → file_id, for this process only. */
const uploadCache = new Map<string, Promise<string>>();

export interface RefResolver {
  colorway(colorwayId: string): Promise<string>;
  earring(silhouette: Silhouette, metal: Metal): Promise<string>;
}

async function uploadOnce(api: TaskRunner, key: string, path: string): Promise<string> {
  const existing = uploadCache.get(key);
  if (existing) return existing;

  const promise = (async () => {
    let bytes: Buffer;
    try {
      bytes = await readFile(path);
    } catch {
      // A missing reference is a setup problem, not a user problem — errors.ts maps
      // `missing_ref_asset` to a config-recovery card rather than a re-shoot prompt.
      throw new YouCamError(`reference image not installed: ${path}`, 'missing_ref_asset');
    }
    return api.uploadFile(bytes, 'image/jpeg', `${key}.jpg`);
  })();

  uploadCache.set(key, promise);
  // A failed upload must not poison the cache for the next attempt.
  promise.catch(() => uploadCache.delete(key));
  return promise;
}

/** Default resolver: reads from public/refs, uploads on first use. */
export function fileSystemRefs(api: TaskRunner): RefResolver {
  return {
    colorway: (colorwayId) =>
      uploadOnce(api, `colorway:${colorwayId}`, join(REF_ROOT, 'colorways', `${colorwayId}.jpg`)),
    earring: (silhouette, metal) =>
      uploadOnce(
        api,
        `earring:${silhouette}-${metal}`,
        join(REF_ROOT, 'earrings', `${silhouette}-${metal}.jpg`),
      ),
  };
}

/** Test/bench seam: resolve refs from an explicit map instead of the filesystem. */
export function staticRefs(map: Record<string, string>): RefResolver {
  const get = (key: string) => {
    const id = map[key];
    if (!id) throw new YouCamError(`no reference configured for ${key}`, 'missing_ref_asset');
    return Promise.resolve(id);
  };
  return {
    colorway: (colorwayId) => get(`colorway:${colorwayId}`),
    earring: (silhouette, metal) => get(`earring:${silhouette}-${metal}`),
  };
}

/** Drop cached uploads (used by the bench between cold-start measurements). */
export function resetRefCache(): void {
  uploadCache.clear();
}

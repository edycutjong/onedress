import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { RefResolver } from '../lib/pipeline/asset-refs';
import type { Metal, Silhouette } from '../lib/earring/selector';
import type { TaskRunner } from '../lib/youcam/features';
import { COLORWAYS } from '../lib/colorway/data';
import { YouCamError } from '../lib/youcam/client';
import { displayPath } from './paths';
import { syntheticGarment, syntheticPortrait } from './synth';

/**
 * Reference-garment resolution for the bench.
 *
 * `lib/pipeline/asset-refs.ts` already does exactly this — cache, upload once, reuse
 * by file_id — but it hardcodes its root to `<cwd>/public/refs`. The bench needs a
 * `--refs <dir>` override (the shipped reference set is generated separately and may
 * not be installed yet), so the caching/upload wrapper is repeated here over a
 * pluggable byte source. Nothing about HTTP or scoring is reimplemented: the upload
 * still goes through the injected `TaskRunner`, i.e. through `YouCamClient`.
 */

export interface RefSource {
  /** one line for the report, so a reader always knows where the pixels came from */
  describe(): string;
  /** true when these are the real shipped assets rather than a stand-in */
  authentic: boolean;
  colorway(colorwayId: string): Promise<Buffer>;
  earring(silhouette: Silhouette, metal: Metal): Promise<Buffer>;
}

async function isDir(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export interface RefsProbe {
  present: boolean;
  root: string;
  /** how many of the 24 colorway references are actually installed */
  colorwaysFound: number;
}

/** Look before you leap: report what is (and is not) installed under `root`. */
export async function probeRefs(root: string): Promise<RefsProbe> {
  const present = await isDir(join(root, 'colorways'));
  if (!present) return { present: false, root, colorwaysFound: 0 };
  const found = await Promise.all(
    COLORWAYS.map(async (c) => {
      try {
        await stat(join(root, 'colorways', `${c.id}.jpg`));
        return 1;
      } catch {
        return 0;
      }
    }),
  );
  return { present: true, root, colorwaysFound: found.reduce<number>((a, b) => a + b, 0) };
}

/** The real thing: `<root>/colorways/<id>.jpg` and `<root>/earrings/<sil>-<metal>.jpg`. */
export function diskRefSource(root: string): RefSource {
  const read = async (path: string): Promise<Buffer> => {
    try {
      return await readFile(path);
    } catch {
      throw new YouCamError(`reference image not installed: ${path}`, 'missing_ref_asset');
    }
  };
  return {
    authentic: true,
    describe: () => `disk — ${displayPath(root)}`,
    colorway: (id) => read(join(root, 'colorways', `${id}.jpg`)),
    earring: (silhouette, metal) => read(join(root, 'earrings', `${silhouette}-${metal}.jpg`)),
  };
}

/**
 * One real garment photo standing in for every colorway.
 *
 * This is the mode that makes a LIVE run possible before the shipped reference set
 * exists: `cloth-v3` is a generative try-on and behaves very differently on a real
 * product shot than on a flat generated swatch, so benchmarking latency and poll
 * counts against a synthetic garment would measure the wrong thing. With a real photo
 * the render path is the real render path.
 *
 * The catch is that the garment is then NOT the winning colorway's colour, so the
 * catalogue hex stops being the intended value. `--intended ref` exists for exactly
 * this case: it measures the render against the colour of the reference photo itself,
 * which is the same basis the Phase-0 spike used for its single ΔE sample.
 */
export function singleGarmentSource(garmentPath: string, earringPath?: string): RefSource {
  const read = async (path: string): Promise<Buffer> => {
    try {
      return await readFile(path);
    } catch {
      throw new YouCamError(`garment reference not readable: ${path}`, 'missing_ref_asset');
    }
  };
  return {
    authentic: false,
    describe: () =>
      `single garment photo — ${displayPath(garmentPath)}` +
      (earringPath ? ` · earring ${displayPath(earringPath)}` : ' · generated earrings'),
    colorway: () => read(garmentPath),
    earring: (silhouette, metal) =>
      earringPath
        ? read(earringPath)
        : syntheticPortrait(`${silhouette}-${metal}`, metal === 'gold' ? '#C9A227' : '#C0C6CC'),
  };
}

/**
 * Generated stand-ins, used when the shipped reference set is not installed. Flat
 * product shots in the exact catalogue hex. Perfectly fine for measuring call counts,
 * latency and cost; a ΔE measured against these is a measurement of a DIFFERENT
 * garment set than the shipped one, and the report labels it as such.
 */
export function syntheticRefSource(): RefSource {
  const hexOf = (id: string) => COLORWAYS.find((c) => c.id === id)?.hex ?? '#9CAF88';
  return {
    authentic: false,
    describe: () => 'generated stand-ins (no reference set installed)',
    colorway: (id) => syntheticGarment(hexOf(id)),
    earring: (silhouette, metal) =>
      syntheticPortrait(`${silhouette}-${metal}`, metal === 'gold' ? '#C9A227' : '#C0C6CC'),
  };
}

/**
 * Wrap a source in the upload-once cache `run-party.ts` expects. File names match the
 * ones `lib/pipeline/asset-refs.ts` uses (`colorway:<id>.jpg`), which is also how the
 * dry-run transport recovers which colour it is supposed to render.
 */
export function uploadingRefs(api: TaskRunner, source: RefSource): RefResolver {
  const cache = new Map<string, Promise<string>>();

  const once = (key: string, load: () => Promise<Buffer>): Promise<string> => {
    const existing = cache.get(key);
    if (existing) return existing;
    const promise = load().then((bytes) => api.uploadFile(bytes, 'image/jpeg', `${key}.jpg`));
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
    return promise;
  };

  return {
    colorway: (colorwayId) => once(`colorway:${colorwayId}`, () => source.colorway(colorwayId)),
    earring: (silhouette, metal) =>
      once(`earring:${silhouette}-${metal}`, () => source.earring(silhouette, metal)),
  };
}

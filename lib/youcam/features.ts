import { z } from 'zod';
import type { Feature } from './types';
import { YouCamError } from './client';

/**
 * Typed wrappers for the 5 load-bearing YouCam endpoints.
 *
 * Every request body and every result path below is COPIED FROM THE LIVE SPIKE
 * (`scripts/spike.ts` + `scripts/raw-*.json`, captured 2026-08-04), not from the
 * docs — where the two disagreed, live won:
 *   - `face-attr-analysis` takes the FLAT `{ features: [...] }` form (the OpenAPI
 *     nested payload is rejected with a 400 that names `features`).
 *   - `cloth-v3` returns `{ url }` and NO `dst_id`, so earring chaining goes
 *     through a re-upload of a head-crop (architecture.md's documented fallback).
 *   - `2d-vto/earring` needs the merged body: flat ids AND `source_info` AND
 *     `object_infos` (discovered via `scripts/probe-earring.ts`).
 *
 * Result URLs are S3 presigned with `X-Amz-Expires=7200` — TWO HOURS. Anything
 * that must outlive the request (the cached demo party) has to download the bytes.
 */

/** The subset of YouCamClient the feature layer needs — keeps this unit-testable. */
export interface TaskRunner {
  runTask(feature: Feature, body: Record<string, unknown>): Promise<Record<string, unknown>>;
  uploadFile(bytes: Uint8Array | Buffer, contentType: string, fileName: string): Promise<string>;
  getCredit(): Promise<number>;
}

/**
 * Measured unit costs per successful call (spec.md §Unit economics, read live from
 * `GET /s2s/v2.0/credit/feature-cost` on 2026-08-04). Used for the pre-flight cost
 * estimate and the unit meter — the authoritative number is always the live balance.
 */
export const FEATURE_COST: Record<Feature, number> = {
  'skin-tone-analysis': 20,
  'fitzpatrick-scale-analyzer': 10,
  'face-attr-analysis': 10, // 1–5 feature tier (we request exactly one: faceShape)
  'cloth-v3': 2,
  '2d-vto/earring': 1,
};

/** Cost of one full run: N bridesmaids measured + rendered + earringed, +1 counterfactual. */
export function estimateUnits(n: number, opts: { counterfactual?: boolean } = {}): number {
  const measure =
    n *
    (FEATURE_COST['skin-tone-analysis'] +
      FEATURE_COST['fitzpatrick-scale-analyzer'] +
      FEATURE_COST['face-attr-analysis']);
  const render = (n + (opts.counterfactual ? 1 : 0)) * FEATURE_COST['cloth-v3'];
  const earring = n * FEATURE_COST['2d-vto/earring'];
  return measure + render + earring;
}

// ---------------------------------------------------------------- schemas ----
// `client.runTask` returns the task's `data` object: { task_status, error, results }.

const FaceQuality = z
  .object({
    has_face: z.boolean().optional(),
    area: z.string().optional(),
    frontal: z.string().optional(),
    lighting: z.string().optional(),
    faceangle: z.string().optional(),
  })
  .passthrough();
export type FaceQuality = z.infer<typeof FaceQuality>;

const SkinToneTask = z
  .object({
    results: z
      .object({
        color: z.object({ skin_color: z.string() }).passthrough(),
        face_quality: FaceQuality.optional(),
      })
      .passthrough(),
  })
  .passthrough();

const FitzpatrickTask = z
  .object({
    results: z.object({ fitzpatrick_scale: z.string() }).passthrough(),
  })
  .passthrough();

// Live returns lowercase `faceshape`; the docs call it `faceShape`. Accept either.
const FaceAttrTask = z
  .object({
    results: z
      .object({
        faceshape: z.string().optional(),
        faceShape: z.string().optional(),
        face_quality: FaceQuality.optional(),
      })
      .passthrough(),
  })
  .passthrough();

const RenderTask = z
  .object({
    results: z.object({ url: z.string().url() }).passthrough(),
  })
  .passthrough();

/** Zod failure on a shape we depend on is a loud typed error, not a silent undefined. */
function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown, feature: Feature): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new YouCamError(
      `${feature}: unexpected result shape (${parsed.error.issues[0]?.path.join('.') || 'root'})`,
      'unexpected_shape',
      undefined,
      raw,
    );
  }
  return parsed.data;
}

// -------------------------------------------------------------- endpoints ----

export interface SkinTone {
  /** measured hex, e.g. "#bb9982" — the single most load-bearing value in the app */
  skinHex: string;
  faceQuality?: FaceQuality;
}

/** AI Facial Color Tones Analyzer — the engine's input. Face selfie only. */
export async function measureSkinTone(api: TaskRunner, faceFileId: string): Promise<SkinTone> {
  const raw = await api.runTask('skin-tone-analysis', {
    src_file_id: faceFileId,
    face_angle_strictness_level: 'flexible',
  });
  const { results } = parseOrThrow(SkinToneTask, raw, 'skin-tone-analysis');
  return { skinHex: results.color.skin_color, faceQuality: results.face_quality };
}

/** AI Fitzpatrick Skin Type — depth cross-check + the I–VI badge on the face card. */
export async function measureFitzpatrick(api: TaskRunner, faceFileId: string): Promise<string> {
  const raw = await api.runTask('fitzpatrick-scale-analyzer', {
    src_file_id: faceFileId,
    version: '1.0',
  });
  return parseOrThrow(FitzpatrickTask, raw, 'fitzpatrick-scale-analyzer').results.fitzpatrick_scale;
}

/** AI Face Attributes & Ratio Analyzer — ONE feature requested (keeps the 1–5 cost tier). */
export async function measureFaceShape(api: TaskRunner, faceFileId: string): Promise<string> {
  const raw = await api.runTask('face-attr-analysis', {
    src_file_id: faceFileId,
    features: ['faceShape'],
    face_angle_strictness_level: 'flexible',
  });
  const { results } = parseOrThrow(FaceAttrTask, raw, 'face-attr-analysis');
  const shape = results.faceshape ?? results.faceShape;
  if (!shape) {
    throw new YouCamError('face-attr-analysis: no faceShape in results', 'unexpected_shape');
  }
  return shape;
}

/** AI Clothes Virtual Try-On (cloth-v3) — full-length photo + garment reference. */
export async function renderCloth(
  api: TaskRunner,
  args: { bodyFileId: string; dressFileId: string },
): Promise<string> {
  const raw = await api.runTask('cloth-v3', {
    src_file_id: args.bodyFileId,
    ref_file_id: args.dressFileId,
    garment_category: 'full_body',
  });
  return parseOrThrow(RenderTask, raw, 'cloth-v3').results.url;
}

/**
 * Earring 2D-VTO, chained onto a cloth-v3 render.
 *
 * `srcFileId` must be a HEAD-CROP of the render (see lib/pipeline/head-crop.ts):
 * the engine needs visibly-sized, centered ears, and the full-body frame's ears are
 * too small. The merged body shape below is required — dropping either `source_info`
 * or the flat ids returns a 400.
 */
export async function renderEarring(
  api: TaskRunner,
  args: { headFileId: string; earringFileId: string },
): Promise<string> {
  const raw = await api.runTask('2d-vto/earring', {
    src_file_id: args.headFileId,
    ref_file_ids: [args.earringFileId],
    source_info: { name: args.headFileId },
    object_infos: [
      { name: args.earringFileId, parameter: { earring_need_remove_background: true } },
    ],
  });
  return parseOrThrow(RenderTask, raw, '2d-vto/earring').results.url;
}

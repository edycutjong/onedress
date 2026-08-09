import sharp from 'sharp';
import { YouCamError } from '../youcam/client';

/**
 * cloth-v3 returns no `dst_id`, so earring chaining goes through a re-upload
 * (architecture.md's documented fallback, confirmed by the Phase-0 spike). But the
 * earring engine also needs visibly-sized, centered ears — on a head-to-toe render
 * the ears are a few pixels wide and the task fails or lands nothing.
 *
 * So we re-upload a HEAD-CROP of the render rather than the render itself. Same
 * subject, same dress, ears at usable resolution. The crop window below is the one
 * verified live in scripts/spike.ts.
 */

/** Fractional crop window over the cloth-v3 output: horizontally centered, upper fifth. */
export const HEAD_WINDOW = { left: 0.36, top: 0.2, width: 0.28, height: 0.2 } as const;

/** Longest edge of the crop handed to the earring endpoint. */
const CROP_WIDTH = 600;

/** Download a render before its presigned URL expires (~2h from task completion). */
export async function fetchRender(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new YouCamError(
      `could not download render: HTTP ${res.status}`,
      'render_fetch_failed',
      res.status,
    );
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Crop the head out of a full-length render, clamped to the real image bounds so a
 * differently-proportioned render can never produce an out-of-range extract.
 */
export async function headCrop(rendered: Buffer): Promise<Buffer> {
  const meta = await sharp(rendered).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) {
    throw new YouCamError('render has no readable dimensions', 'bad_render_image');
  }

  const left = Math.min(Math.max(0, Math.round(HEAD_WINDOW.left * W)), W - 1);
  const top = Math.min(Math.max(0, Math.round(HEAD_WINDOW.top * H)), H - 1);
  const width = Math.max(1, Math.min(Math.round(HEAD_WINDOW.width * W), W - left));
  const height = Math.max(1, Math.min(Math.round(HEAD_WINDOW.height * H), H - top));

  return sharp(rendered)
    .extract({ left, top, width, height })
    .resize(CROP_WIDTH, null, { fit: 'inside', withoutEnlargement: false })
    .jpeg({ quality: 92 })
    .toBuffer();
}

/**
 * Average colour of a fractional region, as a hex string. Used by the bench to
 * measure render-fidelity ΔE (intended colorway hex vs what actually rendered).
 */
export async function sampleRegionHex(
  image: Buffer,
  region: { left: number; top: number; width: number; height: number },
): Promise<string> {
  const meta = await sharp(image).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) throw new YouCamError('image has no readable dimensions', 'bad_render_image');

  const px = await sharp(image)
    .extract({
      left: Math.min(Math.max(0, Math.round(region.left * W)), W - 1),
      top: Math.min(Math.max(0, Math.round(region.top * H)), H - 1),
      width: Math.max(1, Math.round(region.width * W)),
      height: Math.max(1, Math.round(region.height * H)),
    })
    .resize(1, 1, { fit: 'fill' })
    .raw()
    .toBuffer();

  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(px[0])}${hex(px[1])}${hex(px[2])}`;
}

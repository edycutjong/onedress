/**
 * Phase 0 — live SDK spike (specs/build-plan.md §Phase 0).
 * Proves the 5 load-bearing endpoints end-to-end against the LIVE YouCam API
 * BEFORE any UI, and resolves the two ASSUMED contracts from architecture.md:
 *   (1) cloth-v3 exposes a reusable dst_id for chaining
 *   (2) 2d-vto/earring accepts that dst_id and lands on the rendered image
 * Also measures cloth-v3 render-fidelity ΔE and the real unit cost per call.
 *
 * Test images are local fixtures (scripts/fixtures/, gitignored — throwaway
 * stock photos). The shipped demo uses properly-consented models.
 *
 *   npm run spike
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { YouCamClient, YouCamError } from '../lib/youcam/client';
import { hexToLab, rgbToHex, deltaE2000, ita, hueAngle } from '../lib/color/lab';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures');

const FIXTURES = {
  // Same person for face + body so the measured subject IS the rendered subject.
  // face_body.jpg is a tight frontal crop of body_c (face width >60%, dead-on).
  face: 'face_body.jpg', // analyzers: frontal, face fills frame
  body: 'body_c.jpg', // cloth-v3 person: standing, front-facing, plain bg
  dress: 'reddress_a.jpg', // cloth-v3 garment ref: saturated red
  earring: 'earring_c.jpg', // 2d-vto/earring ref: gold hoops
};

interface StepResult {
  name: string;
  ok: boolean;
  ms: number;
  detail?: unknown;
  error?: string;
}
const steps: StepResult[] = [];

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  const t0 = Date.now();
  try {
    const out = await fn();
    steps.push({ name, ok: true, ms: Date.now() - t0, detail: summarize(out) });
    console.log(`  ✅ ${name} (${Date.now() - t0}ms)`);
    return out;
  } catch (err) {
    const msg = err instanceof YouCamError ? `${err.code}: ${err.message}` : String(err);
    steps.push({ name, ok: false, ms: Date.now() - t0, error: msg });
    console.log(`  ❌ ${name} — ${msg}`);
    return null;
  }
}

function summarize(v: unknown): unknown {
  const s = JSON.stringify(v);
  if (!s) return v;
  return s.length > 600 ? `${s.slice(0, 600)}…(truncated)` : v;
}

/** Recursively find the first value whose key matches `keyRe`. */
function deepFind(obj: unknown, keyRe: RegExp): unknown {
  if (obj == null || typeof obj !== 'object') return undefined;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (keyRe.test(k) && (typeof v === 'string' || typeof v === 'number')) return v;
    const nested = deepFind(v, keyRe);
    if (nested !== undefined) return nested;
  }
  return undefined;
}
/** Find the first http(s) URL anywhere in the object. */
function deepFindUrl(obj: unknown): string | undefined {
  if (typeof obj === 'string') return /^https?:\/\//.test(obj) ? obj : undefined;
  if (obj == null || typeof obj !== 'object') return undefined;
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const u = deepFindUrl(v);
    if (u) return u;
  }
  return undefined;
}

function fixtureBytes(name: string): Buffer {
  return readFileSync(join(FIX, name));
}

/** Average color of a fractional region {l,t,w,h in 0..1} of an image buffer. */
async function avgColor(
  buf: Buffer,
  region: { l: number; t: number; w: number; h: number },
): Promise<{ r: number; g: number; b: number; hex: string }> {
  const meta = await sharp(buf).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  const px = await sharp(buf)
    .extract({
      left: Math.round(region.l * W),
      top: Math.round(region.t * H),
      width: Math.max(1, Math.round(region.w * W)),
      height: Math.max(1, Math.round(region.h * H)),
    })
    .resize(1, 1, { fit: 'fill' })
    .raw()
    .toBuffer();
  const [r, g, b] = [px[0], px[1], px[2]];
  return { r, g, b, hex: rgbToHex(r, g, b) };
}

async function main() {
  console.log('\n=== OneDress Phase 0 spike — live YouCam API ===\n');
  const client = new YouCamClient({ verbose: true, pollTimeoutMs: 180_000 });

  const creditBefore = await step('credit:before', () => client.getCredit());
  console.log(`  grant balance: ${creditBefore} units\n`);

  // --- Upload fixtures via the File API (proves the real upload path) ---
  console.log('— File API uploads —');
  const ids: Record<string, string> = {};
  for (const [key, file] of Object.entries(FIXTURES)) {
    const id = await step(`upload:${key}`, () =>
      client.uploadFile(fixtureBytes(file), 'image/jpeg', file),
    );
    if (id) ids[key] = id;
  }
  const haveUploads = Object.keys(ids).length === Object.keys(FIXTURES).length;
  // Fallback source: if File API failed, we still prove the endpoints via URL.
  const src = (key: keyof typeof FIXTURES) => (ids[key] ? { src_file_id: ids[key] } : {});
  if (!haveUploads) {
    console.log('  ⚠️  some uploads failed — analysis/render steps may be skipped\n');
  }

  // --- 1..3: the three measurement endpoints on the face ---
  console.log('\n— Skin AI measurement (face) —');
  const skin = await step('skin-tone-analysis', () =>
    client.runTask('skin-tone-analysis', {
      ...src('face'),
      face_angle_strictness_level: 'flexible',
    }),
  );
  const skinHex = skin ? (deepFind(skin, /^skin_color$/i) as string | undefined) : undefined;
  console.log(`  measured skin_color: ${skinHex ?? 'NOT FOUND — inspect raw'}`);
  if (skin) writeFileSync(join(HERE, 'raw-skin-tone.json'), JSON.stringify(skin, null, 2));

  const fitz = await step('fitzpatrick-scale-analyzer', () =>
    client.runTask('fitzpatrick-scale-analyzer', { ...src('face'), version: '1.0' }),
  );
  const fitzType = fitz
    ? (deepFind(fitz, /fitzpatrick|skin_type|type|scale/i) as string | number | undefined)
    : undefined;
  console.log(`  Fitzpatrick: ${fitzType ?? 'NOT FOUND — inspect raw'}`);
  if (fitz) writeFileSync(join(HERE, 'raw-fitzpatrick.json'), JSON.stringify(fitz, null, 2));

  // face-attr: nested payload shape (verified from OpenAPI). Request ONLY faceShape
  // (1 action, keeps cost in the 1–5 feature tier). dst_actions is the feature list.
  console.log('\n— Face attributes (faceShape only) —');
  // Live endpoint uses the FLAT form { src_file_id, features:[...] } (the OpenAPI
  // nested payload shape is rejected; the 400 explicitly asks for `features`).
  const faceAttr = ids['face']
    ? await step('face-attr-analysis', () =>
        client.runTask('face-attr-analysis', {
          ...src('face'),
          features: ['faceShape'],
          face_angle_strictness_level: 'flexible',
        }),
      )
    : null;
  const faceShape = faceAttr ? (deepFind(faceAttr, /faceshape|face_shape/i) as string) : undefined;
  console.log(`  faceShape: ${faceShape ?? 'NOT FOUND — inspect raw'}`);
  if (faceAttr) writeFileSync(join(HERE, 'raw-face-attr.json'), JSON.stringify(faceAttr, null, 2));

  // --- 4: cloth-v3 render + fidelity ΔE ---
  console.log('\n— Apparel VTO: cloth-v3 (red dress on person) —');
  const dressBytes = fixtureBytes(FIXTURES.dress);
  const intended = await avgColor(dressBytes, { l: 0.35, t: 0.3, w: 0.3, h: 0.25 });
  console.log(`  intended dress hex (sampled from ref): ${intended.hex}`);

  const cloth = await step('cloth-v3', () =>
    client.runTask('cloth-v3', {
      ...src('body'),
      ref_file_id: ids['dress'],
      garment_category: 'full_body',
    }),
  );
  const clothUrl = cloth ? deepFindUrl(cloth) : undefined;
  const dstId = cloth ? (deepFind(cloth, /^dst_id$/i) as string | undefined) : undefined;
  console.log(`  render url: ${clothUrl ? 'yes' : 'NONE'}`);
  // Per OpenAPI, cloth-v3's success payload is { url } only — no dst_id. So the
  // architecture.md re-upload fallback IS the chaining path (expected, not a failure).
  console.log(
    `  dst_id present: ${dstId ? `YES (${dstId})` : 'NO (documented) → re-upload fallback is the path'}`,
  );
  if (cloth) writeFileSync(join(HERE, 'raw-cloth-v3.json'), JSON.stringify(cloth, null, 2));

  let renderDeltaE: number | null = null;
  if (clothUrl) {
    await step('cloth-v3:fidelity-ΔE', async () => {
      const res = await fetch(clothUrl);
      const rendered = Buffer.from(await res.arrayBuffer());
      writeFileSync(join(FIX, 'out-cloth.jpg'), rendered);
      // torso patch (chest region, below neckline) — where the dress body renders
      const got = await avgColor(rendered, { l: 0.42, t: 0.45, w: 0.16, h: 0.12 });
      renderDeltaE = deltaE2000(hexToLab(intended.hex), hexToLab(got.hex));
      return { intended: intended.hex, rendered: got.hex, deltaE2000: round(renderDeltaE) };
    });
    console.log(`  render-fidelity ΔE00 ≈ ${renderDeltaE != null ? round(renderDeltaE) : '?'}`);
  }

  // --- 5: earring chained onto the cloth-v3 render ---
  // The 2d-vto endpoint uses { source_info:{name}, object_infos:[{name}] } where
  // `name` accepts a file_id OR a URL. Since cloth-v3 returns no dst_id, we chain
  // by passing the render URL straight in as the source — no re-upload needed.
  // The 2d-vto endpoint needs the merged body shape (flat ids + source_info +
  // object_infos) — verified via scripts/probe-earring.ts. The earring engine
  // also needs visibly-sized, centered ears, so we chain onto a head-crop of the
  // cloth render (not the tiny-eared full-body frame). Same subject, ears intact.
  console.log('\n— Jewelry VTO: 2d-vto/earring (chained onto render head-crop) —');
  let earringOk = false;
  let earringUrl: string | undefined;
  if (clothUrl && ids['earring']) {
    const earring = await step('2d-vto/earring', async () => {
      const rendered = readFileSync(join(FIX, 'out-cloth.jpg'));
      const meta = await sharp(rendered).metadata();
      const W = meta.width ?? 1024;
      const H = meta.height ?? 1536;
      const headCrop = await sharp(rendered)
        .extract({
          left: Math.round(0.36 * W),
          top: Math.round(0.2 * H),
          width: Math.round(0.28 * W),
          height: Math.round(0.2 * H),
        })
        .resize(600, null, { fit: 'inside' })
        .jpeg({ quality: 92 })
        .toBuffer();
      writeFileSync(join(FIX, 'cloth-head.jpg'), headCrop);
      const headFid = await client.uploadFile(headCrop, 'image/jpeg', 'cloth-head.jpg');
      return client.runTask('2d-vto/earring', {
        src_file_id: headFid,
        ref_file_ids: [ids['earring']],
        source_info: { name: headFid },
        object_infos: [
          { name: ids['earring'], parameter: { earring_need_remove_background: true } },
        ],
      });
    });
    earringOk = !!earring;
    earringUrl = earring ? deepFindUrl(earring) : undefined;
    if (earring) writeFileSync(join(HERE, 'raw-earring.json'), JSON.stringify(earring, null, 2));
    if (earringUrl) {
      const res = await fetch(earringUrl);
      writeFileSync(join(FIX, 'out-earring.jpg'), Buffer.from(await res.arrayBuffer()));
      console.log('  earring render saved → scripts/fixtures/out-earring.jpg');
    }
  }

  const creditAfter = await step('credit:after', () => client.getCredit());
  const spent = creditBefore != null && creditAfter != null ? creditBefore - creditAfter : null;

  // --- summary ---
  console.log('\n=== SPIKE SUMMARY ===');
  const gates = {
    'skin-tone → hex': !!skinHex,
    'fitzpatrick → type': fitzType != null,
    'face-attr → faceShape': !!faceShape,
    'cloth-v3 → render': !!clothUrl,
    'earring chained onto render (re-upload path)': earringOk,
  };
  console.log(
    `  (info) dst_id chaining available: ${dstId ? 'yes' : 'no — re-upload is the documented path'}`,
  );
  for (const [k, v] of Object.entries(gates)) console.log(`  ${v ? '✅' : '❌'} ${k}`);
  console.log(`\n  measured skin hex: ${skinHex ?? '—'}`);
  if (skinHex) {
    const lab = hexToLab(skinHex);
    console.log(`    → ITA° ${round(ita(lab))}, hue° ${round(hueAngle(lab))}`);
  }
  console.log(`  render-fidelity ΔE00: ${renderDeltaE != null ? round(renderDeltaE) : '—'}`);
  console.log(`  units spent this run: ${spent ?? '—'}`);
  console.log(`  balance: ${creditBefore} → ${creditAfter}`);

  writeFileSync(
    join(HERE, 'spike-results.json'),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        gates,
        skinHex,
        fitzType,
        faceShape,
        renderDeltaE,
        spent,
        steps,
      },
      null,
      2,
    ),
  );
  console.log('\n  raw responses + spike-results.json written to scripts/.');

  const critical = gates['cloth-v3 → render'] && gates['skin-tone → hex'];
  process.exit(critical ? 0 : 1);
}

const round = (n: number) => Math.round(n * 100) / 100;

main().catch((e) => {
  console.error('SPIKE FATAL:', e);
  process.exit(1);
});

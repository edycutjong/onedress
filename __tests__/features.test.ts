import { describe, expect, it } from 'vitest';
import type { Feature } from '@/lib/youcam/types';
import {
  estimateUnits,
  FEATURE_COST,
  measureFaceShape,
  measureFitzpatrick,
  measureSkinTone,
  renderCloth,
  renderEarring,
  type TaskRunner,
} from '@/lib/youcam/features';

/**
 * Response payloads below are VERBATIM from the live Phase-0 spike (2026-08-04,
 * scripts/raw-*.json — gitignored, so they are inlined here). These tests are the
 * regression guard on the two contracts that cost the most to discover:
 *   - face-attr-analysis takes the flat `features: [...]` form
 *   - 2d-vto/earring needs flat ids AND source_info AND object_infos
 * If someone "tidies" those request bodies, these fail before any units are burned.
 */

const SKIN_TONE_RESULT = {
  task_status: 'success',
  error: null,
  results: {
    color: {
      eye_color: '#705d44',
      eye_color_name: 'Amber',
      lip_color: '#d59687',
      eyebrow_color: '#a78b78',
      skin_color: '#bb9982',
      hair_color: '#FAF0BE',
      hair_color_name: 'Blonde',
    },
    face_quality: {
      has_face: true,
      area: 'good',
      frontal: 'good',
      lighting: 'good',
      faceangle: 'good',
    },
  },
};

const FITZPATRICK_RESULT = {
  task_status: 'success',
  error: null,
  results: { timed: 860, fitzpatrick_scale: 'II' },
};

const FACE_ATTR_RESULT = {
  task_status: 'success',
  error: null,
  results: {
    nose: {},
    face_quality: { has_face: true },
    cheekbone: {},
    faceshape: 'Heart',
    facialratio: {},
  },
};

const RENDER_RESULT = {
  task_status: 'success',
  error: null,
  results: {
    url: 'https://yce-us.s3-accelerate.amazonaws.com/ttl30/x/render.jpg?X-Amz-Expires=7200',
  },
};

function recorder(response: Record<string, unknown>) {
  const calls: Array<{ feature: Feature; body: Record<string, unknown> }> = [];
  const api: TaskRunner = {
    async runTask(feature, body) {
      calls.push({ feature, body });
      return response;
    },
    async uploadFile() {
      return 'file_x';
    },
    async getCredit() {
      return 1000;
    },
  };
  return { api, calls };
}

describe('measurement endpoints', () => {
  it('extracts the measured skin hex and face quality', async () => {
    const { api, calls } = recorder(SKIN_TONE_RESULT);
    const tone = await measureSkinTone(api, 'face_1');

    expect(tone.skinHex).toBe('#bb9982');
    expect(tone.faceQuality?.lighting).toBe('good');
    expect(calls[0].feature).toBe('skin-tone-analysis');
    expect(calls[0].body).toMatchObject({
      src_file_id: 'face_1',
      face_angle_strictness_level: 'flexible',
    });
  });

  it('extracts the Fitzpatrick roman numeral', async () => {
    const { api } = recorder(FITZPATRICK_RESULT);
    expect(await measureFitzpatrick(api, 'face_1')).toBe('II');
  });

  it('reads the lowercase `faceshape` the live API actually returns', async () => {
    const { api, calls } = recorder(FACE_ATTR_RESULT);
    expect(await measureFaceShape(api, 'face_1')).toBe('Heart');
    // The flat form — the OpenAPI nested payload is rejected with a 400.
    expect(calls[0].body.features).toEqual(['faceShape']);
  });

  it('also accepts the documented camelCase `faceShape`', async () => {
    const { api } = recorder({ task_status: 'success', results: { faceShape: 'Oval' } });
    expect(await measureFaceShape(api, 'face_1')).toBe('Oval');
  });

  it('throws a typed error when a load-bearing field is missing', async () => {
    const { api } = recorder({ task_status: 'success', results: { color: {} } });
    await expect(measureSkinTone(api, 'face_1')).rejects.toMatchObject({
      code: 'unexpected_shape',
    });
  });

  it('throws when face-attr returns neither `faceshape` nor `faceShape`', async () => {
    // Both spellings are optional in the schema, so a results object carrying only
    // face_quality parses fine — the missing shape has to be caught after parsing,
    // or the earring selector would silently receive undefined.
    const { api } = recorder({
      task_status: 'success',
      results: { face_quality: { has_face: true }, nose: {} },
    });
    await expect(measureFaceShape(api, 'face_1')).rejects.toMatchObject({
      code: 'unexpected_shape',
    });
  });

  it('names the offending field, and says `root` when the whole body is wrong', async () => {
    const nested = recorder({ task_status: 'success', results: { color: {} } });
    await expect(measureSkinTone(nested.api, 'face_1')).rejects.toThrow(
      /unexpected result shape \(results\.color\.skin_color\)/,
    );

    // A null/undefined body has no path to point at — the message must still be
    // readable rather than saying "shape ()".
    const rootless = recorder(null as unknown as Record<string, unknown>);
    await expect(measureSkinTone(rootless.api, 'face_1')).rejects.toThrow(
      /unexpected result shape \(root\)/,
    );
  });
});

describe('render endpoints', () => {
  it('sends the cloth-v3 body and returns the render url', async () => {
    const { api, calls } = recorder(RENDER_RESULT);
    const url = await renderCloth(api, { bodyFileId: 'body_1', dressFileId: 'dress_1' });

    expect(url).toContain('render.jpg');
    expect(calls[0].body).toEqual({
      src_file_id: 'body_1',
      ref_file_id: 'dress_1',
      garment_category: 'full_body',
    });
  });

  it('sends the merged earring body (flat ids + source_info + object_infos)', async () => {
    const { api, calls } = recorder(RENDER_RESULT);
    await renderEarring(api, { headFileId: 'head_1', earringFileId: 'ear_1' });

    const body = calls[0].body;
    expect(body.src_file_id).toBe('head_1');
    expect(body.ref_file_ids).toEqual(['ear_1']);
    expect(body.source_info).toEqual({ name: 'head_1' });
    expect(body.object_infos).toEqual([
      { name: 'ear_1', parameter: { earring_need_remove_background: true } },
    ]);
  });
});

describe('unit economics', () => {
  it('matches the costs measured live via feature-cost', () => {
    expect(FEATURE_COST['skin-tone-analysis']).toBe(20);
    expect(FEATURE_COST['cloth-v3']).toBe(2);
  });

  it('estimates ~260 units for a full 6-bridesmaid run', () => {
    // 6×(20+10+10) analysis + 7×2 render + 6×1 earring = 240 + 14 + 6
    expect(estimateUnits(6, { counterfactual: true })).toBe(260);
  });

  it('omits the counterfactual render by default', () => {
    // 6×(20+10+10) analysis + 6×2 render + 6×1 earring = 240 + 12 + 6
    expect(estimateUnits(6)).toBe(258);
    // …and the counterfactual costs exactly one extra cloth-v3 call.
    expect(estimateUnits(6, { counterfactual: true }) - estimateUnits(6)).toBe(
      FEATURE_COST['cloth-v3'],
    );
  });

  it('confirms analysis dominates the cost, not rendering', () => {
    const analysis =
      6 *
      (FEATURE_COST['skin-tone-analysis'] +
        FEATURE_COST['fitzpatrick-scale-analyzer'] +
        FEATURE_COST['face-attr-analysis']);
    expect(analysis / estimateUnits(6, { counterfactual: true })).toBeGreaterThan(0.9);
  });
});

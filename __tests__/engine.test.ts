import { describe, it, expect } from 'vitest';
import {
  scoreParty,
  deriveSkin,
  scorePair,
  WEIGHTS,
  type SkinProfile,
} from '../lib/colorway/engine';
import { COLORWAYS, type Colorway } from '../lib/colorway/data';
import { hexToLab } from '../lib/color/lab';

// A flagship-style party spanning the Fitzpatrick ramp (design-token skin tones),
// deliberately polarized in depth so the mean optimizer is tempted to sacrifice the
// deepest-skin member — exactly the harm the maximin objective removes.
const PARTY: SkinProfile[] = [
  { id: 'p1', name: 'Ada', skinHex: '#F3DCC9', fitzpatrick: 'I' },
  { id: 'p2', name: 'Bea', skinHex: '#E9BE9B', fitzpatrick: 'II' },
  { id: 'p3', name: 'Cara', skinHex: '#CE9268', fitzpatrick: 'III' },
  { id: 'p4', name: 'Dina', skinHex: '#9A6844', fitzpatrick: 'IV' },
  { id: 'p5', name: 'Efe', skinHex: '#6B4A34', fitzpatrick: 'V' },
  { id: 'p6', name: 'Fen', skinHex: '#4A2E20', fitzpatrick: 'VI' },
];

describe('colorway data', () => {
  it('has exactly 24 colorways with unique ids', () => {
    expect(COLORWAYS).toHaveLength(24);
    expect(new Set(COLORWAYS.map((c) => c.id)).size).toBe(24);
  });
});

describe('scorePair — term bounds & weighting', () => {
  it('every term and the flatter score stay within [0,100]', () => {
    const skin = deriveSkin('#bb9982');
    for (const c of COLORWAYS) {
      const t = scorePair(skin, hexToLab(c.hex));
      for (const v of [t.U, t.C, t.S, t.flatter]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
  it('flatter equals the documented weighted sum of U/C/S', () => {
    const skin = deriveSkin('#bb9982');
    const t = scorePair(skin, hexToLab('#9CAF88'));
    const expected = WEIGHTS.U * t.U + WEIGHTS.C * t.C + WEIGHTS.S * t.S;
    expect(t.flatter).toBeCloseTo(expected, 1);
  });
});

describe('scoreParty — invariants (the load-bearing guarantees)', () => {
  const result = scoreParty(PARTY);

  it('is deterministic', () => {
    const again = scoreParty(PARTY);
    expect(again.winner.colorway.id).toBe(result.winner.colorway.id);
    expect(again.byEye.colorway.id).toBe(result.byEye.colorway.id);
  });

  it('winner maximizes the minimum — no colorway has a higher groupScore', () => {
    const maxGroup = Math.max(...result.ranked.map((s) => s.groupScore));
    expect(result.winner.groupScore).toBe(maxGroup);
  });

  it('by-eye maximizes the mean — no colorway has a higher mean', () => {
    const maxMean = Math.max(...result.ranked.map((s) => s.mean));
    expect(result.byEye.mean).toBe(maxMean);
  });

  it('FAIRNESS: maximin protects the worst at least as well as the by-eye pick', () => {
    // This is the whole thesis: winner.groupScore >= byEye.groupScore, always.
    expect(result.winner.groupScore).toBeGreaterThanOrEqual(result.byEye.groupScore);
  });

  it('by-eye never beats maximin on the group mean is FALSE — by-eye wins the mean', () => {
    expect(result.byEye.mean).toBeGreaterThanOrEqual(result.winner.mean);
  });

  it('mostHurt is the lowest-scoring bridesmaid under the by-eye pick', () => {
    const minUnderByEye = Math.min(...result.byEye.perPerson.map((p) => p.flatter));
    expect(result.mostHurt.flatter).toBe(minUnderByEye);
  });

  it('ranked list is sorted by groupScore descending', () => {
    for (let i = 1; i < result.ranked.length; i++) {
      expect(result.ranked[i - 1].groupScore).toBeGreaterThanOrEqual(result.ranked[i].groupScore);
    }
  });

  it('ranks all 24 colorways', () => {
    expect(result.ranked).toHaveLength(24);
  });
});

describe('scoreParty — maximin vs mean can pick different colors', () => {
  it('diverges on the polarized flagship party (the counterfactual exists)', () => {
    const result = scoreParty(PARTY);
    // The demo party is engineered so the two objectives disagree — this is the
    // proof-you-can-see. If this ever fails, the party or weights changed.
    expect(result.differsFromByEye).toBe(true);
  });
});

describe('scoreParty — documented tie-breaks', () => {
  // Same hex under two ids: every tie-break key (groupScore, mean, variance) is
  // exactly equal, so the sort has to fall all the way through to the documented
  // last resort — "index ↑", i.e. the earlier colorway in the caller's list wins.
  // Without that final key the winner would depend on V8's sort stability, and the
  // engine's headline promise ("deterministic, never stochastic") would be false.
  const TIED: Colorway[] = [
    { id: 'sage-first', name: 'Sage First', family: 'neutral', hex: '#9CAF88' },
    { id: 'sage-second', name: 'Sage Second', family: 'neutral', hex: '#9CAF88' },
  ];

  it('breaks a total tie by list order, for both the fair and the by-eye pick', () => {
    const result = scoreParty(PARTY, TIED);

    expect(result.ranked[0].groupScore).toBe(result.ranked[1].groupScore);
    expect(result.ranked[0].mean).toBe(result.ranked[1].mean);
    expect(result.ranked[0].variance).toBe(result.ranked[1].variance);

    expect(result.winner.colorway.id).toBe('sage-first');
    expect(result.byEye.colorway.id).toBe('sage-first');
    expect(result.differsFromByEye).toBe(false);
  });

  it('gives the same answer when the tied pair is listed the other way round', () => {
    const flipped = scoreParty(PARTY, [TIED[1], TIED[0]]);
    expect(flipped.winner.colorway.id).toBe('sage-second');
  });
});

describe('scoreParty — edge cases', () => {
  it('throws on an empty party', () => {
    expect(() => scoreParty([])).toThrow();
  });
  it('single-person party: winner == by-eye (min == mean)', () => {
    const solo = scoreParty([{ id: 's', skinHex: '#CE9268' }]);
    expect(solo.differsFromByEye).toBe(false);
  });
});

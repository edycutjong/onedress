/**
 * Earring selector (specs/spec.md §Why earrings). Earrings sit adjacent to the face
 * where undertone reads strongest, so the choice is really a metal-tone color decision:
 *   - faceShape (from face-attr-analysis) → silhouette (stud / hoop / drop)
 *   - skin undertone (from the scoring engine, NOT face-attr) → metal (gold / silver)
 * warm → gold, cool → silver, neutral → gold (stated default; matches the 2-metal asset set).
 *
 * Silhouette rationale: balance the face's dominant line. Long/angular faces soften with
 * rounded studs/hoops; round/soft faces lengthen with drops; balanced ovals take any, so
 * we default them to the versatile hoop.
 */
export type Silhouette = 'stud' | 'hoop' | 'drop';
export type Metal = 'gold' | 'silver';

// face-attr-analysis faceShape enum → silhouette (all 8 documented shapes covered).
const SILHOUETTE_BY_SHAPE: Record<string, Silhouette> = {
  Oval: 'hoop', // balanced — versatile default
  Round: 'drop', // lengthen
  Square: 'hoop', // soften the jaw with a curve
  Oblong: 'stud', // avoid adding length
  Heart: 'drop', // widen the narrower chin line
  Diamond: 'stud', // balance wide cheekbones
  Triangle: 'drop', // draw the eye up
  InvTriangle: 'stud', // avoid widening an already-wide upper face
};

export interface EarringChoice {
  silhouette: Silhouette;
  metal: Metal;
}

/**
 * @param faceShape one of the face-attr-analysis faceShape values
 * @param warmth    skin warmth on [−1,1] from the scoring engine (deriveSkin().warmth)
 */
export function selectEarring(faceShape: string | undefined, warmth: number): EarringChoice {
  const silhouette = (faceShape && SILHOUETTE_BY_SHAPE[faceShape]) || 'hoop';
  // warm → gold, cool → silver, neutral (|warmth| small) → gold default.
  const metal: Metal = warmth < -0.15 ? 'silver' : 'gold';
  return { silhouette, metal };
}

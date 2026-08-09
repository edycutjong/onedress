import { describe, it, expect } from 'vitest';
import { selectEarring } from '../lib/earring/selector';

describe('selectEarring', () => {
  it('maps every documented faceShape to a silhouette', () => {
    const shapes = [
      'Oval',
      'Round',
      'Square',
      'Oblong',
      'Heart',
      'Diamond',
      'Triangle',
      'InvTriangle',
    ];
    for (const s of shapes) {
      const { silhouette } = selectEarring(s, 0);
      expect(['stud', 'hoop', 'drop']).toContain(silhouette);
    }
  });

  it('defaults unknown/missing faceShape to a hoop', () => {
    expect(selectEarring(undefined, 0).silhouette).toBe('hoop');
    expect(selectEarring('Nonsense', 0).silhouette).toBe('hoop');
  });

  it('picks metal by undertone: warm→gold, cool→silver, neutral→gold', () => {
    expect(selectEarring('Oval', 0.8).metal).toBe('gold'); // warm
    expect(selectEarring('Oval', -0.8).metal).toBe('silver'); // cool
    expect(selectEarring('Oval', 0).metal).toBe('gold'); // neutral default
  });
});

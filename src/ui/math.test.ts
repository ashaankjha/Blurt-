import * as fc from 'fast-check';

import { GRAVITY, makeParticles, particleAt, seededRng } from './confettiMath';
import { fromFraction, moveThumb, nearestThumb, snap, stepValue, toFraction } from './rangeMath';

describe('rangeMath', () => {
  it('snaps to step and clamps', () => {
    expect(snap(47, 20, 120, 5)).toBe(45);
    expect(snap(48, 20, 120, 5)).toBe(50);
    expect(snap(500, 20, 120, 5)).toBe(120);
    expect(snap(0.30000000000000004, 0, 1, 0.1)).toBe(0.3);
  });

  it('steps and clamps', () => {
    expect(stepValue(7, 1, 3, 15)).toBe(8);
    expect(stepValue(15, 1, 3, 15)).toBe(15);
    expect(stepValue(3, -1, 3, 15)).toBe(3);
    expect(stepValue(0.2, 0.1, 0, 1)).toBe(0.3);
  });

  it('maps fractions both ways', () => {
    expect(toFraction(70, 20, 120)).toBeCloseTo(0.5);
    expect(fromFraction(0.5, 20, 120, 5)).toBe(70);
    expect(toFraction(5, 5, 5)).toBe(0);
  });

  it('picks the nearest thumb', () => {
    expect(nearestThumb(40, 45, 75)).toBe('low');
    expect(nearestThumb(80, 45, 75)).toBe('high');
    expect(nearestThumb(50, 60, 60)).toBe('low');
    expect(nearestThumb(70, 60, 60)).toBe('high');
  });

  it('property: thumbs never cross and stay in range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        fc.constantFrom<'low' | 'high'>('low', 'high'),
        fc.integer({ min: -50, max: 200 }),
        (a, b, thumb, v) => {
          const min = 20;
          const max = 120;
          const low = min + Math.min(a, b) * 5;
          const high = min + Math.max(a, b) * 5;
          const [nl, nh] = moveThumb(thumb, v, low, high, min, max, 5);
          expect(nl).toBeLessThanOrEqual(nh);
          expect(nl).toBeGreaterThanOrEqual(min);
          expect(nh).toBeLessThanOrEqual(max);
          if (thumb === 'low') expect(nh).toBe(high);
          else expect(nl).toBe(low);
        },
      ),
    );
  });
});

describe('confettiMath', () => {
  it('is deterministic with a seed and uses the palette', () => {
    const a = makeParticles(10, 300, 600, ['#111111', '#222222'], seededRng(1));
    const b = makeParticles(10, 300, 600, ['#111111', '#222222'], seededRng(1));
    expect(a).toEqual(b);
    expect(a).toHaveLength(10);
    expect(new Set(a.map((p) => p.color))).toEqual(new Set(['#111111', '#222222']));
  });

  it('bursts upward then falls past the bottom by the end', () => {
    const height = 600;
    const ps = makeParticles(40, 300, height, ['#fff'], seededRng(7));
    for (const p of ps) {
      expect(p.vy).toBeLessThan(0);
      expect(particleAt(p, 1.8, height).y).toBeGreaterThan(height);
    }
    expect(GRAVITY).toBeGreaterThan(0);
  });

  it('seededRng stays in [0, 1)', () => {
    const r = seededRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

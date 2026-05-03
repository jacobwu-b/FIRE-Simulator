import { describe, it, expect } from 'vitest';
import { mulberry32, deriveSeed } from './prng';

describe('mulberry32', () => {
  it('produces identical sequence for identical seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('diverges within the first 10 draws for different seeds', () => {
    const a = mulberry32(42);
    const b = mulberry32(43);
    const drawsA = Array.from({ length: 10 }, () => a());
    const drawsB = Array.from({ length: 10 }, () => b());
    expect(drawsA).not.toEqual(drawsB);
  });

  it('returns values in [0, 1)', () => {
    const rng = mulberry32(99999);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces approximately uniform output over large N', () => {
    const rng = mulberry32(777);
    const buckets = new Array<number>(10).fill(0);
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      const bucket = Math.floor(rng() * 10);
      buckets[bucket]++;
    }
    const expected = n / 10;
    const tolerance = expected * 0.05;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(expected - tolerance);
      expect(count).toBeLessThan(expected + tolerance);
    }
  });
});

describe('deriveSeed', () => {
  it('produces the same child seed for the same master + index', () => {
    expect(deriveSeed(1000, 5)).toBe(deriveSeed(1000, 5));
  });

  it('produces different child seeds for different indices', () => {
    const seeds = new Set<number>();
    for (let i = 0; i < 100; i++) {
      seeds.add(deriveSeed(1000, i));
    }
    expect(seeds.size).toBe(100);
  });

  it('produces different child seeds for different master seeds', () => {
    expect(deriveSeed(1, 0)).not.toBe(deriveSeed(2, 0));
  });
});

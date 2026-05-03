import { describe, it, expect } from 'vitest';
import { buildBins, unionDomain } from './histogram';

describe('buildBins', () => {
  it('returns empty array for empty input', () => {
    expect(buildBins([])).toEqual([]);
  });

  it('returns one bin for a single value', () => {
    const bins = buildBins([42]);
    expect(bins).toHaveLength(1);
    expect(bins[0].x0).toBe(42);
    expect(bins[0].x1).toBe(42);
    expect(bins[0].count).toBe(1);
    expect(bins[0].pct).toBe(1);
  });

  it('returns one bin when all values are identical', () => {
    const bins = buildBins([5, 5, 5]);
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(3);
    expect(bins[0].pct).toBe(1);
  });

  it('produces the requested number of bins', () => {
    const values = Array.from({ length: 100 }, (_, i) => i);
    expect(buildBins(values, { binCount: 10 })).toHaveLength(10);
    expect(buildBins(values, { binCount: 5 })).toHaveLength(5);
  });

  it('counts are non-negative and sum to total values count', () => {
    const values = [1, 2, 3, 8, 9, 10, 15, 20];
    const bins = buildBins(values, { binCount: 4 });
    const total = bins.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(values.length);
    for (const bin of bins) {
      expect(bin.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('pct for each bin equals count / total', () => {
    const values = [10, 20, 30, 40, 50];
    const bins = buildBins(values, { binCount: 5 });
    const total = values.length;
    for (const bin of bins) {
      expect(bin.pct).toBeCloseTo(bin.count / total, 10);
    }
  });

  it('pct values sum to 1', () => {
    const values = Array.from({ length: 200 }, (_, i) => i * 0.5);
    const bins = buildBins(values, { binCount: 10 });
    const totalPct = bins.reduce((s, b) => s + b.pct, 0);
    expect(totalPct).toBeCloseTo(1, 10);
  });

  it('places a value equal to domainMax into the last bin', () => {
    const values = [0, 5, 10];
    const bins = buildBins(values, { binCount: 2 });
    const lastBin = bins[bins.length - 1];
    expect(lastBin.count).toBeGreaterThanOrEqual(1);
  });

  it('respects domainMin and domainMax overrides for shared-axis use', () => {
    const bins = buildBins([50, 60, 70], { binCount: 10, domainMin: 0, domainMax: 100 });
    expect(bins).toHaveLength(10);
    expect(bins[0].x0).toBe(0);
    expect(bins[bins.length - 1].x1).toBeCloseTo(100, 5);
    const total = bins.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(3);
  });

  it('values outside [domainMin, domainMax] are excluded when domain is overridden', () => {
    const bins = buildBins([10, 50, 90], { binCount: 4, domainMin: 20, domainMax: 80 });
    const total = bins.reduce((s, b) => s + b.count, 0);
    // 10 and 90 are outside the imposed domain
    expect(total).toBe(1);
  });

  it('throws RangeError when binCount < 1', () => {
    expect(() => buildBins([1, 2, 3], { binCount: 0 })).toThrow(RangeError);
  });

  it('bin boundaries are contiguous (x1[i] === x0[i+1])', () => {
    const values = Array.from({ length: 50 }, (_, i) => i * 2);
    const bins = buildBins(values, { binCount: 10 });
    for (let i = 0; i < bins.length - 1; i++) {
      expect(bins[i].x1).toBeCloseTo(bins[i + 1].x0, 10);
    }
  });
});

describe('unionDomain', () => {
  it('returns [0, 0] for empty input', () => {
    expect(unionDomain([])).toEqual([0, 0]);
  });

  it('returns [0, 0] for arrays containing no values', () => {
    expect(unionDomain([[], []])).toEqual([0, 0]);
  });

  it('returns the min and max across all arrays', () => {
    const [min, max] = unionDomain([[10, 20], [5, 15], [30, 8]]);
    expect(min).toBe(5);
    expect(max).toBe(30);
  });

  it('handles a single array', () => {
    expect(unionDomain([[3, 1, 4, 1, 5, 9]])).toEqual([1, 9]);
  });

  it('handles negative values', () => {
    const [min, max] = unionDomain([[-100, 0], [50, -200]]);
    expect(min).toBe(-200);
    expect(max).toBe(50);
  });
});

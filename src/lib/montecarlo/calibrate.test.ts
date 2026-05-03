import { describe, it, expect } from 'vitest';
import { calibrateFromHistorical } from './calibrate';
import type { MarketDataset } from '../data/types';

function makeDataset(
  us: number[],
  intl: number[],
  cpi: number[],
): MarketDataset {
  return {
    usEquity: us.map((v, i) => ({ date: `2000-${String(i + 1).padStart(2, '0')}`, value: v })),
    intlEquity: intl.map((v, i) => ({ date: `2000-${String(i + 1).padStart(2, '0')}`, value: v })),
    cpi: cpi.map((v, i) => ({ date: `2000-${String(i + 1).padStart(2, '0')}`, value: v })),
    startDate: '2000-01',
    endDate: '2000-01',
  };
}

describe('calibrateFromHistorical', () => {
  it('recovers exact mean for a constant series', () => {
    const ds = makeDataset(
      Array(120).fill(0.007),
      Array(120).fill(0.005),
      Array(120).fill(0.003),
    );
    const cal = calibrateFromHistorical(ds);
    expect(cal.usMean).toBeCloseTo(0.007, 10);
    expect(cal.intlMean).toBeCloseTo(0.005, 10);
    expect(cal.inflationMean).toBeCloseTo(0.003, 10);
  });

  it('recovers near-zero vol for a constant series', () => {
    const ds = makeDataset(
      Array(120).fill(0.007),
      Array(120).fill(0.005),
      Array(120).fill(0.003),
    );
    const cal = calibrateFromHistorical(ds);
    expect(cal.usVol).toBeCloseTo(0, 10);
    expect(cal.intlVol).toBeCloseTo(0, 10);
    expect(cal.inflationVol).toBeCloseTo(0, 10);
  });

  it('recovers approximate mean and vol for a known synthetic series', () => {
    // Build a series with known mean ~0.008 and known stddev ~0.04
    // using a deterministic sequence: alternating 0.048 and -0.032
    // mean = (0.048 + (-0.032)) / 2 = 0.008
    // var = ((0.048 - 0.008)^2 + (-0.032 - 0.008)^2) / 2 = (0.0016 + 0.0016)/2 = 0.0016
    // std = 0.04
    const n = 1200;
    const us = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 0.048 : -0.032));
    const intl = Array.from({ length: n }, () => 0.005);
    const cpi = Array.from({ length: n }, () => 0.003);
    const cal = calibrateFromHistorical(makeDataset(us, intl, cpi));
    expect(cal.usMean).toBeCloseTo(0.008, 5);
    expect(cal.usVol).toBeCloseTo(0.04, 5);
  });

  it('uses default expectedBlockLength of 36', () => {
    const ds = makeDataset(Array(60).fill(0.01), Array(60).fill(0.01), Array(60).fill(0.003));
    const cal = calibrateFromHistorical(ds);
    expect(cal.blockConfig.expectedBlockLength).toBe(36);
  });

  it('accepts a custom expectedBlockLength', () => {
    const ds = makeDataset(Array(60).fill(0.01), Array(60).fill(0.01), Array(60).fill(0.003));
    const cal = calibrateFromHistorical(ds, { expectedBlockLength: 24 });
    expect(cal.blockConfig.expectedBlockLength).toBe(24);
  });

  it('throws on empty dataset', () => {
    const ds = makeDataset([], [], []);
    expect(() => calibrateFromHistorical(ds)).toThrow('empty');
  });

  it('throws when series lengths do not match', () => {
    const ds = makeDataset(
      Array(60).fill(0.01),
      Array(50).fill(0.01),
      Array(60).fill(0.003),
    );
    expect(() => calibrateFromHistorical(ds)).toThrow('lengths do not match');
  });
});

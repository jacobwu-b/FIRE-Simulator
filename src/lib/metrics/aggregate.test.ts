import { describe, it, expect } from 'vitest';
import { aggregate } from './aggregate';
import type { Trajectory } from '../simulation/types';

/** Builds a minimal Trajectory with 1-year horizon (12 months). */
function makeTrajectory(opts: {
  realBalance: number[];
  realWithdrawal?: number[];
  survived: boolean;
  depletionMonth?: number;
}): Trajectory {
  const months = opts.realBalance.length;
  return {
    nominalBalance: opts.realBalance.slice(),
    realBalance: opts.realBalance,
    cumulativeInflation: Array(months).fill(1),
    nominalWithdrawal: opts.realWithdrawal ?? [],
    realWithdrawal: opts.realWithdrawal ?? [],
    survived: opts.survived,
    depletionMonth: opts.depletionMonth,
  };
}

/** Constant real balance across all months; a trivially surviving trajectory. */
function flatTrajectory(balance: number, months = 12, annualWithdrawal = 0): Trajectory {
  return makeTrajectory({
    realBalance: Array(months).fill(balance),
    realWithdrawal: Array(Math.floor(months / 12)).fill(annualWithdrawal),
    survived: true,
  });
}

describe('aggregate – empty input', () => {
  it('returns zeroed metrics when trajectory array is empty', () => {
    const result = aggregate([]);
    expect(result.trajectoryCount).toBe(0);
    expect(result.survivalRate).toBe(0);
    expect(result.endingRealValue.mean).toBe(0);
    expect(result.endingRealValue.median).toBe(0);
    expect(result.realWithdrawal.mean).toBe(0);
    expect(result.failureYearDistribution).toEqual({});
    expect(result.meanMaxDrawdown).toBe(0);
  });
});

describe('aggregate – survival rate', () => {
  it('reports 1 when all trajectories survive', () => {
    const t1 = flatTrajectory(1_000_000);
    const t2 = flatTrajectory(800_000);
    const result = aggregate([t1, t2]);
    expect(result.survivalRate).toBe(1);
    expect(result.trajectoryCount).toBe(2);
  });

  it('reports 0 when no trajectories survive', () => {
    const failed = makeTrajectory({
      realBalance: [1_000_000, 500_000, 0, 0],
      survived: false,
      depletionMonth: 2,
    });
    const result = aggregate([failed, { ...failed }]);
    expect(result.survivalRate).toBe(0);
  });

  it('reports the correct fraction when half survive', () => {
    const surviving = flatTrajectory(1_000_000);
    const failed = makeTrajectory({
      realBalance: [1_000_000, 0],
      survived: false,
      depletionMonth: 1,
    });
    const result = aggregate([surviving, failed]);
    expect(result.survivalRate).toBe(0.5);
  });
});

describe('aggregate – ending real value statistics', () => {
  it('computes mean, median, and percentiles for two trajectories with known ending values', () => {
    // t1 ends at 1_000_000; t2 ends at 2_000_000
    const t1 = flatTrajectory(1_000_000);
    const t2 = flatTrajectory(2_000_000);
    const result = aggregate([t1, t2]);

    // mean = 1_500_000; median = linear interp at 0.5 → 1_500_000
    expect(result.endingRealValue.mean).toBeCloseTo(1_500_000);
    expect(result.endingRealValue.median).toBeCloseTo(1_500_000);
    // p10 = interp at index 0.1 → 1_000_000 + 0.1 * 1_000_000 = 1_100_000
    expect(result.endingRealValue.p10).toBeCloseTo(1_100_000);
    // p90 = interp at index 0.9 → 1_000_000 + 0.9 * 1_000_000 = 1_900_000
    expect(result.endingRealValue.p90).toBeCloseTo(1_900_000);
  });

  it('computes correct percentiles for four equally spaced values', () => {
    // ending values sorted: 100, 200, 300, 400
    const trajectories = [100, 200, 300, 400].map((v) => flatTrajectory(v));
    const result = aggregate(trajectories);

    // mean = 250
    expect(result.endingRealValue.mean).toBeCloseTo(250);
    // median: p50 → index 1.5 → interp(200, 300, 0.5) = 250
    expect(result.endingRealValue.median).toBeCloseTo(250);
    // p25: index 0.75 → interp(100, 200, 0.75) = 175
    expect(result.endingRealValue.p25).toBeCloseTo(175);
    // p75: index 2.25 → interp(300, 400, 0.25) = 325
    expect(result.endingRealValue.p75).toBeCloseTo(325);
    // p10: index 0.3 → interp(100, 200, 0.3) = 130
    expect(result.endingRealValue.p10).toBeCloseTo(130);
    // p90: index 2.7 → interp(300, 400, 0.7) = 370
    expect(result.endingRealValue.p90).toBeCloseTo(370);
  });
});

describe('aggregate – withdrawal statistics', () => {
  it('computes mean, median, and variance over all real withdrawals', () => {
    // t1 has real withdrawals [40_000, 42_000]; t2 has [38_000, 40_000]
    // flat pool: [40_000, 42_000, 38_000, 40_000]
    // mean = 160_000 / 4 = 40_000
    // sorted: [38_000, 40_000, 40_000, 42_000]
    // median: p50 at index 1.5 → interp(40_000, 40_000, 0.5) = 40_000
    // variance: deviations² = [0, 4_000_000, 4_000_000, 0] → mean = 2_000_000
    const t1 = makeTrajectory({
      realBalance: Array(24).fill(1_000_000),
      realWithdrawal: [40_000, 42_000],
      survived: true,
    });
    const t2 = makeTrajectory({
      realBalance: Array(24).fill(1_000_000),
      realWithdrawal: [38_000, 40_000],
      survived: true,
    });
    const result = aggregate([t1, t2]);

    expect(result.realWithdrawal.mean).toBeCloseTo(40_000);
    expect(result.realWithdrawal.median).toBeCloseTo(40_000);
    expect(result.realWithdrawal.variance).toBeCloseTo(2_000_000);
  });

  it('handles single trajectory with single-year withdrawal', () => {
    const t = makeTrajectory({
      realBalance: Array(12).fill(500_000),
      realWithdrawal: [20_000],
      survived: true,
    });
    const result = aggregate([t]);
    expect(result.realWithdrawal.mean).toBe(20_000);
    expect(result.realWithdrawal.median).toBe(20_000);
    expect(result.realWithdrawal.variance).toBe(0);
  });
});

describe('aggregate – max drawdown', () => {
  it('reports zero drawdown for a monotonically increasing balance', () => {
    const t = makeTrajectory({
      realBalance: [100, 110, 120, 130, 140],
      realWithdrawal: [],
      survived: true,
    });
    const result = aggregate([t]);
    expect(result.meanMaxDrawdown).toBeCloseTo(0);
    expect(result.medianMaxDrawdown).toBeCloseTo(0);
  });

  it('computes 50 % drawdown for a balance that halves from its peak', () => {
    // rises to 200, falls to 100 → 50 % drawdown
    const t = makeTrajectory({
      realBalance: [100, 150, 200, 150, 100],
      realWithdrawal: [],
      survived: true,
    });
    const result = aggregate([t]);
    expect(result.meanMaxDrawdown).toBeCloseTo(0.5);
  });

  it('averages max drawdown correctly across multiple trajectories', () => {
    // t1: peak 200, trough 100 → 50 % drawdown
    const t1 = makeTrajectory({ realBalance: [200, 100], survived: true });
    // t2: peak 100, trough 100 → 0 % drawdown (flat)
    const t2 = makeTrajectory({ realBalance: [100, 100], survived: true });
    const result = aggregate([t1, t2]);
    expect(result.meanMaxDrawdown).toBeCloseTo(0.25);
    expect(result.medianMaxDrawdown).toBeCloseTo(0.25);
  });
});

describe('aggregate – failure year distribution', () => {
  it('builds an empty distribution when all trajectories survive', () => {
    const result = aggregate([flatTrajectory(1_000_000), flatTrajectory(800_000)]);
    expect(result.failureYearDistribution).toEqual({});
  });

  it('records the correct year for a trajectory that depletes in month 13 (year 1)', () => {
    const failed = makeTrajectory({
      realBalance: Array(24).fill(0),
      survived: false,
      depletionMonth: 13,
    });
    const result = aggregate([failed]);
    expect(result.failureYearDistribution[1]).toBe(1);
  });

  it('accumulates counts for multiple failures in the same year', () => {
    const makeFailedAt = (month: number): Trajectory =>
      makeTrajectory({
        realBalance: Array(24).fill(0),
        survived: false,
        depletionMonth: month,
      });
    // months 0–11 → year 0; months 12–23 → year 1
    const result = aggregate([
      makeFailedAt(0),
      makeFailedAt(6),
      makeFailedAt(12),
    ]);
    expect(result.failureYearDistribution[0]).toBe(2);
    expect(result.failureYearDistribution[1]).toBe(1);
  });

  it('ignores failed trajectories where depletionMonth is undefined', () => {
    const t = makeTrajectory({ realBalance: [0], survived: false });
    const result = aggregate([t]);
    expect(result.failureYearDistribution).toEqual({});
  });
});

describe('aggregate – percentile boundary cases', () => {
  it('returns the single value for all percentiles when there is one trajectory', () => {
    const result = aggregate([flatTrajectory(750_000)]);
    expect(result.endingRealValue.p10).toBeCloseTo(750_000);
    expect(result.endingRealValue.p25).toBeCloseTo(750_000);
    expect(result.endingRealValue.median).toBeCloseTo(750_000);
    expect(result.endingRealValue.p75).toBeCloseTo(750_000);
    expect(result.endingRealValue.p90).toBeCloseTo(750_000);
  });

  it('handles trajectories with zero ending real balance (complete depletion)', () => {
    const depleted = makeTrajectory({
      realBalance: Array(12).fill(0),
      survived: false,
      depletionMonth: 0,
    });
    const surviving = flatTrajectory(1_000_000);
    const result = aggregate([depleted, surviving]);
    // ending values: [0, 1_000_000] sorted; p10 = 0 + 0.1 * 1_000_000 = 100_000
    expect(result.endingRealValue.p10).toBeCloseTo(100_000);
    expect(result.endingRealValue.mean).toBeCloseTo(500_000);
  });
});

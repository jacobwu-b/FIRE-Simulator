import type { Trajectory } from '../simulation/types';

export interface EndingValueStats {
  mean: number;
  median: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
}

export interface WithdrawalStats {
  mean: number;
  median: number;
  /** Population variance of all real annual withdrawals across all trajectories. */
  variance: number;
}

export interface AggregateMetrics {
  trajectoryCount: number;
  survivalRate: number;
  endingRealValue: EndingValueStats;
  realWithdrawal: WithdrawalStats;
  /** Failure year index (0-based) → count of trajectories that depleted in that year. */
  failureYearDistribution: Record<number, number>;
  /** Mean max peak-to-trough drawdown in real balance across all trajectories (0–1). */
  meanMaxDrawdown: number;
  /** Median max drawdown across all trajectories (0–1). */
  medianMaxDrawdown: number;
}

function arithmeticMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Linear interpolation percentile on a pre-sorted array. p in [0, 1]. */
function percentileOf(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function endingValueStats(values: number[]): EndingValueStats {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean: arithmeticMean(values),
    median: percentileOf(sorted, 0.5),
    p10: percentileOf(sorted, 0.1),
    p25: percentileOf(sorted, 0.25),
    p75: percentileOf(sorted, 0.75),
    p90: percentileOf(sorted, 0.9),
  };
}

function withdrawalStats(values: number[]): WithdrawalStats {
  if (values.length === 0) return { mean: 0, median: 0, variance: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mu = arithmeticMean(values);
  const variance = arithmeticMean(values.map((v) => (v - mu) ** 2));
  return {
    mean: mu,
    median: percentileOf(sorted, 0.5),
    variance,
  };
}

/** Max peak-to-trough drawdown for a single series (0 = no drawdown, 1 = full wipeout). */
function maxDrawdown(values: number[]): number {
  if (values.length === 0) return 0;
  let peak = values[0];
  let dd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const cur = peak > 0 ? (peak - v) / peak : 0;
    if (cur > dd) dd = cur;
  }
  return dd;
}

/**
 * Computes unified summary metrics over an array of trajectories.
 * Returns a zeroed-out result when the array is empty.
 */
export function aggregate(trajectories: Trajectory[]): AggregateMetrics {
  const count = trajectories.length;

  if (count === 0) {
    return {
      trajectoryCount: 0,
      survivalRate: 0,
      endingRealValue: { mean: 0, median: 0, p10: 0, p25: 0, p75: 0, p90: 0 },
      realWithdrawal: { mean: 0, median: 0, variance: 0 },
      failureYearDistribution: {},
      meanMaxDrawdown: 0,
      medianMaxDrawdown: 0,
    };
  }

  const survivalCount = trajectories.filter((t) => t.survived).length;
  const survivalRate = survivalCount / count;

  const endingReals = trajectories.map((t) => t.realBalance[t.realBalance.length - 1]);

  // Flatten all real annual withdrawals across every trajectory and every year.
  const allRealWithdrawals = trajectories.flatMap((t) => t.realWithdrawal);

  const failureYearDistribution: Record<number, number> = {};
  for (const t of trajectories) {
    if (!t.survived && t.depletionMonth !== undefined) {
      const year = Math.floor(t.depletionMonth / 12);
      failureYearDistribution[year] = (failureYearDistribution[year] ?? 0) + 1;
    }
  }

  const drawdowns = trajectories.map((t) => maxDrawdown(t.realBalance));
  const sortedDrawdowns = [...drawdowns].sort((a, b) => a - b);

  return {
    trajectoryCount: count,
    survivalRate,
    endingRealValue: endingValueStats(endingReals),
    realWithdrawal: withdrawalStats(allRealWithdrawals),
    failureYearDistribution,
    meanMaxDrawdown: arithmeticMean(drawdowns),
    medianMaxDrawdown: percentileOf(sortedDrawdowns, 0.5),
  };
}

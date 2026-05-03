import type { SimParams, Trajectory } from '../simulation/types';
import type { MarketDataset } from '../data/types';
import type { StrategyParams } from '../strategies/types';
import type { AggregateMetrics } from '../metrics/aggregate';
import { runMonthlyEngine } from '../simulation/engine';
import { createStrategy } from '../strategies/index';
import { aggregate } from '../metrics/aggregate';

/**
 * Aggregated result of running the simulation over every valid rolling
 * start period in the historical dataset.
 */
export interface HistoricalResult {
  /** Number of rolling periods simulated. */
  periodCount: number;
  /** Fraction of periods where the portfolio survived to the final month (0–1). */
  survivalRate: number;
  /** ISO start date ("YYYY-MM") of each rolling period; length = periodCount. */
  startDates: string[];
  /** Nominal balance at the final month for each period; length = periodCount. */
  endingNominalValues: number[];
  /** Real balance (month-0 dollars) at the final month for each period; length = periodCount. */
  endingRealValues: number[];
  /**
   * Nominal withdrawal amounts indexed by [yearIndex][periodIndex].
   * Outer length = horizonYears; inner length = periodCount.
   */
  nominalWithdrawalsPerYear: number[][];
  /**
   * Real withdrawal amounts (month-0 dollars) indexed by [yearIndex][periodIndex].
   * Outer length = horizonYears; inner length = periodCount.
   */
  realWithdrawalsPerYear: number[][];
  /** Individual trajectories for each rolling period; length = periodCount. */
  trajectories: Trajectory[];
  /** Unified summary metrics computed over all trajectories. */
  metrics: AggregateMetrics;
}

/**
 * Runs the simulation engine over every valid rolling start period in the
 * historical dataset and returns aggregated outputs.
 *
 * A start index `i` is valid when `i + horizonMonths <= dataset.usEquity.length`,
 * ensuring each period has a full complement of return / inflation data.
 *
 * A fresh strategy closure is created for each period so that stateful
 * strategies (e.g. Guyton-Klinger) start clean.
 */
export function runHistorical(
  params: SimParams,
  dataset: MarketDataset,
  strategy: StrategyParams,
): HistoricalResult {
  const horizonMonths = params.horizonYears * 12;
  const totalDataMonths = dataset.usEquity.length;

  const startDates: string[] = [];
  const endingNominalValues: number[] = [];
  const endingRealValues: number[] = [];
  const trajectories: Trajectory[] = [];
  const nominalWithdrawalsPerYear: number[][] = Array.from(
    { length: params.horizonYears },
    () => [] as number[],
  );
  const realWithdrawalsPerYear: number[][] = Array.from(
    { length: params.horizonYears },
    () => [] as number[],
  );
  let survivalCount = 0;

  for (let start = 0; start + horizonMonths <= totalDataMonths; start++) {
    const usReturns = dataset.usEquity
      .slice(start, start + horizonMonths)
      .map((r) => r.value);
    const intlReturns = dataset.intlEquity
      .slice(start, start + horizonMonths)
      .map((r) => r.value);
    const inflation = dataset.cpi
      .slice(start, start + horizonMonths)
      .map((r) => r.value);

    const withdrawalFn = createStrategy(strategy);
    const trajectory = runMonthlyEngine(
      params,
      usReturns,
      intlReturns,
      inflation,
      withdrawalFn,
    );

    startDates.push(dataset.usEquity[start].date);
    endingNominalValues.push(trajectory.nominalBalance[horizonMonths - 1]);
    endingRealValues.push(trajectory.realBalance[horizonMonths - 1]);
    trajectories.push(trajectory);

    if (trajectory.survived) survivalCount++;

    for (let y = 0; y < params.horizonYears; y++) {
      nominalWithdrawalsPerYear[y].push(trajectory.nominalWithdrawal[y]);
      realWithdrawalsPerYear[y].push(trajectory.realWithdrawal[y]);
    }
  }

  const periodCount = startDates.length;
  const survivalRate = periodCount > 0 ? survivalCount / periodCount : 0;

  return {
    periodCount,
    survivalRate,
    startDates,
    endingNominalValues,
    endingRealValues,
    nominalWithdrawalsPerYear,
    realWithdrawalsPerYear,
    trajectories,
    metrics: aggregate(trajectories),
  };
}

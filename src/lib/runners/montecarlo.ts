import type { SimParams, Trajectory } from '../simulation/types';
import type { MarketDataset } from '../data/types';
import type { StrategyParams } from '../strategies/types';
import type { MonteCarloCalibration, MonteCarloConfig, MonteCarloResult } from '../montecarlo/types';
import { runMonthlyEngine } from '../simulation/engine';
import { createStrategy } from '../strategies/index';
import { calibrateFromHistorical } from '../montecarlo/calibrate';
import { createBlockBootstrapGenerator } from '../montecarlo/generate';
import { deriveSeed } from '../montecarlo/prng';

const DEFAULT_KEEP_TRAJECTORIES = 200;

/**
 * Selects a stratified sample of trajectories across percentile buckets of
 * ending real value. When N < keepCount, returns all trajectories.
 *
 * Stratification ensures the sample spans the full distribution (best-case,
 * median, worst-case) rather than clustering around the mode.
 */
function sampleTrajectories(
  trajectories: Trajectory[],
  endingRealValues: number[],
  keepCount: number,
): Trajectory[] {
  if (trajectories.length <= keepCount) return [...trajectories];

  // Sort indices by ending real value, then pick evenly spaced positions.
  const indices = Array.from({ length: trajectories.length }, (_, i) => i);
  indices.sort((a, b) => endingRealValues[a] - endingRealValues[b]);

  const step = (indices.length - 1) / (keepCount - 1);
  return Array.from({ length: keepCount }, (_, i) => {
    const pos = Math.round(i * step);
    return trajectories[indices[pos]];
  });
}

/**
 * Runs the simulation engine over N synthetic return paths generated via
 * stationary block bootstrap and returns aggregated outputs.
 *
 * A fresh strategy closure is created for each path so stateful strategies
 * (e.g. Guyton-Klinger) start clean.
 *
 * Full trajectories are memory-intensive at large N; only a percentile-
 * stratified sample is retained (see MonteCarloConfig.keepTrajectories).
 *
 * @param params - Simulation parameters (portfolio, allocation, horizon).
 * @param dataset - Historical market dataset used for bootstrap calibration.
 * @param strategy - Withdrawal strategy configuration.
 * @param config - Monte Carlo run configuration (pathCount, seed, keepTrajectories).
 * @param calibration - Optional pre-computed calibration. If omitted, derived
 *   from dataset with default block length.
 */
export function runMonteCarlo(
  params: SimParams,
  dataset: MarketDataset,
  strategy: StrategyParams,
  config: MonteCarloConfig,
  calibration?: MonteCarloCalibration,
): MonteCarloResult {
  const cal = calibration ?? calibrateFromHistorical(dataset);
  const keepCount = config.keepTrajectories ?? DEFAULT_KEEP_TRAJECTORIES;
  const horizonMonths = params.horizonYears * 12;

  const historicalUS = dataset.usEquity.map((r) => r.value);
  const historicalIntl = dataset.intlEquity.map((r) => r.value);
  const historicalCPI = dataset.cpi.map((r) => r.value);

  const endingNominalValues: number[] = [];
  const endingRealValues: number[] = [];
  const allTrajectories: Trajectory[] = [];
  const nominalWithdrawalsPerYear: number[][] = Array.from(
    { length: params.horizonYears },
    () => [] as number[],
  );
  const realWithdrawalsPerYear: number[][] = Array.from(
    { length: params.horizonYears },
    () => [] as number[],
  );
  let survivalCount = 0;

  for (let pathIndex = 0; pathIndex < config.pathCount; pathIndex++) {
    const pathSeed = deriveSeed(config.seed, pathIndex);
    const generatePath = createBlockBootstrapGenerator(
      cal,
      pathSeed,
      historicalUS,
      historicalIntl,
      historicalCPI,
    );
    const { usReturns, intlReturns, inflation } = generatePath(horizonMonths);

    const withdrawalFn = createStrategy(strategy);
    const trajectory = runMonthlyEngine(
      params,
      usReturns,
      intlReturns,
      inflation,
      withdrawalFn,
    );

    endingNominalValues.push(trajectory.nominalBalance[horizonMonths - 1]);
    endingRealValues.push(trajectory.realBalance[horizonMonths - 1]);
    allTrajectories.push(trajectory);

    if (trajectory.survived) survivalCount++;

    for (let y = 0; y < params.horizonYears; y++) {
      nominalWithdrawalsPerYear[y].push(trajectory.nominalWithdrawal[y]);
      realWithdrawalsPerYear[y].push(trajectory.realWithdrawal[y]);
    }
  }

  const trajectories = sampleTrajectories(allTrajectories, endingRealValues, keepCount);
  const survivalRate = config.pathCount > 0 ? survivalCount / config.pathCount : 0;

  return {
    pathCount: config.pathCount,
    seed: config.seed,
    survivalRate,
    endingNominalValues,
    endingRealValues,
    nominalWithdrawalsPerYear,
    realWithdrawalsPerYear,
    trajectories,
  };
}

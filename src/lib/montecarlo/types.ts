import type { Trajectory } from '../simulation/types';
import type { AggregateMetrics } from '../metrics/aggregate';

/** Configuration for the stationary block bootstrap generator. */
export interface BlockBootstrapConfig {
  /**
   * Expected block length in months for the geometric distribution.
   * Politis-Romano rule of thumb: 24–60 for ~1,200 monthly observations.
   * Default: 36.
   */
  expectedBlockLength: number;
}

/**
 * Per-series summary statistics and bootstrap configuration derived from the
 * historical dataset. Produced by calibrate() and consumed by generatePath().
 */
export interface MonteCarloCalibration {
  /** Number of months in the source dataset (used for wrap-around indexing). */
  datasetLength: number;

  /** Historical arithmetic mean of monthly US equity returns (decimal). */
  usMean: number;
  /** Historical standard deviation of monthly US equity returns (decimal). */
  usVol: number;

  /** Historical arithmetic mean of monthly international equity returns (decimal). */
  intlMean: number;
  /** Historical standard deviation of monthly international equity returns (decimal). */
  intlVol: number;

  /** Historical arithmetic mean of monthly CPI inflation (decimal). */
  inflationMean: number;
  /** Historical standard deviation of monthly CPI inflation (decimal). */
  inflationVol: number;

  /** Block bootstrap configuration used during generation. */
  blockConfig: BlockBootstrapConfig;
}

/**
 * Configuration for a Monte Carlo run.
 */
export interface MonteCarloConfig {
  /**
   * Number of synthetic paths to simulate.
   */
  pathCount: number;

  /**
   * Master seed for the PRNG. Identical seed + inputs → identical results.
   */
  seed: number;

  /**
   * Number of full trajectories to retain in the result, stratified by
   * ending real value across percentile buckets.
   * Default: 200.
   */
  keepTrajectories?: number;
}

/**
 * Aggregated result of running the simulation over N synthetic paths.
 * Mirrors HistoricalResult where possible so downstream aggregation is uniform.
 */
export interface MonteCarloResult {
  /** Number of paths simulated. */
  pathCount: number;

  /** Master seed used for this run. */
  seed: number;

  /** Fraction of paths where the portfolio survived to the final month (0–1). */
  survivalRate: number;

  /** Nominal balance at the final month for each path; length = pathCount. */
  endingNominalValues: number[];

  /** Real balance (month-0 dollars) at the final month for each path; length = pathCount. */
  endingRealValues: number[];

  /**
   * Nominal withdrawal amounts indexed by [yearIndex][pathIndex].
   * Outer length = horizonYears; inner length = pathCount.
   */
  nominalWithdrawalsPerYear: number[][];

  /**
   * Real withdrawal amounts (month-0 dollars) indexed by [yearIndex][pathIndex].
   * Outer length = horizonYears; inner length = pathCount.
   */
  realWithdrawalsPerYear: number[][];

  /**
   * Sampled full trajectories, stratified by ending real value.
   * Length = min(keepTrajectories, pathCount).
   */
  trajectories: Trajectory[];
  /** Unified summary metrics computed over ALL paths (not the sampled subset). */
  metrics: AggregateMetrics;
}

/**
 * A function that generates one set of monthly return paths for the simulation
 * engine. Abstracted so alternative generators (e.g. parametric) can be
 * substituted without modifying the runner.
 */
export type GeneratePath = (horizonMonths: number) => {
  usReturns: number[];
  intlReturns: number[];
  inflation: number[];
};

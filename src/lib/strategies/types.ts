import type { MonthState, WithdrawalDecision } from '../simulation/types';

/** All supported withdrawal strategy identifiers. */
export type StrategyId = 'rmd' | 'fixedPct' | 'gk' | 'hybrid';

/** Parameters for the RMD / life-expectancy strategy. */
export interface RmdParams {
  id: 'rmd';
  /** Total retirement horizon in years — must match SimParams.horizonYears. */
  horizonYears: number;
}

/** Parameters for the fixed-percentage strategy. */
export interface FixedPctParams {
  id: 'fixedPct';
  /** Annual withdrawal rate as a decimal (e.g. 0.04 for 4%). Must be > 0. */
  rate: number;
}

/** Parameters for the Guyton-Klinger guardrails strategy. */
export interface GkParams {
  id: 'gk';
  /** Initial portfolio value in nominal dollars (month-0). */
  initialPortfolio: number;
  /** Initial withdrawal rate as a decimal (e.g. 0.04). Must be > 0. */
  initialRate: number;
}

/** Parameters for the inflation-adjusted hybrid baseline strategy. */
export interface HybridParams {
  id: 'hybrid';
  /** Initial portfolio value in nominal dollars (month-0). */
  initialPortfolio: number;
  /**
   * Base withdrawal rate applied to current balance each year.
   * The unconstrained amount is clamped to floor/ceiling.
   */
  rate: number;
  /**
   * Floor multiplier relative to initial real withdrawal.
   * Withdrawal will not fall below initialRealWithdrawal * floorMultiplier (in real terms).
   * Default: 0.80.
   */
  floorMultiplier: number;
  /**
   * Ceiling multiplier relative to initial real withdrawal.
   * Withdrawal will not rise above initialRealWithdrawal * ceilingMultiplier (in real terms).
   * Default: 1.25.
   */
  ceilingMultiplier: number;
}

/** Discriminated union of all strategy parameter objects. */
export type StrategyParams = RmdParams | FixedPctParams | GkParams | HybridParams;

/** The engine callback signature that every strategy factory must return. */
export type WithdrawalFn = (state: MonthState) => WithdrawalDecision;

/** A strategy factory: given params, returns a closure bound to those params. */
export type StrategyFactory<P extends StrategyParams> = (params: P) => WithdrawalFn;

import type { StrategyId } from '../../lib/strategies/types';

export interface UIAllocation {
  us: number;
  intl: number;
}

export interface UIStrategyRmd {
  id: 'rmd';
}

export interface UIStrategyFixedPct {
  id: 'fixedPct';
  rate: number;
}

export interface UIStrategyGk {
  id: 'gk';
  initialRate: number;
}

export interface UIStrategyHybrid {
  id: 'hybrid';
  rate: number;
  floorMultiplier: number;
  ceilingMultiplier: number;
}

export type UIStrategyParams =
  | UIStrategyRmd
  | UIStrategyFixedPct
  | UIStrategyGk
  | UIStrategyHybrid;

/** All user-editable simulation parameters held in App state. */
export interface UIParams {
  initialPortfolio: number;
  allocation: UIAllocation;
  horizonYears: number;
  strategyId: StrategyId;
  strategyParams: UIStrategyParams;
}

export const DEFAULT_UI_PARAMS: UIParams = {
  initialPortfolio: 1_000_000,
  allocation: { us: 60, intl: 40 },
  horizonYears: 30,
  strategyId: 'fixedPct',
  strategyParams: { id: 'fixedPct', rate: 4 },
};

import type { RmdParams, StrategyFactory } from './types';

/**
 * RMD / Life-Expectancy-Based Withdrawal (see ADR 0004).
 *
 * Each year: withdraw realBalance / remainingYears, converted to nominal.
 * remainingYears = horizonYears - yearIndex (floored at 1).
 */
export const createRmd: StrategyFactory<RmdParams> = ({ horizonYears }) => {
  return (state) => {
    if (state.nominalBalance <= 0) return { nominalAmount: 0 };
    const remainingYears = Math.max(1, horizonYears - state.yearIndex);
    const realAnnual = state.realBalance / remainingYears;
    return { nominalAmount: realAnnual * state.cumulativeInflation };
  };
};

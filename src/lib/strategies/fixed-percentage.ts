import type { FixedPctParams, StrategyFactory } from './types';

/**
 * Fixed Percentage Withdrawal (see ADR 0004).
 *
 * Each year: withdraw rate * nominalBalance.
 */
export const createFixedPct: StrategyFactory<FixedPctParams> = ({ rate }) => {
  return (state) => {
    if (state.nominalBalance <= 0) return { nominalAmount: 0 };
    return { nominalAmount: rate * state.nominalBalance };
  };
};

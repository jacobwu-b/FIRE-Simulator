import type { HybridParams, StrategyFactory } from './types';

/**
 * Inflation-Adjusted Hybrid Baseline Strategy (see ADR 0004).
 *
 * Withdraws rate * nominalBalance, clamped to an inflation-adjusted
 * floor and ceiling derived from the initial real withdrawal:
 *
 *   unconstrained = rate * nominalBalance
 *   floor         = initialRealWithdrawal * floorMultiplier * cumulativeInflation
 *   ceiling       = initialRealWithdrawal * ceilingMultiplier * cumulativeInflation
 *   nominalAmount = clamp(unconstrained, floor, ceiling)
 */
export const createHybrid: StrategyFactory<HybridParams> = ({
  initialPortfolio,
  rate,
  floorMultiplier,
  ceilingMultiplier,
}) => {
  // At year 0, cumulativeInflation = 1, so initialRealWithdrawal = initialPortfolio * rate.
  const initialRealWithdrawal = initialPortfolio * rate;

  return (state) => {
    if (state.nominalBalance <= 0) return { nominalAmount: 0 };

    const unconstrained = rate * state.nominalBalance;
    const floor = initialRealWithdrawal * floorMultiplier * state.cumulativeInflation;
    const ceiling = initialRealWithdrawal * ceilingMultiplier * state.cumulativeInflation;

    return { nominalAmount: Math.min(ceiling, Math.max(floor, unconstrained)) };
  };
};

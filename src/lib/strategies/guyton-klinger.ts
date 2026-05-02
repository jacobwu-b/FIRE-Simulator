import type { GkParams, StrategyFactory } from './types';

/**
 * Guyton-Klinger Guardrails Strategy (see ADR 0004).
 *
 * Three independent rules from Guyton & Klinger (2006):
 *
 * 1. Inflation Adjustment Rule: each year increase withdrawal by CPI.
 *    Exception: skip the CPI bump when (portfolio was a down year AND WR > initial WR).
 *
 * 2. Prosperity Rule: if current WR falls 20%+ below initial WR → raise withdrawal by 10%.
 *
 * 3. Capital-Preservation Rule: if current WR rises 20%+ above initial WR → cut by 10%.
 *
 * Rules 2 and 3 are independent of rule 1 (they fire regardless of down-year status).
 *
 * "Down year" is detected by comparing this year's real balance to the prior year's
 * real balance (see ADR 0004 for rationale).
 *
 * CPI between years is derived from prevCumInflation / currentCumInflation.
 */
export const createGk: StrategyFactory<GkParams> = ({
  initialPortfolio,
  initialRate,
}) => {
  const initialNominalWithdrawal = initialPortfolio * initialRate;
  const GUARD_BAND = 0.2;
  const PROSPERITY_INCREASE = 0.1;
  const PRESERVATION_CUT = 0.1;

  let currentWithdrawal = initialNominalWithdrawal;
  let prevYearRealBalance: number | null = null;
  let prevCumInflation = 1;

  return (state) => {
    if (state.nominalBalance <= 0) return { nominalAmount: 0 };

    const isFirstYear = state.yearIndex === 0;

    if (!isFirstYear) {
      // --- Rule 1: Inflation Adjustment ---
      const wasDownYear =
        prevYearRealBalance !== null && state.realBalance < prevYearRealBalance;

      const priorWR = currentWithdrawal / (state.nominalBalance);
      const inflationFrozen = wasDownYear && priorWR > initialRate;

      if (!inflationFrozen && prevCumInflation > 0) {
        const annualInflation = state.cumulativeInflation / prevCumInflation - 1;
        currentWithdrawal = currentWithdrawal * (1 + annualInflation);
      }

      // --- Rules 2 & 3: Guard bands (independent of inflation freeze) ---
      const currentWR = currentWithdrawal / state.nominalBalance;
      const wrRatio = currentWR / initialRate;

      if (wrRatio < 1 - GUARD_BAND) {
        currentWithdrawal = currentWithdrawal * (1 + PROSPERITY_INCREASE);
      } else if (wrRatio > 1 + GUARD_BAND) {
        currentWithdrawal = currentWithdrawal * (1 - PRESERVATION_CUT);
      }
    }

    prevYearRealBalance = state.realBalance;
    prevCumInflation = state.cumulativeInflation;

    return { nominalAmount: currentWithdrawal };
  };
};

import type {
  SimParams,
  MonthState,
  WithdrawalDecision,
  Trajectory,
} from './types';

/**
 * Runs the deterministic monthly simulation engine.
 *
 * Conventions (see ADR 0003):
 * - withdrawalFn fires once per year at monthOfYear === 0, returns nominal annual amount.
 * - Engine deducts annualAmount / 12 each month; excess over balance is capped.
 * - Return applied after withdrawal: balance *= (1 + w_us*r_us + w_intl*r_intl).
 * - Real values expressed in month-0 dollars.
 * - Pure function: same inputs always produce identical output.
 *
 * @param params        Simulation parameters (portfolio, allocation, horizon).
 * @param usReturns     Monthly US equity total returns (decimal), length >= horizonYears * 12.
 * @param intlReturns   Monthly international equity total returns (decimal), same length.
 * @param inflation     Monthly CPI inflation rates (decimal), same length.
 * @param withdrawalFn  Called at start of each year; returns the annual nominal withdrawal.
 */
export function runMonthlyEngine(
  params: SimParams,
  usReturns: number[],
  intlReturns: number[],
  inflation: number[],
  withdrawalFn: (_state: MonthState) => WithdrawalDecision,
): Trajectory {
  const totalMonths = params.horizonYears * 12;
  const { us: wUs, intl: wIntl } = params.allocation;

  const nominalBalance: number[] = new Array(totalMonths) as number[];
  const realBalance: number[] = new Array(totalMonths) as number[];
  const cumulativeInflation: number[] = new Array(totalMonths) as number[];
  const nominalWithdrawal: number[] = new Array(params.horizonYears).fill(0) as number[];
  const realWithdrawal: number[] = new Array(params.horizonYears).fill(0) as number[];

  let balance = params.initialPortfolio;
  // cumInflation tracks the cumulative product up to and including the current month.
  // Before month 0 is processed it equals 1 (base = month-0 dollars).
  let cumInflation = 1;
  let depletionMonth: number | undefined;

  let currentAnnualWithdrawal = 0;

  for (let t = 0; t < totalMonths; t++) {
    const yearIndex = Math.floor(t / 12);
    const monthOfYear = t % 12;

    // --- Start of year: ask strategy for this year's withdrawal ---
    if (monthOfYear === 0) {
      const state: MonthState = {
        monthIndex: t,
        yearIndex,
        monthOfYear,
        nominalBalance: balance,
        realBalance: balance / cumInflation,
        cumulativeInflation: cumInflation,
      };
      const decision: WithdrawalDecision =
        balance > 0 ? withdrawalFn(state) : { nominalAmount: 0 };
      currentAnnualWithdrawal = Math.max(0, decision.nominalAmount);
    }

    // --- Deduct 1/12 of annual withdrawal (capped at available balance) ---
    if (depletionMonth === undefined) {
      const monthlyWithdrawal = currentAnnualWithdrawal / 12;
      const actualDeduction = Math.min(monthlyWithdrawal, balance);
      balance -= actualDeduction;
      nominalWithdrawal[yearIndex] += actualDeduction;

      if (balance <= 0) {
        balance = 0;
        depletionMonth = t;
      }
    }

    // --- Apply blended return ---
    const blended = wUs * usReturns[t] + wIntl * intlReturns[t];
    balance = balance * (1 + blended);
    if (balance < 0) balance = 0; // guard against extreme negative returns

    // --- Advance cumulative inflation ---
    cumInflation = cumInflation * (1 + inflation[t]);

    // --- Record month-end state ---
    nominalBalance[t] = balance;
    realBalance[t] = balance / cumInflation;
    cumulativeInflation[t] = cumInflation;
  }

  // Build real withdrawal series from nominal totals and year-start inflation.
  // We need year-start cumInflation per year; re-derive from cumulativeInflation array.
  for (let y = 0; y < params.horizonYears; y++) {
    const yearStartMonth = y * 12;
    // cumInflation before month yearStartMonth = value at end of month (yearStartMonth - 1),
    // or 1 if yearStartMonth === 0.
    const inflationAtYearStart =
      yearStartMonth === 0 ? 1 : cumulativeInflation[yearStartMonth - 1];
    realWithdrawal[y] = nominalWithdrawal[y] / inflationAtYearStart;
  }

  const survived = nominalBalance[totalMonths - 1] > 0;

  return {
    nominalBalance,
    realBalance,
    cumulativeInflation,
    nominalWithdrawal,
    realWithdrawal,
    survived,
    depletionMonth,
  };
}

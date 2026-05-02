/** US/international equity split. Weights must sum to 1; both must be >= 0. */
export interface Allocation {
  us: number;
  intl: number;
}

/** Top-level parameters passed to the simulation engine. */
export interface SimParams {
  /** Starting portfolio value in nominal dollars at month 0. */
  initialPortfolio: number;
  /** Equity allocation weights. Must satisfy us + intl === 1. */
  allocation: Allocation;
  /** Number of years to simulate. Engine runs for horizonYears * 12 months. */
  horizonYears: number;
}

/**
 * Snapshot of portfolio state visible to the withdrawal callback.
 * Passed once at the start of each simulated year (monthIndex where monthOfYear === 0).
 */
export interface MonthState {
  /** Zero-based index of the current month (0 = first month of retirement). */
  monthIndex: number;
  /** Zero-based year counter (0 = first retirement year). */
  yearIndex: number;
  /** Month within the current year: 0–11. Always 0 when the callback fires. */
  monthOfYear: number;
  /** Nominal portfolio balance at the start of this month, before withdrawal. */
  nominalBalance: number;
  /** Real portfolio balance (month-0 dollars) at the start of this month, before withdrawal. */
  realBalance: number;
  /** Cumulative inflation factor from month 0 through the previous month. */
  cumulativeInflation: number;
}

/**
 * Return value of the withdrawal callback.
 * The engine deducts nominalAmount / 12 each month for the current year.
 */
export interface WithdrawalDecision {
  /** Annual withdrawal amount in nominal dollars. Must be >= 0. */
  nominalAmount: number;
}

/**
 * Complete monthly trajectory produced by the engine.
 * All arrays have length horizonYears * 12.
 */
export interface Trajectory {
  /**
   * Nominal portfolio balance at the END of each month (after withdrawal deduction
   * and return application), indexed 0 … horizonYears*12 - 1.
   */
  nominalBalance: number[];

  /**
   * Real portfolio balance (month-0 dollars) at the END of each month.
   * realBalance[t] = nominalBalance[t] / cumulativeInflation[t+1]
   */
  realBalance: number[];

  /**
   * Cumulative inflation factor at the END of each month.
   * cumulativeInflation[0] = 1 * (1 + inflation[0]).
   * Used by callers that need to convert additional nominal values to real.
   */
  cumulativeInflation: number[];

  /**
   * Nominal annual withdrawal amounts, indexed by year (length = horizonYears).
   * nominalWithdrawal[y] is the total nominal dollars withdrawn in year y
   * (sum of the 12 monthly deductions for that year).
   */
  nominalWithdrawal: number[];

  /**
   * Real annual withdrawal amounts in month-0 dollars, indexed by year.
   * realWithdrawal[y] = nominalWithdrawal[y] / cumulativeInflation at start of year y.
   */
  realWithdrawal: number[];

  /** True if the portfolio balance is strictly > 0 at the final month. */
  survived: boolean;

  /**
   * The month index (0-based) at which the portfolio first reached zero.
   * Undefined if the portfolio never depleted.
   */
  depletionMonth?: number;
}

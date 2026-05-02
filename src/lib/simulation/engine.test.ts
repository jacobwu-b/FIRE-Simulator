import { describe, it, expect } from 'vitest';
import { runMonthlyEngine } from './engine';
import type { SimParams, MonthState, WithdrawalDecision, Trajectory } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(overrides: Partial<SimParams> = {}): SimParams {
  return {
    initialPortfolio: 1_000_000,
    allocation: { us: 0.6, intl: 0.4 },
    horizonYears: 2,
    ...overrides,
  };
}

function zeroWithdrawal(): (_state: MonthState) => WithdrawalDecision {
  return () => ({ nominalAmount: 0 });
}

function constantWithdrawal(annual: number): (_state: MonthState) => WithdrawalDecision {
  return () => ({ nominalAmount: annual });
}

function flatArrays(months: number, value: number): number[] {
  return new Array(months).fill(value) as number[];
}

// ---------------------------------------------------------------------------
// Basic invariants
// ---------------------------------------------------------------------------

describe('runMonthlyEngine — zero return, zero withdrawal', () => {
  it('preserves nominal balance exactly across all months', () => {
    const months = 24;
    const params = makeParams({ horizonYears: 2 });
    const result = runMonthlyEngine(
      params,
      flatArrays(months, 0),
      flatArrays(months, 0),
      flatArrays(months, 0),
      zeroWithdrawal(),
    );

    expect(result.nominalBalance).toHaveLength(months);
    result.nominalBalance.forEach((b) => {
      expect(b).toBeCloseTo(1_000_000, 8);
    });
  });

  it('real balance equals nominal balance when inflation is zero', () => {
    const months = 24;
    const params = makeParams({ horizonYears: 2 });
    const result = runMonthlyEngine(
      params,
      flatArrays(months, 0),
      flatArrays(months, 0),
      flatArrays(months, 0),
      zeroWithdrawal(),
    );

    result.nominalBalance.forEach((nominal, t) => {
      expect(result.realBalance[t]).toBeCloseTo(nominal, 8);
    });
  });
});

// ---------------------------------------------------------------------------
// Constant return analytical verification
// ---------------------------------------------------------------------------

describe('runMonthlyEngine — constant return, no withdrawal', () => {
  it('balance after N months matches initial * (1+r)^N for a 100% US portfolio', () => {
    const r = 0.005; // 0.5% monthly
    const months = 24;
    const params = makeParams({
      horizonYears: 2,
      allocation: { us: 1.0, intl: 0.0 },
    });
    const result = runMonthlyEngine(
      params,
      flatArrays(months, r),
      flatArrays(months, 0),
      flatArrays(months, 0),
      zeroWithdrawal(),
    );

    const expected = 1_000_000 * Math.pow(1 + r, months);
    expect(result.nominalBalance[months - 1]).toBeCloseTo(expected, 2);
  });

  it('blended return: 60/40 us=1% intl=-1% yields net 0.2% per month', () => {
    const months = 12;
    const params = makeParams({
      horizonYears: 1,
      allocation: { us: 0.6, intl: 0.4 },
    });
    const result = runMonthlyEngine(
      params,
      flatArrays(months, 0.01),
      flatArrays(months, -0.01),
      flatArrays(months, 0),
      zeroWithdrawal(),
    );

    const netReturn = 0.6 * 0.01 + 0.4 * -0.01; // 0.002
    const expected = 1_000_000 * Math.pow(1 + netReturn, months);
    expect(result.nominalBalance[months - 1]).toBeCloseTo(expected, 2);
  });
});

// ---------------------------------------------------------------------------
// Withdrawal mechanics
// ---------------------------------------------------------------------------

describe('runMonthlyEngine — withdrawal deduction', () => {
  it('annual withdrawal sum equals 12 × monthly deduction with no rounding drift', () => {
    const annualWithdrawal = 40_000;
    const months = 12;
    const params = makeParams({ horizonYears: 1 });
    const result = runMonthlyEngine(
      params,
      flatArrays(months, 0),
      flatArrays(months, 0),
      flatArrays(months, 0),
      constantWithdrawal(annualWithdrawal),
    );

    // nominalWithdrawal[0] is the sum of the 12 monthly deductions
    expect(result.nominalWithdrawal[0]).toBeCloseTo(annualWithdrawal, 6);
  });

  it('final nominal balance reflects withdrawal from a zero-return portfolio', () => {
    const initial = 1_000_000;
    const annualWithdrawal = 120_000; // exactly 10_000/month
    const years = 5;
    const months = years * 12;
    const params = makeParams({ initialPortfolio: initial, horizonYears: years });
    const result = runMonthlyEngine(
      params,
      flatArrays(months, 0),
      flatArrays(months, 0),
      flatArrays(months, 0),
      constantWithdrawal(annualWithdrawal),
    );

    const expectedFinal = initial - annualWithdrawal * years;
    expect(result.nominalBalance[months - 1]).toBeCloseTo(expectedFinal, 2);
  });
});

// ---------------------------------------------------------------------------
// Depletion semantics
// ---------------------------------------------------------------------------

describe('runMonthlyEngine — depletion', () => {
  it('portfolio hits zero and never goes negative when withdrawal exceeds balance', () => {
    const months = 24;
    const params = makeParams({
      initialPortfolio: 10_000,
      horizonYears: 2,
    });
    // Withdraw 100_000/year → depletes in first year
    const result = runMonthlyEngine(
      params,
      flatArrays(months, 0),
      flatArrays(months, 0),
      flatArrays(months, 0),
      constantWithdrawal(100_000),
    );

    expect(result.survived).toBe(false);
    expect(result.depletionMonth).toBeDefined();
    // No negative balances anywhere
    result.nominalBalance.forEach((b) => {
      expect(b).toBeGreaterThanOrEqual(0);
    });
    // All months after depletion are zero
    const dm = result.depletionMonth as number;
    for (let t = dm; t < months; t++) {
      expect(result.nominalBalance[t]).toBe(0);
    }
  });

  it('survived is true when portfolio is positive at final month', () => {
    const months = 12;
    const params = makeParams({ horizonYears: 1 });
    const result = runMonthlyEngine(
      params,
      flatArrays(months, 0),
      flatArrays(months, 0),
      flatArrays(months, 0),
      zeroWithdrawal(),
    );

    expect(result.survived).toBe(true);
    expect(result.depletionMonth).toBeUndefined();
  });

  it('depletionMonth is undefined when portfolio survives the full horizon', () => {
    const months = 24;
    const params = makeParams({ horizonYears: 2 });
    const result = runMonthlyEngine(
      params,
      flatArrays(months, 0.005),
      flatArrays(months, 0.003),
      flatArrays(months, 0.002),
      constantWithdrawal(10_000),
    );

    expect(result.depletionMonth).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('runMonthlyEngine — determinism', () => {
  it('two runs with identical inputs produce bit-identical trajectories', () => {
    const months = 36;
    const params = makeParams({ horizonYears: 3 });
    const usReturns = Array.from({ length: months }, (_, i) => 0.003 + (i % 7) * 0.001);
    const intlReturns = Array.from({ length: months }, (_, i) => 0.002 - (i % 5) * 0.0005);
    const inflationArr = Array.from({ length: months }, (_, i) => 0.002 + (i % 3) * 0.001);
    const withdrawalFn = constantWithdrawal(48_000);

    const run1: Trajectory = runMonthlyEngine(params, usReturns, intlReturns, inflationArr, withdrawalFn);
    const run2: Trajectory = runMonthlyEngine(params, usReturns, intlReturns, inflationArr, withdrawalFn);

    expect(run1.nominalBalance).toEqual(run2.nominalBalance);
    expect(run1.realBalance).toEqual(run2.realBalance);
    expect(run1.cumulativeInflation).toEqual(run2.cumulativeInflation);
    expect(run1.nominalWithdrawal).toEqual(run2.nominalWithdrawal);
    expect(run1.realWithdrawal).toEqual(run2.realWithdrawal);
    expect(run1.survived).toBe(run2.survived);
    expect(run1.depletionMonth).toBe(run2.depletionMonth);
  });
});

// ---------------------------------------------------------------------------
// Real-dollar normalization
// ---------------------------------------------------------------------------

describe('runMonthlyEngine — real-dollar normalization', () => {
  it('real balance at month t equals nominal / cumulativeInflation at month t', () => {
    const months = 12;
    const params = makeParams({ horizonYears: 1 });
    const inflationRate = 0.004;
    const result = runMonthlyEngine(
      params,
      flatArrays(months, 0.005),
      flatArrays(months, 0.003),
      flatArrays(months, inflationRate),
      zeroWithdrawal(),
    );

    result.nominalBalance.forEach((nominal, t) => {
      expect(result.realBalance[t]).toBeCloseTo(nominal / result.cumulativeInflation[t], 10);
    });
  });

  it('cumulative inflation compounds correctly from a constant monthly rate', () => {
    const months = 12;
    const rate = 0.003;
    const params = makeParams({ horizonYears: 1 });
    const result = runMonthlyEngine(
      params,
      flatArrays(months, 0),
      flatArrays(months, 0),
      flatArrays(months, rate),
      zeroWithdrawal(),
    );

    result.cumulativeInflation.forEach((ci, t) => {
      expect(ci).toBeCloseTo(Math.pow(1 + rate, t + 1), 10);
    });
  });
});

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

describe('runMonthlyEngine — output array lengths', () => {
  it('all monthly arrays have length horizonYears * 12', () => {
    const years = 3;
    const months = years * 12;
    const params = makeParams({ horizonYears: years });
    const result = runMonthlyEngine(
      params,
      flatArrays(months, 0.004),
      flatArrays(months, 0.002),
      flatArrays(months, 0.003),
      constantWithdrawal(36_000),
    );

    expect(result.nominalBalance).toHaveLength(months);
    expect(result.realBalance).toHaveLength(months);
    expect(result.cumulativeInflation).toHaveLength(months);
  });

  it('annual withdrawal arrays have length horizonYears', () => {
    const years = 3;
    const months = years * 12;
    const params = makeParams({ horizonYears: years });
    const result = runMonthlyEngine(
      params,
      flatArrays(months, 0.004),
      flatArrays(months, 0.002),
      flatArrays(months, 0.003),
      constantWithdrawal(36_000),
    );

    expect(result.nominalWithdrawal).toHaveLength(years);
    expect(result.realWithdrawal).toHaveLength(years);
  });
});

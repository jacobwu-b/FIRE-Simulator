import { describe, it, expect } from 'vitest';
import { createRmd } from './rmd';
import type { MonthState } from '../simulation/types';

function makeState(overrides: Partial<MonthState> = {}): MonthState {
  return {
    monthIndex: 0,
    yearIndex: 0,
    monthOfYear: 0,
    nominalBalance: 1_000_000,
    realBalance: 1_000_000,
    cumulativeInflation: 1,
    ...overrides,
  };
}

describe('createRmd', () => {
  it('withdraws realBalance divided by remaining years in nominal terms (year 0)', () => {
    const fn = createRmd({ id: 'rmd', horizonYears: 30 });
    const state = makeState({
      yearIndex: 0,
      nominalBalance: 900_000,
      realBalance: 800_000,
      cumulativeInflation: 1.125,
    });
    // remainingYears = 30 - 0 = 30
    // realAnnual = 800_000 / 30
    // nominalAmount = (800_000 / 30) * 1.125
    const expected = (800_000 / 30) * 1.125;
    expect(fn(state).nominalAmount).toBeCloseTo(expected, 6);
  });

  it('withdraws realBalance divided by remaining years mid-horizon', () => {
    const fn = createRmd({ id: 'rmd', horizonYears: 30 });
    const state = makeState({
      yearIndex: 10,
      nominalBalance: 700_000,
      realBalance: 600_000,
      cumulativeInflation: 1.3,
    });
    // remainingYears = 30 - 10 = 20
    const expected = (600_000 / 20) * 1.3;
    expect(fn(state).nominalAmount).toBeCloseTo(expected, 6);
  });

  it('uses remainingYears of 1 on the final year to avoid division by zero', () => {
    const fn = createRmd({ id: 'rmd', horizonYears: 30 });
    const state = makeState({
      yearIndex: 30,
      nominalBalance: 50_000,
      realBalance: 40_000,
      cumulativeInflation: 1.5,
    });
    // remainingYears = max(1, 30 - 30) = 1
    const expected = (40_000 / 1) * 1.5;
    expect(fn(state).nominalAmount).toBeCloseTo(expected, 6);
  });

  it('returns 0 when portfolio is depleted', () => {
    const fn = createRmd({ id: 'rmd', horizonYears: 30 });
    const state = makeState({ nominalBalance: 0, realBalance: 0 });
    expect(fn(state).nominalAmount).toBe(0);
  });

  it('is deterministic — identical inputs produce identical output', () => {
    const fn = createRmd({ id: 'rmd', horizonYears: 40 });
    const state = makeState({
      yearIndex: 5,
      nominalBalance: 850_000,
      realBalance: 720_000,
      cumulativeInflation: 1.18,
    });
    expect(fn(state).nominalAmount).toBe(fn(state).nominalAmount);
  });
});

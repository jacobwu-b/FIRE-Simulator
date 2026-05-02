import { describe, it, expect } from 'vitest';
import { createFixedPct } from './fixed-percentage';
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

describe('createFixedPct', () => {
  it('withdraws rate * nominalBalance each year', () => {
    const fn = createFixedPct({ id: 'fixedPct', rate: 0.04 });
    const state = makeState({ nominalBalance: 800_000 });
    expect(fn(state).nominalAmount).toBeCloseTo(32_000, 6);
  });

  it('withdrawal scales correctly with a different rate', () => {
    const fn = createFixedPct({ id: 'fixedPct', rate: 0.035 });
    const state = makeState({ nominalBalance: 1_200_000 });
    expect(fn(state).nominalAmount).toBeCloseTo(42_000, 6);
  });

  it('withdraws 0 when portfolio is depleted', () => {
    const fn = createFixedPct({ id: 'fixedPct', rate: 0.04 });
    const state = makeState({ nominalBalance: 0 });
    expect(fn(state).nominalAmount).toBe(0);
  });

  it('is deterministic — identical inputs produce identical output', () => {
    const fn = createFixedPct({ id: 'fixedPct', rate: 0.05 });
    const state = makeState({ nominalBalance: 650_000 });
    expect(fn(state).nominalAmount).toBe(fn(state).nominalAmount);
  });
});

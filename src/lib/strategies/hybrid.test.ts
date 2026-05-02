import { describe, it, expect } from 'vitest';
import { createHybrid } from './hybrid';
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

const BASE_PARAMS = {
  id: 'hybrid' as const,
  initialPortfolio: 1_000_000,
  rate: 0.04,
  floorMultiplier: 0.8,
  ceilingMultiplier: 1.25,
};

// initialRealWithdrawal = 1_000_000 * 0.04 = 40_000

describe('createHybrid', () => {
  describe('unconstrained mid-band withdrawal', () => {
    it('returns rate * nominalBalance when inside floor and ceiling', () => {
      const fn = createHybrid(BASE_PARAMS);
      // cumInfl=1 → floor=32_000, ceiling=50_000; unconstrained=0.04*900_000=36_000 (inside band)
      const state = makeState({ nominalBalance: 900_000, cumulativeInflation: 1 });
      expect(fn(state).nominalAmount).toBeCloseTo(36_000, 6);
    });
  });

  describe('floor clamping', () => {
    it('clamps to floor when unconstrained falls below floorMultiplier * initialReal * cumInflation', () => {
      const fn = createHybrid(BASE_PARAMS);
      // cumInfl=1.2 → floor = 40_000 * 0.8 * 1.2 = 38_400
      // balance=600_000 → unconstrained = 0.04 * 600_000 = 24_000 (below floor)
      const state = makeState({ nominalBalance: 600_000, cumulativeInflation: 1.2 });
      expect(fn(state).nominalAmount).toBeCloseTo(38_400, 6);
    });
  });

  describe('ceiling clamping', () => {
    it('clamps to ceiling when unconstrained rises above ceilingMultiplier * initialReal * cumInflation', () => {
      const fn = createHybrid(BASE_PARAMS);
      // cumInfl=1.1 → ceiling = 40_000 * 1.25 * 1.1 = 55_000
      // balance=2_000_000 → unconstrained = 0.04 * 2_000_000 = 80_000 (above ceiling)
      const state = makeState({ nominalBalance: 2_000_000, cumulativeInflation: 1.1 });
      expect(fn(state).nominalAmount).toBeCloseTo(55_000, 6);
    });
  });

  describe('boundary conditions', () => {
    it('returns 0 when portfolio is depleted', () => {
      const fn = createHybrid(BASE_PARAMS);
      expect(fn(makeState({ nominalBalance: 0 })).nominalAmount).toBe(0);
    });
  });

  describe('determinism', () => {
    it('produces identical results for identical inputs', () => {
      const fn = createHybrid(BASE_PARAMS);
      const state = makeState({ nominalBalance: 850_000, cumulativeInflation: 1.15 });
      expect(fn(state).nominalAmount).toBe(fn(state).nominalAmount);
    });
  });
});

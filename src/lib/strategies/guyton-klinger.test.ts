import { describe, it, expect } from 'vitest';
import { createGk } from './guyton-klinger';
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

const BASE_PARAMS = { id: 'gk' as const, initialPortfolio: 1_000_000, initialRate: 0.04 };

describe('createGk', () => {
  describe('year 0 (first year)', () => {
    it('withdraws initialPortfolio * initialRate in year 0', () => {
      const fn = createGk(BASE_PARAMS);
      const result = fn(makeState({ yearIndex: 0, nominalBalance: 1_000_000 }));
      expect(result.nominalAmount).toBeCloseTo(40_000, 6);
    });
  });

  describe('prosperity rule', () => {
    it('raises withdrawal by 10% when current WR is 20%+ below initial', () => {
      const fn = createGk(BASE_PARAMS);
      // Year 0: baseline withdrawal = 40_000, cumInflation = 1
      fn(makeState({ yearIndex: 0, nominalBalance: 1_000_000, realBalance: 1_000_000, cumulativeInflation: 1 }));

      // Year 1: zero inflation (cumInflation stays 1) so the CPI bump is 0 and only the
      // prosperity rule fires. Portfolio has grown → WR = 40_000 / 2_000_000 = 2% < 4% initial;
      // wrRatio = 0.5 < 0.8 → prosperity rule: +10%.
      const result = fn(
        makeState({
          yearIndex: 1,
          nominalBalance: 2_000_000,
          realBalance: 2_000_000,
          cumulativeInflation: 1,
        }),
      );
      expect(result.nominalAmount).toBeCloseTo(40_000 * 1.1, 6);
    });
  });

  describe('capital-preservation rule', () => {
    it('cuts withdrawal by 10% when current WR is 20%+ above initial', () => {
      const fn = createGk(BASE_PARAMS);
      // Year 0
      fn(makeState({ yearIndex: 0, nominalBalance: 1_000_000, realBalance: 1_000_000 }));

      // Year 1: portfolio has dropped significantly → current WR = 40_000 / 400_000 = 10% (initial=4%)
      // wrRatio = 2.5, which is > 1.2 (1 + 0.2 guard band) → preservation rule fires
      const result = fn(
        makeState({
          yearIndex: 1,
          nominalBalance: 400_000,
          realBalance: 360_000,
          cumulativeInflation: 1.11,
        }),
      );
      expect(result.nominalAmount).toBeCloseTo(40_000 * 0.9, 6);
    });
  });

  describe('inflation freeze rule', () => {
    it('skips the CPI bump when it is a down year and WR exceeds initial rate', () => {
      const fn = createGk(BASE_PARAMS);
      // Year 0: baseline withdrawal = 40_000, cumInflation = 1
      fn(makeState({ yearIndex: 0, nominalBalance: 1_000_000, realBalance: 1_000_000, cumulativeInflation: 1 }));

      // Year 1: portfolio slightly down in real terms; WR slightly above initial;
      // balance is close enough to initial that guard bands do NOT fire (wrRatio ≈ 1.05),
      // but inflation would normally increase withdrawal by 3%.
      // cumInflation = 1.03 → annual inflation = 3%
      // currentWR = 40_000 / 950_000 ≈ 4.21% > 4% → inflationFrozen (down year + WR > initial)
      // Guard band check: wrRatio = 4.21%/4% = 1.05, inside ±20% band → no rule fires
      // Expected: withdrawal stays at 40_000 (no CPI bump, no guard-band adjustment)
      const result = fn(
        makeState({
          yearIndex: 1,
          nominalBalance: 950_000,
          realBalance: 920_000, // down from 1_000_000 → down year
          cumulativeInflation: 1.03,
        }),
      );
      expect(result.nominalAmount).toBeCloseTo(40_000, 6);
    });

    it('applies the CPI bump normally when it is NOT a down year', () => {
      const fn = createGk(BASE_PARAMS);
      // Year 0
      fn(makeState({ yearIndex: 0, nominalBalance: 1_000_000, realBalance: 1_000_000, cumulativeInflation: 1 }));

      // Year 1: portfolio UP in real terms; cumInflation = 1.03 → 3% annual inflation applied
      // nominalBalance = 1_000_000 → currentWR ≈ 4% (inside guard bands, no rule fires)
      // Expected: 40_000 * 1.03 = 41_200
      const result = fn(
        makeState({
          yearIndex: 1,
          nominalBalance: 1_000_000,
          realBalance: 1_050_000, // UP year
          cumulativeInflation: 1.03,
        }),
      );
      expect(result.nominalAmount).toBeCloseTo(40_000 * 1.03, 6);
    });
  });

  describe('boundary conditions', () => {
    it('returns 0 when portfolio is depleted', () => {
      const fn = createGk(BASE_PARAMS);
      expect(fn(makeState({ nominalBalance: 0, realBalance: 0 })).nominalAmount).toBe(0);
    });
  });

  describe('determinism', () => {
    it('produces identical results when called with identical inputs from identical state', () => {
      const fn1 = createGk(BASE_PARAMS);
      const fn2 = createGk(BASE_PARAMS);
      const s0 = makeState({ yearIndex: 0, nominalBalance: 1_000_000, realBalance: 1_000_000 });
      const s1 = makeState({
        yearIndex: 1,
        nominalBalance: 950_000,
        realBalance: 880_000,
        cumulativeInflation: 1.08,
      });
      // Advance both closures through year 0, then compare year 1
      fn1(s0);
      fn2(s0);
      expect(fn1(s1).nominalAmount).toBe(fn2(s1).nominalAmount);
    });
  });
});

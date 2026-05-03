import { describe, it, expect } from 'vitest';
import { runMonteCarlo } from './montecarlo';
import type { SimParams } from '../simulation/types';
import type { MarketDataset } from '../data/types';
import type { StrategyParams } from '../strategies/types';
import type { MonteCarloConfig } from '../montecarlo/types';

function makeDataset(
  months: number,
  usReturn: number,
  intlReturn: number,
  inflation: number,
): MarketDataset {
  return {
    usEquity: Array.from({ length: months }, (_, i) => ({
      date: `2000-${String((i % 12) + 1).padStart(2, '0')}`,
      value: usReturn,
    })),
    intlEquity: Array.from({ length: months }, (_, i) => ({
      date: `2000-${String((i % 12) + 1).padStart(2, '0')}`,
      value: intlReturn,
    })),
    cpi: Array.from({ length: months }, (_, i) => ({
      date: `2000-${String((i % 12) + 1).padStart(2, '0')}`,
      value: inflation,
    })),
    startDate: '2000-01',
    endDate: '2000-01',
  };
}

const BASE_PARAMS: SimParams = {
  initialPortfolio: 1_000_000,
  allocation: { us: 0.6, intl: 0.4 },
  horizonYears: 30,
};

const FIXED_PCT_STRATEGY: StrategyParams = {
  id: 'fixedPct',
  rate: 0.04,
};

const BASE_CONFIG: MonteCarloConfig = {
  pathCount: 50,
  seed: 42,
};

// Variable-return dataset so different bootstrap seeds produce different paths.
// Alternating values give known moments and ensure seed changes visibly alter paths.
function makeVariableDataset(months: number): MarketDataset {
  return {
    usEquity: Array.from({ length: months }, (_, i) => ({
      date: `2000-${String((i % 12) + 1).padStart(2, '0')}`,
      value: i % 2 === 0 ? 0.04 : -0.02,
    })),
    intlEquity: Array.from({ length: months }, (_, i) => ({
      date: `2000-${String((i % 12) + 1).padStart(2, '0')}`,
      value: i % 3 === 0 ? 0.03 : -0.01,
    })),
    cpi: Array.from({ length: months }, (_, i) => ({
      date: `2000-${String((i % 12) + 1).padStart(2, '0')}`,
      value: 0.003,
    })),
    startDate: '2000-01',
    endDate: '2000-01',
  };
}

// 30yr × 12 months + buffer so bootstrap has enough data to sample from
const DATASET = makeDataset(600, 0.007, 0.005, 0.003);
const VARIABLE_DATASET = makeVariableDataset(600);

describe('runMonteCarlo – determinism', () => {
  it('produces identical results for identical inputs and seed', () => {
    const a = runMonteCarlo(BASE_PARAMS, DATASET, FIXED_PCT_STRATEGY, BASE_CONFIG);
    const b = runMonteCarlo(BASE_PARAMS, DATASET, FIXED_PCT_STRATEGY, BASE_CONFIG);
    expect(a.endingRealValues).toEqual(b.endingRealValues);
    expect(a.survivalRate).toBe(b.survivalRate);
    expect(a.nominalWithdrawalsPerYear[0]).toEqual(b.nominalWithdrawalsPerYear[0]);
  });

  it('produces different ending-value distributions for different seeds', () => {
    const a = runMonteCarlo(BASE_PARAMS, VARIABLE_DATASET, FIXED_PCT_STRATEGY, { ...BASE_CONFIG, seed: 1 });
    const b = runMonteCarlo(BASE_PARAMS, VARIABLE_DATASET, FIXED_PCT_STRATEGY, { ...BASE_CONFIG, seed: 2 });
    expect(a.endingRealValues).not.toEqual(b.endingRealValues);
  });
});

describe('runMonteCarlo – output shapes', () => {
  it('pathCount matches config.pathCount', () => {
    const result = runMonteCarlo(BASE_PARAMS, DATASET, FIXED_PCT_STRATEGY, BASE_CONFIG);
    expect(result.pathCount).toBe(BASE_CONFIG.pathCount);
  });

  it('seed matches config.seed', () => {
    const result = runMonteCarlo(BASE_PARAMS, DATASET, FIXED_PCT_STRATEGY, BASE_CONFIG);
    expect(result.seed).toBe(BASE_CONFIG.seed);
  });

  it('endingNominalValues and endingRealValues have length pathCount', () => {
    const result = runMonteCarlo(BASE_PARAMS, DATASET, FIXED_PCT_STRATEGY, BASE_CONFIG);
    expect(result.endingNominalValues).toHaveLength(BASE_CONFIG.pathCount);
    expect(result.endingRealValues).toHaveLength(BASE_CONFIG.pathCount);
  });

  it('withdrawal arrays are shaped [horizonYears][pathCount]', () => {
    const result = runMonteCarlo(BASE_PARAMS, DATASET, FIXED_PCT_STRATEGY, BASE_CONFIG);
    expect(result.nominalWithdrawalsPerYear).toHaveLength(BASE_PARAMS.horizonYears);
    expect(result.realWithdrawalsPerYear).toHaveLength(BASE_PARAMS.horizonYears);
    for (let y = 0; y < BASE_PARAMS.horizonYears; y++) {
      expect(result.nominalWithdrawalsPerYear[y]).toHaveLength(BASE_CONFIG.pathCount);
      expect(result.realWithdrawalsPerYear[y]).toHaveLength(BASE_CONFIG.pathCount);
    }
  });

  it('sampled trajectory count does not exceed keepTrajectories', () => {
    const config: MonteCarloConfig = { ...BASE_CONFIG, pathCount: 500, keepTrajectories: 20 };
    const result = runMonteCarlo(BASE_PARAMS, DATASET, FIXED_PCT_STRATEGY, config);
    expect(result.trajectories.length).toBeLessThanOrEqual(20);
  });

  it('returns all trajectories when pathCount <= keepTrajectories', () => {
    const config: MonteCarloConfig = { ...BASE_CONFIG, pathCount: 10, keepTrajectories: 200 };
    const result = runMonteCarlo(BASE_PARAMS, DATASET, FIXED_PCT_STRATEGY, config);
    expect(result.trajectories).toHaveLength(10);
  });

  it('uses default keepTrajectories of 200 when not specified', () => {
    // pathCount > 200 so the cap should apply
    const config: MonteCarloConfig = { ...BASE_CONFIG, pathCount: 300 };
    const result = runMonteCarlo(BASE_PARAMS, DATASET, FIXED_PCT_STRATEGY, config);
    expect(result.trajectories.length).toBeLessThanOrEqual(200);
  });
});

describe('runMonteCarlo – survival rate', () => {
  it('survivalRate is a value in [0, 1]', () => {
    const result = runMonteCarlo(BASE_PARAMS, DATASET, FIXED_PCT_STRATEGY, BASE_CONFIG);
    expect(result.survivalRate).toBeGreaterThanOrEqual(0);
    expect(result.survivalRate).toBeLessThanOrEqual(1);
  });

  it('reports 1.0 survival rate when returns are strongly positive', () => {
    // ~1 % / month return with only 2 % annual withdrawal → always survives
    const dataset = makeDataset(600, 0.01, 0.01, 0.002);
    const strategy: StrategyParams = { id: 'fixedPct', rate: 0.02 };
    const result = runMonteCarlo(BASE_PARAMS, dataset, strategy, BASE_CONFIG);
    expect(result.survivalRate).toBe(1);
  });

  it('reports 0.0 survival rate when withdrawal rate guarantees depletion', () => {
    // GK with 50 % initial rate on a 0 % return dataset: fixed-dollar withdrawal
    // depletes the portfolio within ~2 years every path.
    const dataset = makeDataset(600, 0.0, 0.0, 0.0);
    const strategy: StrategyParams = {
      id: 'gk',
      initialPortfolio: BASE_PARAMS.initialPortfolio,
      initialRate: 0.5,
    };
    const result = runMonteCarlo(BASE_PARAMS, dataset, strategy, BASE_CONFIG);
    expect(result.survivalRate).toBe(0);
  });

  it('returns survivalRate 0 and empty arrays for pathCount 0', () => {
    const config: MonteCarloConfig = { ...BASE_CONFIG, pathCount: 0 };
    const result = runMonteCarlo(BASE_PARAMS, DATASET, FIXED_PCT_STRATEGY, config);
    expect(result.survivalRate).toBe(0);
    expect(result.endingNominalValues).toHaveLength(0);
    expect(result.trajectories).toHaveLength(0);
  });
});

describe('runMonteCarlo – strategy isolation', () => {
  it('each path gets a fresh strategy closure so stateful strategies are independent', () => {
    const gkStrategy: StrategyParams = {
      id: 'gk',
      initialPortfolio: BASE_PARAMS.initialPortfolio,
      initialRate: 0.04,
    };
    // If state leaked between paths, year-0 withdrawals would drift across paths.
    // Flat-return dataset means all paths should produce the same year-0 withdrawal.
    const dataset = makeDataset(600, 0.005, 0.005, 0.002);
    const config: MonteCarloConfig = { pathCount: 10, seed: 1 };
    const result = runMonteCarlo(BASE_PARAMS, dataset, gkStrategy, config);
    const year0 = result.nominalWithdrawalsPerYear[0];
    // All 10 paths share the same flat return data (because we bootstrap from a
    // constant dataset), so year-0 withdrawals should be identical.
    for (const w of year0) {
      expect(w).toBeCloseTo(year0[0], 4);
    }
  });
});

describe('runMonteCarlo – integration with fixed-percentage strategy', () => {
  it('produces finite, non-negative ending values for all paths', () => {
    const config: MonteCarloConfig = { pathCount: 100, seed: 7 };
    const result = runMonteCarlo(BASE_PARAMS, DATASET, FIXED_PCT_STRATEGY, config);
    for (const v of result.endingNominalValues) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    for (const v of result.endingRealValues) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { runHistorical } from './historical';
import type { SimParams } from '../simulation/types';
import type { MarketDataset } from '../data/types';
import type { StrategyParams } from '../strategies/types';

function makeDataset(months: number, usReturn: number, intlReturn: number, inflation: number): MarketDataset {
  const usEquity = Array.from({ length: months }, (_, i) => ({
    date: `2000-${String((i % 12) + 1).padStart(2, '0')}`,
    value: usReturn,
  }));
  const intlEquity = Array.from({ length: months }, (_, i) => ({
    date: `2000-${String((i % 12) + 1).padStart(2, '0')}`,
    value: intlReturn,
  }));
  const cpi = Array.from({ length: months }, (_, i) => ({
    date: `2000-${String((i % 12) + 1).padStart(2, '0')}`,
    value: inflation,
  }));
  return {
    usEquity,
    intlEquity,
    cpi,
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

describe('runHistorical – period count', () => {
  it('counts the correct number of rolling periods for a dataset with exactly one valid start', () => {
    const horizonMonths = BASE_PARAMS.horizonYears * 12;
    const dataset = makeDataset(horizonMonths, 0.005, 0.004, 0.002);
    const result = runHistorical(BASE_PARAMS, dataset, FIXED_PCT_STRATEGY);
    expect(result.periodCount).toBe(1);
  });

  it('counts N - horizonMonths + 1 rolling periods for a dataset with extra months', () => {
    const horizonMonths = BASE_PARAMS.horizonYears * 12;
    const extraMonths = 24;
    const dataset = makeDataset(horizonMonths + extraMonths, 0.005, 0.004, 0.002);
    const result = runHistorical(BASE_PARAMS, dataset, FIXED_PCT_STRATEGY);
    expect(result.periodCount).toBe(extraMonths + 1);
  });

  it('returns zero periods when the dataset is shorter than the horizon', () => {
    const horizonMonths = BASE_PARAMS.horizonYears * 12;
    const dataset = makeDataset(horizonMonths - 1, 0.005, 0.004, 0.002);
    const result = runHistorical(BASE_PARAMS, dataset, FIXED_PCT_STRATEGY);
    expect(result.periodCount).toBe(0);
    expect(result.survivalRate).toBe(0);
  });
});

describe('runHistorical – survival rate', () => {
  it('reports 100 % survival on a dataset with strongly positive returns', () => {
    const horizonMonths = BASE_PARAMS.horizonYears * 12;
    // ~1 % per month return, 2 % annual withdrawal → portfolio grows throughout
    const dataset = makeDataset(horizonMonths + 12, 0.01, 0.01, 0.002);
    const strategy: StrategyParams = { id: 'fixedPct', rate: 0.02 };
    const result = runHistorical(BASE_PARAMS, dataset, strategy);
    expect(result.survivalRate).toBe(1);
    expect(result.trajectories.every((t) => t.survived)).toBe(true);
  });

  it('reports 0 % survival when using a GK strategy with an unsustainable 50 % initial rate', () => {
    const horizonMonths = BASE_PARAMS.horizonYears * 12;
    // Flat 0 % returns + 50 % annual withdrawal → depletes within a few years in every period
    const dataset = makeDataset(horizonMonths + 12, 0.0, 0.0, 0.0);
    const strategy: StrategyParams = {
      id: 'gk',
      initialPortfolio: BASE_PARAMS.initialPortfolio,
      initialRate: 0.5,
    };
    const result = runHistorical(BASE_PARAMS, dataset, strategy);
    expect(result.survivalRate).toBe(0);
    expect(result.trajectories.every((t) => !t.survived)).toBe(true);
  });
});

describe('runHistorical – output shapes', () => {
  it('produces startDates, endingValues, and withdrawal arrays with length equal to periodCount', () => {
    const horizonMonths = BASE_PARAMS.horizonYears * 12;
    const dataset = makeDataset(horizonMonths + 5, 0.005, 0.004, 0.002);
    const result = runHistorical(BASE_PARAMS, dataset, FIXED_PCT_STRATEGY);
    const { periodCount } = result;

    expect(result.startDates).toHaveLength(periodCount);
    expect(result.endingNominalValues).toHaveLength(periodCount);
    expect(result.endingRealValues).toHaveLength(periodCount);
    expect(result.trajectories).toHaveLength(periodCount);
    expect(result.nominalWithdrawalsPerYear).toHaveLength(BASE_PARAMS.horizonYears);
    expect(result.realWithdrawalsPerYear).toHaveLength(BASE_PARAMS.horizonYears);
    for (let y = 0; y < BASE_PARAMS.horizonYears; y++) {
      expect(result.nominalWithdrawalsPerYear[y]).toHaveLength(periodCount);
      expect(result.realWithdrawalsPerYear[y]).toHaveLength(periodCount);
    }
  });

  it('uses a fresh strategy closure for each period so stateful strategies are independent', () => {
    const horizonMonths = BASE_PARAMS.horizonYears * 12;
    // Use a Guyton-Klinger strategy whose state must not bleed between periods
    const dataset = makeDataset(horizonMonths + 2, 0.005, 0.004, 0.002);
    const gkStrategy: StrategyParams = {
      id: 'gk',
      initialPortfolio: BASE_PARAMS.initialPortfolio,
      initialRate: 0.04,
    };
    const result = runHistorical(BASE_PARAMS, dataset, gkStrategy);
    // Both periods start from the same initial state, so year-0 withdrawals must be equal
    expect(result.nominalWithdrawalsPerYear[0][0]).toBeCloseTo(
      result.nominalWithdrawalsPerYear[0][1],
      6,
    );
  });
});

describe('runHistorical – depletion details', () => {
  // GK at 50 % initial rate with 0 % returns guarantees depletion in every period
  const depletionStrategy: StrategyParams = {
    id: 'gk',
    initialPortfolio: BASE_PARAMS.initialPortfolio,
    initialRate: 0.5,
  };

  it('records a depletionMonth for each trajectory that did not survive', () => {
    const horizonMonths = BASE_PARAMS.horizonYears * 12;
    const dataset = makeDataset(horizonMonths + 3, 0.0, 0.0, 0.0);
    const result = runHistorical(BASE_PARAMS, dataset, depletionStrategy);
    for (const t of result.trajectories) {
      expect(t.depletionMonth).toBeDefined();
    }
  });

  it('ending nominal values are zero for all depleted periods', () => {
    const horizonMonths = BASE_PARAMS.horizonYears * 12;
    const dataset = makeDataset(horizonMonths + 2, 0.0, 0.0, 0.0);
    const result = runHistorical(BASE_PARAMS, dataset, depletionStrategy);
    for (const v of result.endingNominalValues) {
      expect(v).toBe(0);
    }
  });
});

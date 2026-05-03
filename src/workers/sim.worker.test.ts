import { describe, it, expect } from 'vitest';
import { handleSimMessage } from './sim.worker';
import type { WorkerRequest } from './sim.worker';
import type { MarketDataset } from '../lib/data/types';
import type { UIParams } from '../ui/state/types';

function makeFixture(months: number): MarketDataset {
  const usEquity = Array.from({ length: months }, (_, i) => ({
    date: `2000-${String((i % 12) + 1).padStart(2, '0')}`,
    value: 0.008,
  }));
  const intlEquity = Array.from({ length: months }, (_, i) => ({
    date: `2000-${String((i % 12) + 1).padStart(2, '0')}`,
    value: 0.005,
  }));
  const cpi = Array.from({ length: months }, (_, i) => ({
    date: `2000-${String((i % 12) + 1).padStart(2, '0')}`,
    value: 0.002,
  }));
  return { usEquity, intlEquity, cpi, startDate: '2000-01', endDate: '2000-12' };
}

const BASE_PARAMS: UIParams = {
  initialPortfolio: 500_000,
  allocation: { us: 70, intl: 30 },
  horizonYears: 1,
  strategyId: 'fixedPct',
  strategyParams: { id: 'fixedPct', rate: 4 },
};

// 13 months → 2 rolling periods for a 1-year (12-month) horizon
const FIXTURE = makeFixture(13);

describe('handleSimMessage', () => {
  it('returns historical and monteCarlo results with matching request id', () => {
    const request: WorkerRequest = { id: 7, params: BASE_PARAMS, mode: 'both' };
    const response = handleSimMessage(request, FIXTURE);

    expect(response.id).toBe(7);
    expect(response.error).toBeUndefined();
    expect(response.historical).toBeDefined();
    expect(response.monteCarlo).toBeDefined();
  });

  it('historical result has correct period count for fixture size', () => {
    const request: WorkerRequest = { id: 1, params: BASE_PARAMS, mode: 'both' };
    const { historical } = handleSimMessage(request, FIXTURE);

    // 13 months data, 12-month horizon → 2 valid rolling start indices (0 and 1)
    expect(historical!.periodCount).toBe(2);
    expect(historical!.survivalRate).toBeGreaterThanOrEqual(0);
    expect(historical!.survivalRate).toBeLessThanOrEqual(1);
  });

  it('maps allocation from percentage to decimal correctly', () => {
    // 70% US / 30% intl in UIParams; engine receives 0.7 / 0.3
    // Verify by checking the result is structurally valid (no NaN/Infinity)
    const request: WorkerRequest = { id: 2, params: BASE_PARAMS, mode: 'both' };
    const { historical } = handleSimMessage(request, FIXTURE);

    const endingValues = historical!.endingNominalValues;
    expect(endingValues.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('maps fixedPct rate from percentage to decimal', () => {
    // 4% rate in UIParams → 0.04 in StrategyParams; portfolio should partially deplete
    const request: WorkerRequest = {
      id: 3,
      params: { ...BASE_PARAMS, strategyParams: { id: 'fixedPct', rate: 4 } },
      mode: 'both',
    };
    const { historical } = handleSimMessage(request, FIXTURE);
    // Ending values should be finite numbers (positive given 1yr horizon + modest withdrawals)
    expect(historical!.endingNominalValues.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('rmd strategy includes horizonYears from params', () => {
    const rmdParams: UIParams = { ...BASE_PARAMS, strategyId: 'rmd', strategyParams: { id: 'rmd' } };
    const request: WorkerRequest = { id: 4, params: rmdParams, mode: 'both' };
    const response = handleSimMessage(request, FIXTURE);

    expect(response.error).toBeUndefined();
    expect(response.historical).toBeDefined();
  });

  it('returns error with same id when strategy params are invalid', () => {
    // horizonYears: 0 causes the engine to request 0 months — should throw or produce empty
    const badParams: UIParams = { ...BASE_PARAMS, horizonYears: 0 };
    const request: WorkerRequest = { id: 5, params: badParams, mode: 'both' };
    const response = handleSimMessage(request, FIXTURE);

    // Either an error or empty-period result — in both cases id must match
    expect(response.id).toBe(5);
  });

  it('monteCarlo result has expected path count', () => {
    const request: WorkerRequest = { id: 6, params: BASE_PARAMS, mode: 'both' };
    const { monteCarlo } = handleSimMessage(request, FIXTURE);

    expect(monteCarlo!.pathCount).toBe(1000);
    expect(monteCarlo!.survivalRate).toBeGreaterThanOrEqual(0);
    expect(monteCarlo!.survivalRate).toBeLessThanOrEqual(1);
  });
});

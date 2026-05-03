import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompareView } from './CompareView';
import { withdrawalYDomain } from './WithdrawalDistribution';
import { unionDomain } from '../../lib/viz/histogram';
import type { HistoricalResult } from '../../lib/runners/historical';
import type { MonteCarloResult } from '../../lib/montecarlo/types';

// ─── Shared-axis helpers ──────────────────────────────────────────────────────

describe('unionDomain for ending wealth', () => {
  it('spans both historical and MC value ranges', () => {
    const [min, max] = unionDomain([[100, 500, 900], [200, 1000]]);
    expect(min).toBe(100);
    expect(max).toBe(1000);
  });

  it('handles one set with all zeros', () => {
    const [min, max] = unionDomain([[0, 0, 0], [500, 1500]]);
    expect(min).toBe(0);
    expect(max).toBe(1500);
  });
});

describe('withdrawalYDomain', () => {
  it('returns global min and max across all years and scenarios', () => {
    const data: number[][] = [
      [10_000, 20_000, 5_000],
      [15_000, 40_000, 3_000],
    ];
    const [min, max] = withdrawalYDomain(data);
    expect(min).toBe(3_000);
    expect(max).toBe(40_000);
  });

  it('returns [0, 0] for empty input', () => {
    expect(withdrawalYDomain([])).toEqual([0, 0]);
  });

  it('returns [0, 0] when all inner arrays are empty', () => {
    expect(withdrawalYDomain([[], []])).toEqual([0, 0]);
  });
});

// ─── CompareView rendering ────────────────────────────────────────────────────

function makeHistorical(overrides: Partial<HistoricalResult> = {}): HistoricalResult {
  const horizonYears = 3;
  const periodCount = 5;
  return {
    periodCount,
    survivalRate: 0.8,
    startDates: ['2000-01', '2001-01', '2002-01', '2003-01', '2004-01'],
    endingNominalValues: [800_000, 900_000, 1_000_000, 700_000, 1_100_000],
    endingRealValues: [750_000, 850_000, 950_000, 650_000, 1_050_000],
    nominalWithdrawalsPerYear: Array.from({ length: horizonYears }, () =>
      Array.from({ length: periodCount }, () => 40_000),
    ),
    realWithdrawalsPerYear: Array.from({ length: horizonYears }, () =>
      Array.from({ length: periodCount }, () => 38_000),
    ),
    trajectories: [],
    metrics: {
      trajectoryCount: periodCount,
      survivalRate: 0.8,
      endingRealValue: { mean: 850_000, median: 850_000, p10: 650_000, p25: 750_000, p75: 950_000, p90: 1_050_000 },
      realWithdrawal: { mean: 38_000, median: 38_000, variance: 0 },
      failureYearDistribution: {},
      meanMaxDrawdown: 0.1,
      medianMaxDrawdown: 0.1,
    },
    ...overrides,
  };
}

function makeMonteCarlo(overrides: Partial<MonteCarloResult> = {}): MonteCarloResult {
  const horizonYears = 3;
  const pathCount = 5;
  return {
    pathCount,
    seed: 42,
    survivalRate: 0.9,
    endingNominalValues: [900_000, 1_100_000, 1_200_000, 800_000, 1_300_000],
    endingRealValues: [850_000, 1_050_000, 1_150_000, 750_000, 1_250_000],
    nominalWithdrawalsPerYear: Array.from({ length: horizonYears }, () =>
      Array.from({ length: pathCount }, () => 42_000),
    ),
    realWithdrawalsPerYear: Array.from({ length: horizonYears }, () =>
      Array.from({ length: pathCount }, () => 40_000),
    ),
    trajectories: [],
    metrics: {
      trajectoryCount: pathCount,
      survivalRate: 0.9,
      endingRealValue: { mean: 1_010_000, median: 1_050_000, p10: 750_000, p25: 850_000, p75: 1_150_000, p90: 1_250_000 },
      realWithdrawal: { mean: 40_000, median: 40_000, variance: 0 },
      failureYearDistribution: {},
      meanMaxDrawdown: 0.08,
      medianMaxDrawdown: 0.08,
    },
    ...overrides,
  };
}

describe('CompareView', () => {
  it('renders section headings for both chart types', () => {
    render(<CompareView historical={makeHistorical()} monteCarlo={makeMonteCarlo()} />);
    expect(screen.getByText('Ending Wealth Distribution')).toBeTruthy();
    expect(screen.getByText(/Annual Withdrawal/)).toBeTruthy();
  });

  it('renders four chart titles: Historical and Monte Carlo for each section', () => {
    render(<CompareView historical={makeHistorical()} monteCarlo={makeMonteCarlo()} />);
    const historicalTitles = screen.getAllByText('Historical');
    const mcTitles = screen.getAllByText('Monte Carlo');
    expect(historicalTitles.length).toBeGreaterThanOrEqual(2);
    expect(mcTitles.length).toBeGreaterThanOrEqual(2);
  });

  it('renders empty-state gracefully when both datasets have no values', () => {
    const emptyHistorical = makeHistorical({ endingRealValues: [], realWithdrawalsPerYear: [] });
    const emptyMC = makeMonteCarlo({ endingRealValues: [], realWithdrawalsPerYear: [] });
    render(<CompareView historical={emptyHistorical} monteCarlo={emptyMC} />);
    const emptyMessages = screen.getAllByText('No data available.');
    expect(emptyMessages.length).toBeGreaterThanOrEqual(2);
  });
});

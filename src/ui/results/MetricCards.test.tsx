import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatDollars, formatPct, MetricCards } from './MetricCards';
import type { AggregateMetrics } from '../../lib/metrics/aggregate';

// ─── formatDollars ────────────────────────────────────────────────────────────

describe('formatDollars', () => {
  it('formats millions with two decimal places', () => {
    expect(formatDollars(1_500_000)).toBe('$1.50M');
    expect(formatDollars(2_340_000)).toBe('$2.34M');
  });

  it('formats exact millions without rounding artifacts', () => {
    expect(formatDollars(1_000_000)).toBe('$1.00M');
  });

  it('formats thousands with no decimal places', () => {
    expect(formatDollars(750_000)).toBe('$750K');
    expect(formatDollars(1_000)).toBe('$1K');
  });

  it('formats sub-thousand values as whole dollars', () => {
    expect(formatDollars(500)).toBe('$500');
    expect(formatDollars(0)).toBe('$0');
  });

  it('handles negative values correctly', () => {
    expect(formatDollars(-1_200_000)).toBe('$-1.20M');
    expect(formatDollars(-500_000)).toBe('$-500K');
  });
});

// ─── formatPct ────────────────────────────────────────────────────────────────

describe('formatPct', () => {
  it('formats a fraction as a percentage with one decimal', () => {
    expect(formatPct(0.735)).toBe('73.5%');
    expect(formatPct(1)).toBe('100.0%');
    expect(formatPct(0)).toBe('0.0%');
  });

  it('rounds to one decimal place', () => {
    expect(formatPct(0.3333)).toBe('33.3%');
    expect(formatPct(0.6667)).toBe('66.7%');
  });
});

// ─── MetricCards rendering ────────────────────────────────────────────────────

function makeMetrics(overrides: Partial<AggregateMetrics> = {}): AggregateMetrics {
  return {
    trajectoryCount: 100,
    survivalRate: 0.85,
    endingRealValue: { mean: 1_200_000, median: 1_050_000, p10: 400_000, p25: 700_000, p75: 1_500_000, p90: 2_000_000 },
    realWithdrawal: { mean: 42_000, median: 40_000, variance: 0 },
    failureYearDistribution: {},
    meanMaxDrawdown: 0.32,
    medianMaxDrawdown: 0.28,
    ...overrides,
  };
}

describe('MetricCards', () => {
  it('renders section headings for historical and monte carlo', () => {
    render(<MetricCards historical={makeMetrics()} monteCarlo={makeMetrics()} />);
    expect(screen.getByText('Historical')).toBeDefined();
    expect(screen.getByText('Monte Carlo')).toBeDefined();
  });

  it('renders formatted survival rate', () => {
    render(<MetricCards historical={makeMetrics({ survivalRate: 0.734 })} monteCarlo={makeMetrics()} />);
    expect(screen.getAllByText('73.4%').length).toBeGreaterThanOrEqual(1);
  });

  it('renders formatted median ending value in millions', () => {
    render(<MetricCards historical={makeMetrics()} monteCarlo={makeMetrics()} />);
    // median is 1_050_000 → $1.05M
    expect(screen.getAllByText('$1.05M').length).toBeGreaterThanOrEqual(1);
  });

  it('renders mean annual withdrawal', () => {
    render(<MetricCards historical={makeMetrics()} monteCarlo={makeMetrics()} />);
    // mean withdrawal 42_000 → $42K
    expect(screen.getAllByText('$42K').length).toBeGreaterThanOrEqual(1);
  });

  it('renders median max drawdown as percentage', () => {
    render(<MetricCards historical={makeMetrics()} monteCarlo={makeMetrics()} />);
    // medianMaxDrawdown 0.28 → 28.0%
    expect(screen.getAllByText('28.0%').length).toBeGreaterThanOrEqual(1);
  });

  it('shows zeroed values when metrics are empty (survival rate 0)', () => {
    const empty = makeMetrics({
      survivalRate: 0,
      endingRealValue: { mean: 0, median: 0, p10: 0, p25: 0, p75: 0, p90: 0 },
      realWithdrawal: { mean: 0, median: 0, variance: 0 },
      medianMaxDrawdown: 0,
    });
    render(<MetricCards historical={empty} monteCarlo={empty} />);
    expect(screen.getAllByText('0.0%').length).toBeGreaterThanOrEqual(1);
  });
});

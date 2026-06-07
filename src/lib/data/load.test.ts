import { describe, it, expect, vi } from 'vitest';
import type { DataFile, MonthlyReturn, MonthlyInflation } from './types';

// ---------------------------------------------------------------------------
// Helpers to build minimal well-formed fixtures
// ---------------------------------------------------------------------------

function makeReturnSeries(start: string, count: number): MonthlyReturn[] {
  const result: MonthlyReturn[] = [];
  let [y, m] = start.split('-').map(Number);
  for (let i = 0; i < count; i++) {
    result.push({ date: `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}`, value: 0.01 * (i % 5) });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

function makeInflationSeries(start: string, count: number): MonthlyInflation[] {
  return makeReturnSeries(start, count).map(({ date }) => ({ date, value: 0.003 }));
}

function makeFile<T>(series: T[]): DataFile<T> {
  return {
    metadata: {
      source: 'test',
      description: 'test fixture',
      retrieved: '2026-01-01',
      license: 'test',
      frequency: 'monthly',
      units: 'decimal_return',
    },
    series,
  };
}

// ---------------------------------------------------------------------------
// Test setup: mock the JSON imports so we control fixture data
// ---------------------------------------------------------------------------

const fixtures = {
  us: null as DataFile<MonthlyReturn> | null,
  intl: null as DataFile<MonthlyReturn> | null,
  cpi: null as DataFile<MonthlyInflation> | null,
};

function setFixtures(
  us: MonthlyReturn[],
  intl: MonthlyReturn[],
  cpi: MonthlyInflation[],
) {
  fixtures.us = makeFile(us);
  fixtures.intl = makeFile(intl);
  fixtures.cpi = makeFile(cpi);
}

// Because the module caches imports, we reimport fresh each time.
async function freshLoad() {
  vi.resetModules();
  vi.doMock('../../data/us-equity-monthly.json', () => ({ default: fixtures.us }));
  vi.doMock('../../data/intl-equity-monthly.json', () => ({ default: fixtures.intl }));
  vi.doMock('../../data/cpi-monthly.json', () => ({ default: fixtures.cpi }));
  const { loadMarketData } = await import('./load');
  return loadMarketData;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('loadMarketData — basic shape', () => {
  it('returns aligned arrays covering the intersection of all three series', async () => {
    // US equity: 1990-01 to 1990-12  (12 months)
    // Intl equity: 1990-03 to 1991-06 (16 months, starts later)
    // CPI: 1989-01 to 1990-10         (22 months, ends earlier)
    // Intersection: 1990-03 to 1990-10 = 8 months

    setFixtures(
      makeReturnSeries('1990-01', 12),
      makeReturnSeries('1990-03', 16),
      makeInflationSeries('1989-01', 22),
    );
    const loadMarketData = await freshLoad();
    const dataset = loadMarketData();

    expect(dataset.startDate).toBe('1990-03');
    expect(dataset.endDate).toBe('1990-10');
    expect(dataset.usEquity).toHaveLength(8);
    expect(dataset.intlEquity).toHaveLength(8);
    expect(dataset.cpi).toHaveLength(8);
  });

  it('all three aligned arrays share the same date sequence', async () => {
    setFixtures(
      makeReturnSeries('1990-01', 24),
      makeReturnSeries('1990-01', 24),
      makeInflationSeries('1990-01', 24),
    );
    const loadMarketData = await freshLoad();
    const { usEquity, intlEquity, cpi } = loadMarketData();

    const usDates = usEquity.map((r) => r.date);
    const intlDates = intlEquity.map((r) => r.date);
    const cpiDates = cpi.map((r) => r.date);

    expect(usDates).toEqual(intlDates);
    expect(usDates).toEqual(cpiDates);
  });

  it('returned dates are sorted ascending', async () => {
    setFixtures(
      makeReturnSeries('2000-06', 36),
      makeReturnSeries('2000-06', 36),
      makeInflationSeries('2000-06', 36),
    );
    const loadMarketData = await freshLoad();
    const { usEquity } = loadMarketData();

    const dates = usEquity.map((r) => r.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('every value in the returned dataset is finite', async () => {
    setFixtures(
      makeReturnSeries('1995-01', 12),
      makeReturnSeries('1995-01', 12),
      makeInflationSeries('1995-01', 12),
    );
    const loadMarketData = await freshLoad();
    const { usEquity, intlEquity, cpi } = loadMarketData();

    const allValues = [
      ...usEquity.map((r) => r.value),
      ...intlEquity.map((r) => r.value),
      ...cpi.map((r) => r.value),
    ];
    expect(allValues.every(Number.isFinite)).toBe(true);
  });
});

describe('loadMarketData — gap detection', () => {
  it('throws when US equity series has a missing month', async () => {
    const us = makeReturnSeries('1990-01', 12);
    us.splice(5, 1); // remove month index 5 → creates a gap

    setFixtures(us, makeReturnSeries('1990-01', 12), makeInflationSeries('1990-01', 12));
    const loadMarketData = await freshLoad();

    expect(() => loadMarketData()).toThrow(/us-equity.*gap|us-equity.*mis-order/i);
  });

  it('throws when international equity series has a missing month', async () => {
    const intl = makeReturnSeries('1990-01', 12);
    intl.splice(3, 1);

    setFixtures(makeReturnSeries('1990-01', 12), intl, makeInflationSeries('1990-01', 12));
    const loadMarketData = await freshLoad();

    expect(() => loadMarketData()).toThrow(/intl-equity.*gap|intl-equity.*mis-order/i);
  });

  it('throws when CPI series has a missing month', async () => {
    const cpi = makeInflationSeries('1990-01', 12);
    cpi.splice(7, 1);

    setFixtures(makeReturnSeries('1990-01', 12), makeReturnSeries('1990-01', 12), cpi);
    const loadMarketData = await freshLoad();

    expect(() => loadMarketData()).toThrow(/cpi.*gap|cpi.*mis-order/i);
  });
});

describe('loadMarketData — misalignment errors', () => {
  it('throws when series do not overlap at all', async () => {
    setFixtures(
      makeReturnSeries('1990-01', 6),   // ends 1990-06
      makeReturnSeries('1991-01', 6),   // starts 1991-01
      makeInflationSeries('1990-01', 24),
    );
    const loadMarketData = await freshLoad();

    expect(() => loadMarketData()).toThrow(/no overlapping date range/i);
  });

  it('throws when a series is empty', async () => {
    setFixtures([], makeReturnSeries('1990-01', 6), makeInflationSeries('1990-01', 6));
    const loadMarketData = await freshLoad();

    expect(() => loadMarketData()).toThrow(/empty/i);
  });

  it('throws when a value is NaN', async () => {
    const us = makeReturnSeries('1990-01', 6);
    us[2] = { date: us[2].date, value: NaN };

    setFixtures(us, makeReturnSeries('1990-01', 6), makeInflationSeries('1990-01', 6));
    const loadMarketData = await freshLoad();

    expect(() => loadMarketData()).toThrow(/not finite/i);
  });
});

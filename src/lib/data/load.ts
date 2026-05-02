import usEquityRaw from '../../data/us-equity-monthly.json';
import intlEquityRaw from '../../data/intl-equity-monthly.json';
import cpiRaw from '../../data/cpi-monthly.json';
import type { DataFile, MarketDataset, MonthlyInflation, MonthlyReturn } from './types';

type RawReturn = { date: string; value: number };
type RawInflation = { date: string; value: number };

function nextYm(ym: string): string {
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(5, 7), 10);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny.toString().padStart(4, '0')}-${nm.toString().padStart(2, '0')}`;
}

function validateSeries(name: string, series: RawReturn[] | RawInflation[]): void {
  if (series.length === 0) {
    throw new Error(`${name}: series is empty`);
  }

  for (let i = 0; i < series.length; i++) {
    const { date, value } = series[i];

    if (!/^\d{4}-\d{2}$/.test(date)) {
      throw new Error(`${name}[${i}]: invalid date format "${date}"`);
    }

    if (!Number.isFinite(value)) {
      throw new Error(`${name}[${i}] (${date}): value is not finite (got ${value})`);
    }

    if (i > 0 && date !== nextYm(series[i - 1].date)) {
      throw new Error(
        `${name}: gap or mis-order at index ${i} — expected ${nextYm(series[i - 1].date)}, got "${date}"`,
      );
    }
  }
}

/**
 * Load and align the three bundled monthly data series.
 *
 * Validates each series independently (monotonic, no gaps, finite values),
 * then clips all three to their common date range.
 * Throws if any series is invalid or if the intersection is empty.
 */
export function loadMarketData(): MarketDataset {
  const usFile = usEquityRaw as unknown as DataFile<RawReturn>;
  const intlFile = intlEquityRaw as unknown as DataFile<RawReturn>;
  const cpiFile = cpiRaw as unknown as DataFile<RawInflation>;

  validateSeries('us-equity', usFile.series);
  validateSeries('intl-equity', intlFile.series);
  validateSeries('cpi', cpiFile.series);

  const startDate = [
    usFile.series[0].date,
    intlFile.series[0].date,
    cpiFile.series[0].date,
  ].sort().at(-1)!; // max of three starts

  const endDate = [
    usFile.series.at(-1)!.date,
    intlFile.series.at(-1)!.date,
    cpiFile.series.at(-1)!.date,
  ].sort()[0]; // min of three ends

  if (endDate < startDate) {
    throw new Error(
      `loadMarketData: no overlapping date range (startDate=${startDate}, endDate=${endDate})`,
    );
  }

  function clip<T extends { date: string }>(series: T[]): T[] {
    return series.filter((r) => r.date >= startDate && r.date <= endDate);
  }

  const usEquity: MonthlyReturn[] = clip(usFile.series);
  const intlEquity: MonthlyReturn[] = clip(intlFile.series);
  const cpi: MonthlyInflation[] = clip(cpiFile.series);

  if (usEquity.length !== intlEquity.length || usEquity.length !== cpi.length) {
    throw new Error(
      `loadMarketData: clipped series lengths differ — us=${usEquity.length}, intl=${intlEquity.length}, cpi=${cpi.length}`,
    );
  }

  return { usEquity, intlEquity, cpi, startDate, endDate };
}

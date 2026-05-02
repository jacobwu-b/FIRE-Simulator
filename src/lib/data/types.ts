/**
 * One month of total equity return.
 * `value` is decimal (0.01 = 1 %).
 */
export interface MonthlyReturn {
  /** ISO year-month, e.g. "1990-07" */
  date: string;
  /** Decimal total return for the month */
  value: number;
}

/**
 * One month of CPI-based inflation.
 * `value` is decimal (0.003 ≈ 0.3 %).
 */
export interface MonthlyInflation {
  /** ISO year-month, e.g. "1990-07" */
  date: string;
  /** Decimal month-over-month CPI change */
  value: number;
}

/** Metadata embedded in each on-disk data file. */
export interface DataFileMetadata {
  source: string;
  description: string;
  retrieved: string;
  license: string;
  frequency: string;
  units: string;
}

/** On-disk JSON format shared by all three data files. */
export interface DataFile<T> {
  metadata: DataFileMetadata;
  series: T[];
}

/**
 * Aligned monthly dataset ready for simulation.
 * All three arrays cover exactly [startDate, endDate] with no gaps.
 */
export interface MarketDataset {
  usEquity: MonthlyReturn[];
  intlEquity: MonthlyReturn[];
  cpi: MonthlyInflation[];
  /** First month present in all series ("YYYY-MM") */
  startDate: string;
  /** Last month present in all series ("YYYY-MM") */
  endDate: string;
}

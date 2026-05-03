export interface Bin {
  /** Inclusive lower bound of the bin. */
  x0: number;
  /** Exclusive upper bound of the bin (except the last bin, which is inclusive). */
  x1: number;
  /** Number of values that fall in this bin. */
  count: number;
  /** Fraction of total values in this bin (0–1). */
  pct: number;
}

export interface BinOptions {
  /** Number of equal-width bins. Must be >= 1. Defaults to 20. */
  binCount?: number;
  /** Override the minimum domain value. Useful for shared-axis charts. */
  domainMin?: number;
  /** Override the maximum domain value. Useful for shared-axis charts. */
  domainMax?: number;
}

/**
 * Partitions `values` into equal-width bins.
 *
 * Returns an empty array when `values` is empty.
 * When all values are identical, returns a single bin containing all values.
 */
export function buildBins(values: number[], options: BinOptions = {}): Bin[] {
  if (values.length === 0) return [];

  const { binCount = 20 } = options;
  if (binCount < 1) throw new RangeError('binCount must be >= 1');

  const min = options.domainMin ?? Math.min(...values);
  const max = options.domainMax ?? Math.max(...values);

  // Degenerate case: all values are identical (or domain collapsed to a point).
  if (min === max) {
    return [{ x0: min, x1: max, count: values.length, pct: 1 }];
  }

  const width = (max - min) / binCount;
  const bins: Bin[] = Array.from({ length: binCount }, (_, i) => ({
    x0: min + i * width,
    x1: min + (i + 1) * width,
    count: 0,
    pct: 0,
  }));

  for (const v of values) {
    if (v < min || v > max) continue; // exclude out-of-domain values when domain is forced
    // Values equal to max fall in the last bin via the clamp.
    const idx = Math.min(Math.floor((v - min) / width), binCount - 1);
    bins[idx].count++;
  }

  const total = values.length;
  for (const bin of bins) {
    bin.pct = bin.count / total;
  }

  return bins;
}

/**
 * Computes the union domain [min, max] across multiple value arrays.
 * Useful for aligning axes before passing `domainMin`/`domainMax` to `buildBins`.
 */
export function unionDomain(arrays: number[][]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const arr of arrays) {
    for (const v of arr) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!isFinite(min) || !isFinite(max)) return [0, 0];
  return [min, max];
}

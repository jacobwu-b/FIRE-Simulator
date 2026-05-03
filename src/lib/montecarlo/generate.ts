import type { MonteCarloCalibration, GeneratePath } from './types';
import { mulberry32 } from './prng';

/**
 * Samples a block length from a geometric distribution with the given success
 * probability p = 1 / expectedBlockLength. The minimum returned length is 1.
 */
function sampleBlockLength(rng: () => number, expectedBlockLength: number): number {
  const p = 1 / expectedBlockLength;
  return Math.max(1, Math.ceil(Math.log(1 - rng()) / Math.log(1 - p)));
}

/**
 * Creates a path generator that uses the stationary block bootstrap to produce
 * synthetic monthly return paths calibrated to historical data.
 *
 * Joint-row sampling (same block indices applied to all three series) preserves
 * cross-series correlation and volatility clustering without explicit modelling.
 *
 * @param calibration - Output of calibrateFromHistorical().
 * @param seed - Seed for the internal PRNG. Identical seed → identical paths.
 * @param historicalUS - Raw US equity monthly return values from the dataset.
 * @param historicalIntl - Raw international equity monthly return values.
 * @param historicalInflation - Raw CPI monthly inflation values.
 */
export function createBlockBootstrapGenerator(
  calibration: MonteCarloCalibration,
  seed: number,
  historicalUS: number[],
  historicalIntl: number[],
  historicalInflation: number[],
): GeneratePath {
  const n = calibration.datasetLength;
  const expectedBlockLength = calibration.blockConfig.expectedBlockLength;

  return function generatePath(horizonMonths: number): {
    usReturns: number[];
    intlReturns: number[];
    inflation: number[];
  } {
    const rng = mulberry32(seed);
    const usReturns: number[] = [];
    const intlReturns: number[] = [];
    const inflation: number[] = [];

    while (usReturns.length < horizonMonths) {
      // Sample a random starting position in the historical dataset.
      const start = Math.floor(rng() * n);
      const blockLen = sampleBlockLength(rng, expectedBlockLength);

      for (let i = 0; i < blockLen && usReturns.length < horizonMonths; i++) {
        // Wrap around at dataset boundary (standard for stationary bootstrap).
        const idx = (start + i) % n;
        usReturns.push(historicalUS[idx]);
        intlReturns.push(historicalIntl[idx]);
        inflation.push(historicalInflation[idx]);
      }
    }

    return { usReturns, intlReturns, inflation };
  };
}

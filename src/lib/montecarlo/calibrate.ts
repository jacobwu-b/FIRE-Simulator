import type { MarketDataset } from '../data/types';
import type { MonteCarloCalibration, BlockBootstrapConfig } from './types';

const DEFAULT_EXPECTED_BLOCK_LENGTH = 36;

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Derives calibration parameters from the historical dataset.
 *
 * Computes per-series arithmetic mean and standard deviation, then packages
 * them alongside block bootstrap configuration for use by generatePath().
 *
 * @param dataset - Aligned historical market dataset.
 * @param blockConfig - Block bootstrap configuration. Defaults to
 *   expectedBlockLength=36 if omitted.
 */
export function calibrateFromHistorical(
  dataset: MarketDataset,
  blockConfig?: Partial<BlockBootstrapConfig>,
): MonteCarloCalibration {
  const n = dataset.usEquity.length;
  if (n === 0) {
    throw new Error('calibrateFromHistorical: dataset is empty');
  }
  if (
    dataset.intlEquity.length !== n ||
    dataset.cpi.length !== n
  ) {
    throw new Error(
      'calibrateFromHistorical: series lengths do not match — ' +
        `us=${n}, intl=${dataset.intlEquity.length}, cpi=${dataset.cpi.length}`,
    );
  }

  const usValues = dataset.usEquity.map((r) => r.value);
  const intlValues = dataset.intlEquity.map((r) => r.value);
  const cpiValues = dataset.cpi.map((r) => r.value);

  const usMean = mean(usValues);
  const intlMean = mean(intlValues);
  const inflationMean = mean(cpiValues);

  const config: BlockBootstrapConfig = {
    expectedBlockLength:
      blockConfig?.expectedBlockLength ?? DEFAULT_EXPECTED_BLOCK_LENGTH,
  };

  return {
    datasetLength: n,
    usMean,
    usVol: stddev(usValues, usMean),
    intlMean,
    intlVol: stddev(intlValues, intlMean),
    inflationMean,
    inflationVol: stddev(cpiValues, inflationMean),
    blockConfig: config,
  };
}

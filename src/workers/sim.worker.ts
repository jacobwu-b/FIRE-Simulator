import { loadMarketData } from '../lib/data/load';
import { runHistorical } from '../lib/runners/historical';
import type { HistoricalResult } from '../lib/runners/historical';
import { runMonteCarlo } from '../lib/runners/montecarlo';
import type { MonteCarloResult } from '../lib/montecarlo/types';
import type { SimParams } from '../lib/simulation/types';
import type { StrategyParams } from '../lib/strategies/types';
import type { MarketDataset } from '../lib/data/types';
import type { UIParams } from '../ui/state/types';

export type WorkerMode = 'historical' | 'monteCarlo' | 'both';

export interface WorkerRequest {
  id: number;
  params: UIParams;
  mode: WorkerMode;
}

export interface WorkerResponse {
  id: number;
  historical?: HistoricalResult;
  monteCarlo?: MonteCarloResult;
  error?: string;
}

const MC_PATH_COUNT = 1000;
const MC_SEED = 42;

function toSimParams(p: UIParams): SimParams {
  return {
    initialPortfolio: p.initialPortfolio,
    allocation: { us: p.allocation.us / 100, intl: p.allocation.intl / 100 },
    horizonYears: p.horizonYears,
  };
}

function toStrategyParams(p: UIParams): StrategyParams {
  const sp = p.strategyParams;
  switch (sp.id) {
    case 'rmd':
      return { id: 'rmd', horizonYears: p.horizonYears };
    case 'fixedPct':
      return { id: 'fixedPct', rate: sp.rate / 100 };
    case 'gk':
      return { id: 'gk', initialPortfolio: p.initialPortfolio, initialRate: sp.initialRate / 100 };
    case 'hybrid':
      return {
        id: 'hybrid',
        initialPortfolio: p.initialPortfolio,
        rate: sp.rate / 100,
        floorMultiplier: sp.floorMultiplier,
        ceilingMultiplier: sp.ceilingMultiplier,
      };
  }
}

export function handleSimMessage(data: WorkerRequest, dataset: MarketDataset): WorkerResponse {
  try {
    const simParams = toSimParams(data.params);
    const strategyParams = toStrategyParams(data.params);

    const historical = runHistorical(simParams, dataset, strategyParams);
    const monteCarlo = runMonteCarlo(simParams, dataset, strategyParams, {
      pathCount: MC_PATH_COUNT,
      seed: MC_SEED,
    });

    return { id: data.id, historical, monteCarlo };
  } catch (e) {
    return { id: data.id, error: String(e) };
  }
}

// Worker entrypoint. tsconfig uses DOM lib (no WebWorker lib), so self is typed as Window.
// At runtime this file only runs as a DedicatedWorker where postMessage takes one argument.
const _ws = self as unknown as { onmessage: unknown; postMessage: (msg: unknown) => void };
const _dataset = loadMarketData();
_ws.onmessage = (e: MessageEvent<WorkerRequest>) => {
  _ws.postMessage(handleSimMessage(e.data, _dataset));
};

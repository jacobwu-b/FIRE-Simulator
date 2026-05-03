import { useState } from 'react';
import { PortfolioInput } from './ui/controls/PortfolioInput';
import { AllocationInput } from './ui/controls/AllocationInput';
import { HorizonInput } from './ui/controls/HorizonInput';
import { StrategySelect } from './ui/controls/StrategySelect';
import { StrategyParamsPanel } from './ui/controls/StrategyParamsPanel';
import { DEFAULT_UI_PARAMS } from './ui/state/types';
import type { UIParams, UIStrategyParams } from './ui/state/types';
import type { StrategyId } from './lib/strategies/types';
import { useSimulation } from './ui/state/useSimulation';

function defaultStrategyParams(id: StrategyId): UIStrategyParams {
  switch (id) {
    case 'rmd':
      return { id: 'rmd' };
    case 'fixedPct':
      return { id: 'fixedPct', rate: 4 };
    case 'gk':
      return { id: 'gk', initialRate: 4 };
    case 'hybrid':
      return { id: 'hybrid', rate: 4, floorMultiplier: 0.8, ceilingMultiplier: 1.25 };
  }
}

function App() {
  const [params, setParams] = useState<UIParams>(DEFAULT_UI_PARAMS);
  const { result, isRunning } = useSimulation(params);

  function handleStrategyChange(id: StrategyId) {
    setParams((p) => ({
      ...p,
      strategyId: id,
      strategyParams: defaultStrategyParams(id),
    }));
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>FIRE Simulator</h1>
      </header>
      <main className="app-body">
        <aside className="controls-panel">
          <h2>Parameters</h2>
          <PortfolioInput
            value={params.initialPortfolio}
            onChange={(v) => setParams((p) => ({ ...p, initialPortfolio: v }))}
          />
          <AllocationInput
            value={params.allocation}
            onChange={(v) => setParams((p) => ({ ...p, allocation: v }))}
          />
          <HorizonInput
            value={params.horizonYears}
            onChange={(v) => setParams((p) => ({ ...p, horizonYears: v }))}
          />
          <StrategySelect value={params.strategyId} onChange={handleStrategyChange} />
          <StrategyParamsPanel
            params={params.strategyParams}
            onChange={(v) => setParams((p) => ({ ...p, strategyParams: v }))}
          />
        </aside>
        <section className="results-panel">
          <h2>Results</h2>
          {isRunning && <p className="placeholder">Running simulation…</p>}
          {!isRunning && result === null && (
            <p className="placeholder">Simulation results will appear here.</p>
          )}
          {!isRunning && result !== null && (
            <pre className="results-json">{JSON.stringify(
              {
                historical: {
                  periodCount: result.historical.periodCount,
                  survivalRate: result.historical.survivalRate,
                  metrics: result.historical.metrics,
                },
                monteCarlo: {
                  pathCount: result.monteCarlo.pathCount,
                  survivalRate: result.monteCarlo.survivalRate,
                  metrics: result.monteCarlo.metrics,
                },
              },
              null,
              2,
            )}</pre>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

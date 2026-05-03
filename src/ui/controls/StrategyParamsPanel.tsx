import type { UIStrategyParams } from '../state/types';

interface Props {
  params: UIStrategyParams;
  onChange: (params: UIStrategyParams) => void;
}

export function StrategyParamsPanel({ params, onChange }: Props) {
  if (params.id === 'rmd') {
    return (
      <div className="strategy-params">
        <p className="strategy-description">
          Withdraws based on IRS life-expectancy tables — no additional parameters required.
        </p>
      </div>
    );
  }

  if (params.id === 'fixedPct') {
    return (
      <div className="strategy-params">
        <div className="control-group">
          <label htmlFor="fixedpct-rate">
            Withdrawal Rate: {params.rate.toFixed(1)}%
          </label>
          <input
            id="fixedpct-rate"
            type="range"
            min={1}
            max={10}
            step={0.1}
            value={params.rate}
            onChange={(e) =>
              onChange({ ...params, rate: Number(e.target.value) })
            }
          />
        </div>
      </div>
    );
  }

  if (params.id === 'gk') {
    return (
      <div className="strategy-params">
        <div className="control-group">
          <label htmlFor="gk-rate">
            Initial Rate: {params.initialRate.toFixed(1)}%
          </label>
          <input
            id="gk-rate"
            type="range"
            min={1}
            max={10}
            step={0.1}
            value={params.initialRate}
            onChange={(e) =>
              onChange({ ...params, initialRate: Number(e.target.value) })
            }
          />
        </div>
      </div>
    );
  }

  // hybrid
  return (
    <div className="strategy-params">
      <div className="control-group">
        <label htmlFor="hybrid-rate">
          Base Rate: {params.rate.toFixed(1)}%
        </label>
        <input
          id="hybrid-rate"
          type="range"
          min={1}
          max={10}
          step={0.1}
          value={params.rate}
          onChange={(e) =>
            onChange({ ...params, rate: Number(e.target.value) })
          }
        />
      </div>
      <div className="control-group">
        <label htmlFor="hybrid-floor">
          Floor: {(params.floorMultiplier * 100).toFixed(0)}%
        </label>
        <input
          id="hybrid-floor"
          type="range"
          min={50}
          max={100}
          step={5}
          value={params.floorMultiplier * 100}
          onChange={(e) =>
            onChange({ ...params, floorMultiplier: Number(e.target.value) / 100 })
          }
        />
      </div>
      <div className="control-group">
        <label htmlFor="hybrid-ceiling">
          Ceiling: {(params.ceilingMultiplier * 100).toFixed(0)}%
        </label>
        <input
          id="hybrid-ceiling"
          type="range"
          min={100}
          max={200}
          step={5}
          value={params.ceilingMultiplier * 100}
          onChange={(e) =>
            onChange({ ...params, ceilingMultiplier: Number(e.target.value) / 100 })
          }
        />
      </div>
    </div>
  );
}

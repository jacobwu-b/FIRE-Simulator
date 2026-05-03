import type { ChangeEvent } from 'react';
import type { StrategyId } from '../../lib/strategies/types';

const STRATEGY_LABELS: Record<StrategyId, string> = {
  rmd: 'RMD (Life Expectancy)',
  fixedPct: 'Fixed Percentage',
  gk: 'Guyton-Klinger Guardrails',
  hybrid: 'Hybrid (Floor/Ceiling)',
};

interface Props {
  value: StrategyId;
  onChange: (id: StrategyId) => void;
}

export function StrategySelect({ value, onChange }: Props) {
  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    onChange(e.target.value as StrategyId);
  }

  return (
    <div className="control-group">
      <label htmlFor="strategy-select">Withdrawal Strategy</label>
      <select id="strategy-select" value={value} onChange={handleChange}>
        {(Object.entries(STRATEGY_LABELS) as [StrategyId, string][]).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

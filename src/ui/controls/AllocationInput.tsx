import type { ChangeEvent } from 'react';
import type { UIAllocation } from '../state/types';

interface Props {
  value: UIAllocation;
  onChange: (value: UIAllocation) => void;
}

export function AllocationInput({ value, onChange }: Props) {
  function handleUsChange(e: ChangeEvent<HTMLInputElement>) {
    const us = Number(e.target.value);
    // Enforce sum-to-100 invariant: intl tracks us
    onChange({ us, intl: 100 - us });
  }

  return (
    <div className="control-group">
      <label>Equity Allocation</label>
      <div className="allocation-row">
        <span>US {value.us}%</span>
        <input
          aria-label="US equity percent"
          type="range"
          min={0}
          max={100}
          step={5}
          value={value.us}
          onChange={handleUsChange}
        />
        <span>Intl {value.intl}%</span>
      </div>
    </div>
  );
}

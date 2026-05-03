import type { ChangeEvent } from 'react';

interface Props {
  value: number;
  onChange: (value: number) => void;
}

export function HorizonInput({ value, onChange }: Props) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const years = Number(e.target.value);
    if (years >= 1 && years <= 50) onChange(years);
  }

  return (
    <div className="control-group">
      <label htmlFor="horizon-input">Retirement Horizon: {value} years</label>
      <input
        id="horizon-input"
        type="range"
        min={1}
        max={50}
        step={1}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
}

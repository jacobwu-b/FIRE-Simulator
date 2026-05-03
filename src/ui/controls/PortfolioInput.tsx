import type { ChangeEvent } from 'react';

interface Props {
  value: number;
  onChange: (value: number) => void;
}

export function PortfolioInput({ value, onChange }: Props) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const parsed = Number(e.target.value.replace(/,/g, ''));
    if (!Number.isNaN(parsed) && parsed >= 0) onChange(parsed);
  }

  return (
    <div className="control-group">
      <label htmlFor="portfolio-input">Initial Portfolio ($)</label>
      <input
        id="portfolio-input"
        type="number"
        min={0}
        step={10000}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
}

import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { StrategyParamsPanel } from './StrategyParamsPanel';
import type { UIStrategyParams } from '../state/types';

function Harness({ initial }: { initial: UIStrategyParams }) {
  const [params, setParams] = useState<UIStrategyParams>(initial);
  return (
    <>
      <StrategyParamsPanel params={params} onChange={setParams} />
      <span data-testid="strategy-id">{params.id}</span>
    </>
  );
}

describe('StrategyParamsPanel', () => {
  it('renders description for rmd strategy (no sliders)', () => {
    render(<Harness initial={{ id: 'rmd' }} />);
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByText(/life-expectancy/i)).toBeTruthy();
  });

  it('renders withdrawal rate slider for fixedPct strategy', () => {
    render(<Harness initial={{ id: 'fixedPct', rate: 4 }} />);
    expect(screen.getByLabelText(/withdrawal rate/i)).toBeTruthy();
  });

  it('renders initial rate slider for gk strategy', () => {
    render(<Harness initial={{ id: 'gk', initialRate: 4 }} />);
    expect(screen.getByLabelText(/initial rate/i)).toBeTruthy();
  });

  it('renders base rate, floor, and ceiling sliders for hybrid strategy', () => {
    render(
      <Harness initial={{ id: 'hybrid', rate: 4, floorMultiplier: 0.8, ceilingMultiplier: 1.25 }} />,
    );
    expect(screen.getByLabelText(/base rate/i)).toBeTruthy();
    expect(screen.getByLabelText(/floor/i)).toBeTruthy();
    expect(screen.getByLabelText(/ceiling/i)).toBeTruthy();
  });

  it('updates fixedPct rate when slider changes', () => {
    render(<Harness initial={{ id: 'fixedPct', rate: 4 }} />);
    const slider = screen.getByLabelText(/withdrawal rate/i);

    fireEvent.change(slider, { target: { value: '5' } });

    expect(screen.getByLabelText(/withdrawal rate/i).getAttribute('value') ?? '').toBe('5');
  });

  it('updates hybrid floor multiplier when slider changes', () => {
    render(
      <Harness initial={{ id: 'hybrid', rate: 4, floorMultiplier: 0.8, ceilingMultiplier: 1.25 }} />,
    );
    const floorSlider = screen.getByLabelText(/floor/i);

    // slider value is floorMultiplier * 100 (i.e., 80)
    fireEvent.change(floorSlider, { target: { value: '70' } });

    expect(floorSlider.getAttribute('value') ?? '').toBe('70');
  });
});

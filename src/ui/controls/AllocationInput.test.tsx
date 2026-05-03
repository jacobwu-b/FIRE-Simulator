import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { AllocationInput } from './AllocationInput';
import type { UIAllocation } from '../state/types';

function Harness() {
  const [allocation, setAllocation] = useState<UIAllocation>({ us: 60, intl: 40 });
  return (
    <>
      <AllocationInput value={allocation} onChange={setAllocation} />
      <span data-testid="us-val">{allocation.us}</span>
      <span data-testid="intl-val">{allocation.intl}</span>
    </>
  );
}

function usVal() {
  return Number(screen.getByTestId('us-val').textContent);
}
function intlVal() {
  return Number(screen.getByTestId('intl-val').textContent);
}

describe('AllocationInput', () => {
  it('displays initial US and Intl percentages', () => {
    render(<Harness />);
    expect(usVal()).toBe(60);
    expect(intlVal()).toBe(40);
  });

  it('keeps US + Intl = 100 when slider changes', () => {
    render(<Harness />);
    const slider = screen.getByRole('slider', { name: /us equity percent/i });

    fireEvent.change(slider, { target: { value: '70' } });

    expect(usVal()).toBe(70);
    expect(intlVal()).toBe(30);
    expect(usVal() + intlVal()).toBe(100);
  });

  it('enforces sum-to-100 at lower boundary (US = 0)', () => {
    render(<Harness />);
    const slider = screen.getByRole('slider', { name: /us equity percent/i });

    fireEvent.change(slider, { target: { value: '0' } });

    expect(usVal()).toBe(0);
    expect(intlVal()).toBe(100);
  });

  it('enforces sum-to-100 at upper boundary (US = 100)', () => {
    render(<Harness />);
    const slider = screen.getByRole('slider', { name: /us equity percent/i });

    fireEvent.change(slider, { target: { value: '100' } });

    expect(usVal()).toBe(100);
    expect(intlVal()).toBe(0);
  });
});

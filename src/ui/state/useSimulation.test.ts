import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useSimulation } from './useSimulation';
import { DEFAULT_UI_PARAMS } from './types';
import type { WorkerResponse } from '../../workers/sim.worker';

// Minimal fake results — the hook only cares that `historical` and `monteCarlo` are truthy.
function fakeResponse(id: number): WorkerResponse {
  return {
    id,
    historical: {
      periodCount: 1,
      survivalRate: 1,
      startDates: ['2000-01'],
      endingNominalValues: [500_000],
      endingRealValues: [490_000],
      nominalWithdrawalsPerYear: [[20_000]],
      realWithdrawalsPerYear: [[19_600]],
      trajectories: [],
      metrics: {
        trajectoryCount: 1,
        survivalRate: 1,
        endingRealValue: { mean: 490_000, median: 490_000, p10: 490_000, p25: 490_000, p75: 490_000, p90: 490_000 },
        realWithdrawal: { mean: 19_600, median: 19_600, variance: 0 },
        failureYearDistribution: {},
        meanMaxDrawdown: 0,
        medianMaxDrawdown: 0,
      },
    },
    monteCarlo: {
      pathCount: 1000,
      seed: 42,
      survivalRate: 0.95,
      endingNominalValues: [],
      endingRealValues: [],
      nominalWithdrawalsPerYear: [],
      realWithdrawalsPerYear: [],
      trajectories: [],
      metrics: {
        trajectoryCount: 1000,
        survivalRate: 0.95,
        endingRealValue: { mean: 490_000, median: 490_000, p10: 490_000, p25: 490_000, p75: 490_000, p90: 490_000 },
        realWithdrawal: { mean: 19_600, median: 19_600, variance: 0 },
        failureYearDistribution: {},
        meanMaxDrawdown: 0.05,
        medianMaxDrawdown: 0.04,
      },
    },
  };
}

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor(_url: unknown, _opts?: unknown) {
    FakeWorker.instances.push(this);
  }

  emit(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe('useSimulation', () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('Worker', FakeWorker);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts with result null and isRunning false', () => {
    const { result } = renderHook(() => useSimulation(DEFAULT_UI_PARAMS));

    expect(result.current.result).toBeNull();
    expect(result.current.isRunning).toBe(false);
  });

  it('isRunning becomes true after the debounce delay fires', () => {
    const { result } = renderHook(() => useSimulation(DEFAULT_UI_PARAMS));

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.isRunning).toBe(true);
  });

  it('debounce coalesces rapid param updates into a single postMessage', () => {
    const params1 = { ...DEFAULT_UI_PARAMS, horizonYears: 20 };
    const params2 = { ...DEFAULT_UI_PARAMS, horizonYears: 25 };

    const { rerender } = renderHook(({ params }) => useSimulation(params), {
      initialProps: { params: DEFAULT_UI_PARAMS },
    });

    act(() => {
      rerender({ params: params1 });
    });
    act(() => {
      rerender({ params: params2 });
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const worker = FakeWorker.instances[0];
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ params: params2 }),
    );
  });

  it('stale worker responses with old run ids are dropped', () => {
    const { result } = renderHook(() => useSimulation(DEFAULT_UI_PARAMS));

    act(() => {
      vi.advanceTimersByTime(150);
    });

    const worker = FakeWorker.instances[0];
    expect(result.current.isRunning).toBe(true);

    // Emit a response for id 0 (stale — current run id is 1)
    act(() => {
      worker.emit({ id: 0, historical: {}, monteCarlo: {} });
    });

    expect(result.current.result).toBeNull();
    expect(result.current.isRunning).toBe(true);
  });

  it('valid response updates result and clears isRunning', () => {
    const { result } = renderHook(() => useSimulation(DEFAULT_UI_PARAMS));

    act(() => {
      vi.advanceTimersByTime(150);
    });

    const worker = FakeWorker.instances[0];
    // Run id incremented to 1 when debounce fires
    act(() => {
      worker.emit(fakeResponse(1));
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.result).not.toBeNull();
    expect(result.current.result!.historical.periodCount).toBe(1);
    expect(result.current.result!.monteCarlo.pathCount).toBe(1000);
  });

  it('second param change invalidates in-flight run; only fresh response is accepted', () => {
    const { result, rerender } = renderHook(({ params }) => useSimulation(params), {
      initialProps: { params: DEFAULT_UI_PARAMS },
    });

    // Fire first run (id=1)
    act(() => {
      vi.advanceTimersByTime(150);
    });
    const worker = FakeWorker.instances[0];

    // Param change starts a new debounce before first run responds
    act(() => {
      rerender({ params: { ...DEFAULT_UI_PARAMS, horizonYears: 25 } });
    });

    // Fire second run (id=2)
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // Late response from the first run (id=1) — must be ignored
    act(() => {
      worker.emit(fakeResponse(1));
    });
    expect(result.current.result).toBeNull();

    // Response from the current run (id=2) — must be accepted
    act(() => {
      worker.emit(fakeResponse(2));
    });
    expect(result.current.result).not.toBeNull();
    expect(result.current.isRunning).toBe(false);
  });

  it('terminates the worker on unmount', () => {
    const { unmount } = renderHook(() => useSimulation(DEFAULT_UI_PARAMS));
    const worker = FakeWorker.instances[0];

    unmount();

    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});

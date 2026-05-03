import { useEffect, useRef, useState } from 'react';
import type { HistoricalResult } from '../../lib/runners/historical';
import type { MonteCarloResult } from '../../lib/montecarlo/types';
import type { UIParams } from './types';
import type { WorkerRequest, WorkerResponse } from '../../workers/sim.worker';

export interface SimResult {
  historical: HistoricalResult;
  monteCarlo: MonteCarloResult;
}

const DEBOUNCE_MS = 150;

export function useSimulation(params: UIParams): { result: SimResult | null; isRunning: boolean } {
  const [result, setResult] = useState<SimResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../../workers/sim.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.id !== runIdRef.current) return;
      setIsRunning(false);
      if (data.error !== undefined) return;
      if (data.historical && data.monteCarlo) {
        setResult({ historical: data.historical, monteCarlo: data.monteCarlo });
      }
    };

    workerRef.current = worker;
    return () => {
      worker.terminate();
    };
  }, []);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const id = ++runIdRef.current;
      setIsRunning(true);
      workerRef.current?.postMessage({ id, params, mode: 'both' } satisfies WorkerRequest);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [params]);

  return { result, isRunning };
}

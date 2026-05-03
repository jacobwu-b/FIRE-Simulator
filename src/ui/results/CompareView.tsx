import { useMemo } from 'react';
import type { HistoricalResult } from '../../lib/runners/historical';
import type { MonteCarloResult } from '../../lib/montecarlo/types';
import { unionDomain } from '../../lib/viz/histogram';
import { EndingWealthDistribution } from './EndingWealthDistribution';
import { WithdrawalDistribution, withdrawalYDomain } from './WithdrawalDistribution';

/** Merges two [yearIndex][scenarioIndex] arrays into one. */
function mergeWithdrawals(a: number[][], b: number[][]): number[][] {
  const years = Math.max(a.length, b.length);
  return Array.from({ length: years }, (_, y) => [
    ...(a[y] ?? []),
    ...(b[y] ?? []),
  ]);
}

interface CompareViewProps {
  historical: HistoricalResult;
  monteCarlo: MonteCarloResult;
  /** Starting portfolio value used as a reference line on the wealth histogram. */
  initialPortfolio?: number;
}

export function CompareView({ historical, monteCarlo, initialPortfolio }: CompareViewProps) {
  const wealthDomain = useMemo(
    () =>
      unionDomain([historical.endingRealValues, monteCarlo.endingRealValues]) as [number, number],
    [historical.endingRealValues, monteCarlo.endingRealValues],
  );

  const withdrawalDomain = useMemo(() => {
    const merged = mergeWithdrawals(
      historical.realWithdrawalsPerYear,
      monteCarlo.realWithdrawalsPerYear,
    );
    return withdrawalYDomain(merged);
  }, [historical.realWithdrawalsPerYear, monteCarlo.realWithdrawalsPerYear]);

  return (
    <div className="compare-view">
      <section className="compare-section">
        <h3 className="compare-section-title">Ending Wealth Distribution</h3>
        <div className="compare-charts-row">
          <EndingWealthDistribution
            endingRealValues={historical.endingRealValues}
            domain={wealthDomain}
            referenceValue={initialPortfolio}
            color="#3b82f6"
            title="Historical"
          />
          <EndingWealthDistribution
            endingRealValues={monteCarlo.endingRealValues}
            domain={wealthDomain}
            referenceValue={initialPortfolio}
            color="#22c55e"
            title="Monte Carlo"
          />
        </div>
      </section>

      <section className="compare-section">
        <h3 className="compare-section-title">Annual Withdrawal (Real, P10–P90 Band)</h3>
        <div className="compare-charts-row">
          <WithdrawalDistribution
            realWithdrawalsPerYear={historical.realWithdrawalsPerYear}
            yDomain={withdrawalDomain}
            color="#3b82f6"
            title="Historical"
          />
          <WithdrawalDistribution
            realWithdrawalsPerYear={monteCarlo.realWithdrawalsPerYear}
            yDomain={withdrawalDomain}
            color="#22c55e"
            title="Monte Carlo"
          />
        </div>
      </section>
    </div>
  );
}

import { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { formatDollars } from './MetricCards';

function percentileOf(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

interface YearPoint {
  year: number;
  p10: number;
  band: number;
  p50: number;
}

function buildWithdrawalBands(realWithdrawalsPerYear: number[][]): YearPoint[] {
  return realWithdrawalsPerYear.map((yearWithdrawals, yearIdx) => {
    const sorted = [...yearWithdrawals].sort((a, b) => a - b);
    const p10 = percentileOf(sorted, 0.1);
    const p50 = percentileOf(sorted, 0.5);
    const p90 = percentileOf(sorted, 0.9);
    return { year: yearIdx + 1, p10, band: p90 - p10, p50 };
  });
}

function BandTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p10 = payload.find((p) => p.dataKey === 'p10')?.value as number ?? 0;
  const band = payload.find((p) => p.dataKey === 'band')?.value as number ?? 0;
  const p50 = payload.find((p) => p.dataKey === 'p50')?.value as number ?? 0;
  const p90 = p10 + band;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-year">Year {label}</p>
      <p>P90: {formatDollars(p90)}</p>
      <p>Median: {formatDollars(p50)}</p>
      <p>P10: {formatDollars(p10)}</p>
    </div>
  );
}

interface WithdrawalDistributionProps {
  /** realWithdrawalsPerYear[yearIndex][scenarioIndex] */
  realWithdrawalsPerYear: number[][];
  /** Shared y-axis domain [min, max] for aligned comparisons. */
  yDomain?: [number, number];
  color?: string;
  title: string;
}

export function WithdrawalDistribution({
  realWithdrawalsPerYear,
  yDomain,
  color = '#3b82f6',
  title,
}: WithdrawalDistributionProps) {
  const data = useMemo(() => buildWithdrawalBands(realWithdrawalsPerYear), [realWithdrawalsPerYear]);
  const medianColor = color === '#3b82f6' ? '#1d4ed8' : '#15803d';

  const yMin = yDomain?.[0] ?? 'auto';
  const yMax = yDomain?.[1] ?? 'auto';

  return (
    <div className="distribution-chart">
      <h4 className="chart-title">{title}</h4>
      {data.length === 0 ? (
        <div className="chart-empty">No data available.</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 28, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10 }}
              label={{ value: 'Year', position: 'insideBottom', offset: -12, fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(v: number) => formatDollars(v)}
              tick={{ fontSize: 10 }}
              width={60}
              domain={[yMin, yMax]}
            />
            <Tooltip content={BandTooltip} />

            {/* Transparent base (p10) + visible P10–P90 band */}
            <Area
              type="monotone"
              dataKey="p10"
              fill="transparent"
              stroke="none"
              stackId="band"
              legendType="none"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="band"
              fill={color}
              fillOpacity={0.2}
              stroke="none"
              stackId="band"
              name="P10–P90 band"
              isAnimationActive={false}
            />

            <Line
              type="monotone"
              dataKey="p50"
              stroke={medianColor}
              strokeWidth={2}
              dot={false}
              name="Median (P50)"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/** Exported so CompareView can derive a shared y-domain without duplicating logic. */
export function withdrawalYDomain(realWithdrawalsPerYear: number[][]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const year of realWithdrawalsPerYear) {
    for (const v of year) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!isFinite(min)) return [0, 0];
  return [min, max];
}

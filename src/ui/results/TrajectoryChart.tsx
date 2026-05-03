import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { Trajectory } from '../../lib/simulation/types';
import { formatDollars } from './MetricCards';

const SAMPLE_COUNT = 50;
const BAND_COLOR = '#3b82f6';
const PATH_COLOR = '#93c5fd';
const MEDIAN_COLOR = '#1d4ed8';

function percentileOf(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function sampleEvenly<T>(arr: T[], maxCount: number): T[] {
  if (arr.length <= maxCount) return arr;
  const step = arr.length / maxCount;
  return Array.from({ length: maxCount }, (_, i) => arr[Math.floor(i * step)]);
}

interface ChartPoint {
  year: number;
  p10: number;
  band: number;
  p50: number;
  [key: string]: number;
}

function buildChartData(
  trajectories: Trajectory[],
  horizonYears: number,
): { data: ChartPoint[]; pathKeys: string[] } {
  const sampled = sampleEvenly(trajectories, SAMPLE_COUNT);
  const pathKeys = sampled.map((_, i) => `path_${i}`);

  const data: ChartPoint[] = Array.from({ length: horizonYears }, (_, y) => {
    const monthIdx = (y + 1) * 12 - 1;
    const allBalances = trajectories
      .map((t) => t.realBalance[monthIdx] ?? 0)
      .sort((a, b) => a - b);
    const p10 = percentileOf(allBalances, 0.1);
    const p50 = percentileOf(allBalances, 0.5);
    const p90 = percentileOf(allBalances, 0.9);

    const point: ChartPoint = { year: y + 1, p10, band: p90 - p10, p50 };
    sampled.forEach((t, i) => {
      point[`path_${i}`] = t.realBalance[monthIdx] ?? 0;
    });
    return point;
  });

  return { data, pathKeys };
}

function BandTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;

  const p10 = payload.find((p) => p.dataKey === 'p10')?.value ?? 0;
  const band = payload.find((p) => p.dataKey === 'band')?.value ?? 0;
  const p50 = payload.find((p) => p.dataKey === 'p50')?.value ?? 0;
  const p90 = (p10 as number) + (band as number);

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-year">Year {label}</p>
      <p>P90: {formatDollars(p90 as number)}</p>
      <p>Median: {formatDollars(p50 as number)}</p>
      <p>P10: {formatDollars(p10 as number)}</p>
    </div>
  );
}

interface TrajectoryChartProps {
  trajectories: Trajectory[];
  horizonYears: number;
  title: string;
}

export function TrajectoryChart({ trajectories, horizonYears, title }: TrajectoryChartProps) {
  const { data, pathKeys } = useMemo(
    () =>
      trajectories.length > 0
        ? buildChartData(trajectories, horizonYears)
        : { data: [], pathKeys: [] },
    [trajectories, horizonYears],
  );

  return (
    <div className="trajectory-chart">
      <h3 className="chart-title">{title}</h3>
      {trajectories.length === 0 ? (
        <div className="chart-empty">No trajectory data available.</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="year"
              label={{ value: 'Year', position: 'insideBottom', offset: -8 }}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tickFormatter={(v: number) => formatDollars(v)}
              tick={{ fontSize: 11 }}
              width={72}
            />
            <Tooltip content={BandTooltip} />

            {/* Stacked band: transparent base (p10) + visible top (p90−p10) */}
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
              fill={BAND_COLOR}
              fillOpacity={0.15}
              stroke="none"
              stackId="band"
              name="P10–P90 band"
              isAnimationActive={false}
            />

            {/* Sampled paths (thin, low-opacity) */}
            {pathKeys.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={PATH_COLOR}
                strokeWidth={0.75}
                dot={false}
                legendType="none"
                isAnimationActive={false}
              />
            ))}

            {/* Median line on top */}
            <Line
              type="monotone"
              dataKey="p50"
              stroke={MEDIAN_COLOR}
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

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { buildBins } from '../../lib/viz/histogram';
import { formatDollars } from './MetricCards';

const BIN_COUNT = 30;

interface BarTooltipProps extends TooltipContentProps {
  binWidth: number;
}

function BarTooltip({ active, payload, binWidth }: BarTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const { x0, count, pct } = payload[0].payload as {
    x0: number;
    count: number;
    pct: number;
  };
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-year">
        {formatDollars(x0)} – {formatDollars(x0 + binWidth)}
      </p>
      <p>{count} scenarios</p>
      <p>{(pct * 100).toFixed(1)}%</p>
    </div>
  );
}

interface EndingWealthDistributionProps {
  endingRealValues: number[];
  /** Shared x-axis domain [min, max] for aligned comparisons. */
  domain?: [number, number];
  /** Vertical line marking a specific value (e.g. starting portfolio). */
  referenceValue?: number;
  color?: string;
  title: string;
}

export function EndingWealthDistribution({
  endingRealValues,
  domain,
  referenceValue,
  color = '#3b82f6',
  title,
}: EndingWealthDistributionProps) {
  const { bins, binWidth } = useMemo(() => {
    const opts = domain ? { binCount: BIN_COUNT, domainMin: domain[0], domainMax: domain[1] } : { binCount: BIN_COUNT };
    const b = buildBins(endingRealValues, opts);
    const width = b.length >= 2 ? b[1].x0 - b[0].x0 : 0;
    return { bins: b, binWidth: width };
  }, [endingRealValues, domain]);

  const chartData = bins.map((bin) => ({ ...bin, label: formatDollars(bin.x0) }));

  const xMin = domain ? domain[0] : (bins[0]?.x0 ?? 0);
  const xMax = domain ? domain[1] : (bins[bins.length - 1]?.x1 ?? 0);

  return (
    <div className="distribution-chart">
      <h4 className="chart-title">{title}</h4>
      {endingRealValues.length === 0 ? (
        <div className="chart-empty">No data available.</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 16, bottom: 28, left: 16 }}
            barCategoryGap={0}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="x0"
              type="number"
              domain={[xMin, xMax]}
              tickFormatter={(v: number) => formatDollars(v)}
              tick={{ fontSize: 10 }}
              label={{ value: 'Ending Real Value', position: 'insideBottom', offset: -12, fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ fontSize: 10 }}
              width={40}
            />
            <Tooltip content={(props) => <BarTooltip {...props} binWidth={binWidth} />} />
            {referenceValue !== undefined && (
              <ReferenceLine x={referenceValue} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} />
            )}
            <Bar dataKey="pct" fill={color} fillOpacity={0.75} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

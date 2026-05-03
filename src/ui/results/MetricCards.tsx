import type { AggregateMetrics } from '../../lib/metrics/aggregate';

export function formatDollars(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

interface MetricCardProps {
  label: string;
  value: string;
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}

interface MetricSectionProps {
  title: string;
  metrics: AggregateMetrics;
}

function MetricSection({ title, metrics }: MetricSectionProps) {
  return (
    <div className="metric-section">
      <h3 className="metric-section-title">{title}</h3>
      <div className="metric-cards-row">
        <MetricCard label="Survival Rate" value={formatPct(metrics.survivalRate)} />
        <MetricCard
          label="Median Ending Value"
          value={formatDollars(metrics.endingRealValue.median)}
        />
        <MetricCard
          label="Mean Annual Withdrawal"
          value={formatDollars(metrics.realWithdrawal.mean)}
        />
        <MetricCard
          label="Median Max Drawdown"
          value={formatPct(metrics.medianMaxDrawdown)}
        />
      </div>
    </div>
  );
}

interface MetricCardsProps {
  historical: AggregateMetrics;
  monteCarlo: AggregateMetrics;
}

export function MetricCards({ historical, monteCarlo }: MetricCardsProps) {
  return (
    <div className="metric-cards">
      <MetricSection title="Historical" metrics={historical} />
      <MetricSection title="Monte Carlo" metrics={monteCarlo} />
    </div>
  );
}

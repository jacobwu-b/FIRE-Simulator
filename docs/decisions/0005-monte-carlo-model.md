# 0005 — Monte Carlo Return Generation Model

**Date:** 2026-05-02
**Status:** Accepted
**Deciders:** Jacob Wu

---

## Context

The Monte Carlo simulation mode requires a method for generating synthetic monthly
return paths (US equity, international equity, CPI inflation) that:

1. Can be calibrated to the bundled historical dataset.
2. Preserves key empirical properties: volatility clustering, fat tails, and
   cross-series correlation (US/Intl returns and inflation co-move in real data).
3. Produces deterministic, reproducible runs for identical inputs (PRD §9).
4. Remains auditable and explainable to non-specialist users.
5. Introduces no new external dependencies.

Three candidate models were evaluated.

---

## Candidates Considered

### A — Parametric multivariate normal

Fit a 3-dimensional mean vector and covariance matrix from the historical series.
Draw i.i.d. samples from the fitted multivariate normal each month.

**Pros:** Simple, fast, closed-form calibration, provably recovers mean/vol/correlation.

**Cons:**
- Returns are empirically leptokurtic (fat tails) and exhibit volatility clustering
  (ARCH effects). i.i.d. normal draws capture neither. This understates the
  probability of severe sequence-of-returns scenarios — the most policy-relevant
  risk the tool is designed to surface.
- PRD §12: "truth over simplicity; do not oversimplify financial risk."

**Verdict:** Rejected. Underestimates tail risk and clustering.

---

### B — Stationary block bootstrap (Politis & Romano 1994)

Resample contiguous blocks of the historical series, with block lengths drawn
from a geometric distribution (parameter `p`, expected length `1/p`). Sampling
is done on **joint rows** `(us[t], intl[t], cpi[t])` so cross-series structure is
preserved by construction.

**Pros:**
- Volatility clustering is preserved because clustered-variance episodes are
  captured in real blocks — no GARCH fitting required.
- Cross-series correlation (US/Intl comovement, inflation during high-equity
  volatility) comes free from joint-row sampling.
- Fat tails come from real extremes in the historical record.
- Calibration reduces to: compute historical summary stats + choose `p`.
  No numerical optimisation, no convergence risk.
- Naturally deterministic: block start indices and lengths are drawn from a
  seeded PRNG, so identical seed → identical path.
- Aligns with PRD §12 "historical grounding first."

**Cons:**
- Cannot generate scenarios outside the historical record (no "black swan"
  beyond what history contains).
- Block-length parameter `p` is a methodological choice; its value matters
  for spectral properties of generated series but is not self-calibrating.

**Verdict:** **Selected.** Best tradeoff of fidelity, simplicity, and
defensibility for a planning tool whose primary job is surfacing risk.

---

### C — Parametric AR(1) + GARCH(1,1) per series with copula

Fit AR(1) for autocorrelation, GARCH(1,1) for conditional variance on each
series, link marginals with a fitted copula for correlation.

**Pros:** Models clustering and fat tails parametrically; can extrapolate
beyond history.

**Cons:**
- Requires fitting AR, GARCH, and copula parameters — each with numerical
  optimisation that can fail to converge or produce unstable parameters on
  shorter subsets.
- Adds meaningful implementation surface with no external library.
- The parameter space is large enough that small fitting errors compound;
  backtesting the fit is itself a significant undertaking.
- A tool that obscures its assumptions behind fitted parameters conflicts
  with the educational transparency goal.

**Verdict:** Rejected. Complexity and instability risk outweigh benefit for
this use case.

---

## Decision: Stationary Block Bootstrap

### Block length

Default expected block length: **36 months (3 years).**

Politis-Romano's asymptotic theory suggests block length should grow with
sample size; for ~1,200 monthly observations a length of 24–60 months is
conventional. 36 months spans approximately one market cycle phase (expansion
or contraction) and is sufficient to preserve the autocorrelation structure
of monthly returns without over-fitting to any specific episode.

The expected length is configurable (`BlockBootstrapConfig.expectedBlockLength`,
default 36) so users of the library can tune it for sensitivity analysis.

### Wrap-around

When a selected block would extend past the end of the historical dataset, it
wraps around to the beginning. This is standard practice for stationary bootstrap
and avoids boundary effects that would arise from truncating blocks or excluding
end-of-series data.

### Inflation treatment

CPI is sampled jointly with equity returns — the same block indices apply to all
three series. This preserves the historically observed co-movement of inflation
with equity regimes (e.g., high inflation periods coinciding with specific equity
return environments). An alternative of holding inflation constant at its
historical mean was considered and rejected: real-return variance is a first-order
risk factor, and eliminating inflation variation would understate it.

### Determinism

A single master seed (64-bit integer) is supplied to `runMonteCarlo`. Each path
derives its own seed via a mixing function: `pathSeed = mulberry32(masterSeed XOR pathIndex)`.
The mixing prevents correlation between path sequences while ensuring the full run
is reproducible from the master seed alone.

`mulberry32` is chosen as the project's seeded PRNG (see `src/lib/montecarlo/prng.ts`).
It is fast, passes PractRand with no failures at 32 GB, requires no external
dependency, and its entire state fits in a 32-bit integer — making seeds easy to
store and communicate.

### Memory management

Running N=10,000 paths × 840 months (70yr) × 5 arrays produces ~336 M numbers.
`runMonteCarlo` therefore does not store all N full trajectories. It retains:

- All N ending nominal/real values and survival flags (needed for distribution
  statistics).
- All N per-year withdrawal arrays (needed for withdrawal distribution statistics).
- A configurable **sample** of full trajectories (default 200), stratified by
  ending real value across percentile buckets. These are sufficient to render
  fan-chart and percentile-path visualisations.

The default sample count is exposed as `MonteCarloConfig.keepTrajectories`.

---

## Consequences

- `calibrate.ts` is a pure function over `MarketDataset`; its output
  (`MonteCarloCalibration`) contains historical summary statistics and the
  configured block length.
- `generate.ts` is a pure function over calibration + seeded PRNG; it
  has no side effects and produces arrays of length exactly `horizonMonths`.
- `runMonteCarlo` is the only entry point for the Monte Carlo mode and mirrors
  the signature of `runHistorical` as closely as the mode allows.
- Future maintainers who want to add a parametric model can do so by providing
  a different `generatePath` function without modifying the runner or calibration
  contract. The `GeneratePath` function type is part of the public API.
- The block-length default (36 months) should be revisited if the historical
  dataset is extended substantially beyond its current length.

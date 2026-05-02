# 0004 — Withdrawal Strategy Defaults and Formulations

**Date:** 2026-05-02
**Status:** Accepted
**Deciders:** Jacob Wu

---

## Context

Four withdrawal strategies are required by PRD §5B. Three of them (Fixed Percentage, Guyton-Klinger, Hybrid Baseline) have numeric defaults that cannot be derived from first principles alone — they come from specific academic sources or are reasonable simplifications that must be pinned. RMD uses a formulation choice that warrants documentation.

This ADR records the defaults and their sources so they are not changed incidentally.

---

## Strategy 1 — RMD / Life-Expectancy-Based Withdrawal

**Formulation:** At the start of year `y`, withdraw `realBalance / remainingYears` expressed in nominal dollars.

```
remainingYears = horizonYears - yearIndex          (minimum 1)
realAnnualAmount = state.realBalance / remainingYears
nominalAmount = realAnnualAmount * state.cumulativeInflation
```

**Alternative considered:** IRS Uniform Lifetime Table divisors (Publication 590-B). The table starts at age 73 (current law) and requires a `startAge` parameter that no other strategy needs. For MVP, a generalized divisor (`1 / remainingYears`) captures the life-expectancy mechanic cleanly without binding to IRS age thresholds or adding a strategy-specific input to the UI parameter surface. An age-parameterized variant can be introduced later without breaking this one.

**Why "remaining years of horizon" rather than a static table:** Makes the strategy self-consistent for any horizon (30-year, 40-year, 60-year) and keeps the parameter surface identical to the other strategies.

---

## Strategy 2 — Fixed Percentage Withdrawal

**Default rate:** `4.0 %` per year of nominal portfolio value.

**Source:** Bengen (1994) "Determining Withdrawal Rates Using Historical Data," JAEFP — the original "4% rule" paper. This is the conventional starting point for fixed-percentage FIRE planning.

**Note:** The factory exposes `rate` as a required param, so callers always pass it explicitly. The 4% default is used only in the strategy-params default object (the registry / UI layer), not hard-coded in the strategy itself.

---

## Strategy 3 — Guyton-Klinger Guardrails

**Source:** Guyton & Klinger (2006) "Decision Rules and Maximum Initial Withdrawal Rates," Journal of Financial Planning.

| Parameter | Value | Rule name in paper |
|---|---|---|
| Initial withdrawal rate | `4.0 %` of initial portfolio | — |
| Prosperity-rule threshold | `+20 %` below initial WR | "Prosperity Rule" |
| Prosperity-rule increase | `+10 %` of current withdrawal | "Prosperity Rule" |
| Capital-preservation threshold | `+20 %` above initial WR | "Capital Preservation Rule" |
| Capital-preservation cut | `−10 %` of current withdrawal | "Capital Preservation Rule" |
| Inflation freeze condition | WR > initial WR **and** prior year had a negative real return | "Inflation Adjustment Rule" |

**"Down year" detection in this engine:** The strategy factory compares the year-start `realBalance` to the prior year-start `realBalance`. If real balance declined year-over-year, the year is considered a down year for the inflation-freeze rule. This is a reasonable proxy for "portfolio performance" given the engine only exposes start-of-year state.

**Initial withdrawal rate note:** The factory accepts `initialRate` as a required param (default `0.04`). `initialNominalWithdrawal = initialPortfolio * initialRate`. Subsequent years apply the guard-band rules against the evolving current withdrawal rate (`currentWithdrawal / currentNominalBalance`).

---

## Strategy 4 — Inflation-Adjusted Hybrid Baseline

**Formulation:** Each year, withdraw `pct * nominalBalance`, clamped to an inflation-adjusted floor and ceiling derived from the initial real withdrawal level.

```
unconstrained = pct * state.nominalBalance
floor         = initialRealWithdrawal * floorMultiplier * state.cumulativeInflation
ceiling       = initialRealWithdrawal * ceilingMultiplier * state.cumulativeInflation
nominalAmount = clamp(unconstrained, floor, ceiling)
```

where `initialRealWithdrawal = initialPortfolio * pct / cumulativeInflation_at_year_0` (= `initialPortfolio * pct` since year-0 cumInfl = 1).

| Parameter | Default | Rationale |
|---|---|---|
| `pct` | `0.04` | Same 4% anchor as other strategies for comparability |
| `floorMultiplier` | `0.80` | Retiree never takes more than a 20% real cut from baseline |
| `ceilingMultiplier` | `1.25` | Retiree never takes more than a 25% real increase from baseline |

**Why this formulation:** Combines the sequence-of-returns responsiveness of a percentage strategy (balance drops → withdrawal drops) with the spending stability of a fixed-real approach (floor/ceiling prevent extreme cuts or windfalls). The floor/ceiling are indexed to the initial real withdrawal, not to nominal dollars, so they inflate with the rest of the economy.

---

## Consequences

- These defaults must not change without a new ADR entry or an amendment here, as they affect baseline behavior visible to users in future UI.
- Strategy factories accept all numeric parameters explicitly so these defaults live only in one place (the registry's default-params map, introduced in a later PR).
- If IRS-table RMD becomes a requirement, it is added as a separate strategy (`"rmd-irs"`) rather than modifying this one.

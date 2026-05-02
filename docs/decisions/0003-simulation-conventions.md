# 0003 — Simulation Engine Conventions

**Date:** 2026-05-02
**Status:** Accepted
**Deciders:** Jacob Wu

---

## Context

The monthly simulation engine is the foundation for all withdrawal-strategy implementations and both simulation modes (historical backtest, Monte Carlo). Several conventions must be locked in before any strategy or mode code is written, because changing them post-merge requires updating every consumer.

The five conventions below cover withdrawal timing, inflation normalization, return application order, portfolio rebalancing, and depletion semantics.

---

## Convention 1 — Withdrawal timing: annual decision, monthly deduction

**Decision:** The withdrawal callback (`withdrawalFn`) fires **once per simulated year** at the start of year (when `monthOfYear === 0`), returning a nominal annual dollar amount. The engine deducts **`annualAmount / 12`** each month throughout that year.

**Alternatives considered:**
- *Start-of-year lump sum:* PRD §9 originally stated "start-of-year withdrawal assumption." This is the convention in classic FIRE research (Bengen 1994, Trinity Study). However, a monthly deduction is arithmetically cleaner — no single-month portfolio shock, and the balance at any month-end is immediately interpretable as "current portfolio value."
- *Callback fires monthly:* All four supported strategies (RMD/Life-Expectancy, Fixed %, Guyton-Klinger, Hybrid Baseline) make annual decisions. Firing monthly would require strategies to carry state across 12 calls, adding complexity with no benefit.

**Rationale:** Monthly deduction gives strategies the annual decision cadence they are designed for, while producing a smooth monthly trajectory. The annual aggregate (`sum of 12 monthly deductions`) equals the strategy's declared withdrawal, making per-year reporting exact. PRD §9 is updated to reflect this refinement.

---

## Convention 2 — Real-dollar normalization

**Decision:** Real balances and real withdrawals are expressed in **month-0 dollars** (the first month of the retirement simulation).

- `cumulativeInflation[t] = ∏(1 + inflation[i])` for i = 0 … t (product starts at 1 for t = 0)
- `realBalance[t] = nominalBalance[t] / cumulativeInflation[t]`
- `realWithdrawal[year] = nominalWithdrawal[year] / cumulativeInflation[firstMonthOfYear]`

**On "today's dollars":** Month 0 of the simulation is treated as the reference point. For historical backtests, "today" is the retirement start date of a given rolling window. For Monte Carlo, "today" is the date of the run. In practice, inflation data may lag by a few months to a few years; this difference is negligible for long-horizon analysis and is acceptable per project conventions.

**Why not use a fixed external reference date (e.g., 2024)?** Using month 0 keeps the engine stateless with respect to calendar dates — it operates on index arrays, not dates — and makes trajectories directly comparable within a run without an additional calendar-anchoring step.

---

## Convention 3 — Return application order within a month

Each month's computation follows this order:

1. If `monthOfYear === 0`: call `withdrawalFn`, store `annualNominalWithdrawal` for this year.
2. Deduct `annualNominalWithdrawal / 12` from balance (capped at current balance; excess is lost, not carried forward).
3. Apply blended return: `balance *= (1 + blendedReturn)` where `blendedReturn = w_us * r_us + w_intl * r_intl`.
4. Advance `cumulativeInflation` by `(1 + inflation[t])`.

**Rationale:** Withdrawing before applying returns models the retiree taking money out at the start of the period, then letting the remainder grow. This is the conventional assumption in academic FIRE literature and slightly conservative (slightly disadvantages the retiree vs. end-of-month withdrawal), which is appropriate for a planning tool that should not overstate sustainability.

---

## Convention 4 — Portfolio rebalancing: continuous via blended return

**Decision:** No discrete rebalancing events. The allocation is applied as fixed weights to compute a blended monthly return each period. This is equivalent to continuous rebalancing — the portfolio never drifts from its target allocation.

`blendedReturn[t] = w_us * usReturn[t] + w_intl * intlReturn[t]`

where `w_us + w_intl = 1` and both are non-negative.

**Alternative considered:** Annual rebalancing (track US and international sub-portfolios separately, rebalance once per year). This is more realistic for real-world portfolios but adds complexity (two balance lines, rebalancing cost modeling, potential for allocation drift between periods). For a planning tool, continuous rebalancing via blended returns is the standard simplification used in academic retirement research.

---

## Convention 5 — Depletion semantics

**Decision:**
- If `annualNominalWithdrawal / 12 > currentBalance`: deduct the entire remaining balance (not the requested amount). Balance becomes 0.
- Once balance reaches 0, it stays 0 for all subsequent months.
- `withdrawalFn` continues to be called each year even after depletion (it receives `MonthState` with `nominalBalance = 0` and `realBalance = 0`). The engine ignores the returned amount if balance is already 0.
- `depletionMonth` is set to the first month index where balance hits 0.
- `survived` is `true` if and only if the final month's balance is strictly greater than 0.

**Rationale:** Continuing to call `withdrawalFn` post-depletion keeps trajectories uniform in length (always `horizonYears * 12` months), which simplifies aggregation across many runs in historical and Monte Carlo modes. Strategies observe the depleted state naturally and may record it without special casing.

---

## Consequences

- Every withdrawal strategy must implement `(state: MonthState) => WithdrawalDecision` and reason in nominal dollars. Real-dollar conversion is the engine's responsibility, not the strategy's.
- The `Trajectory` type exposes both nominal and real series so callers can present either without further computation.
- Changing any of these five conventions post-merge requires updating every strategy, both simulation modes, and potentially stored test fixtures — treat them as immutable.

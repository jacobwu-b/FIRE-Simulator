Product Requirements Document (PRD)

FIRE Withdrawal Simulation Platform

⸻

1. Product Overview

This product is an interactive financial simulation tool that enables users to explore retirement outcomes under different withdrawal strategies using historically grounded and statistically modeled equity returns.

Users can adjust key retirement parameters in real time and immediately observe how different withdrawal strategies perform across:

* Historical market sequences (rolling periods)
* Synthetic Monte Carlo simulations

The system is designed to combine educational clarity with institutional-grade modeling rigor, enabling both intuitive exploration and analytically credible outputs.

⸻

2. Problem Statement

Most FIRE calculators oversimplify retirement risk by:

* Assuming constant returns or single-path projections
* Ignoring sequence-of-returns risk in a structured way
* Providing opaque or non-comparable withdrawal strategies

Users lack a tool that:

* Compares robust withdrawal strategies under realistic market behavior
* Separates historical truth from probabilistic simulation
* Provides intuitive, real-time feedback on retirement sustainability

⸻

3. Goals

Primary Goals

* Allow users to simulate retirement outcomes under multiple validated withdrawal strategies
* Quantify sustainability of retirement portfolios under real historical market sequences
* Provide clear comparison between historical and Monte Carlo-based outcomes
* Enable real-time interaction with parameters (within computational constraints)

Secondary Goals

* Educate users on tradeoffs between withdrawal strategies
* Visualize sequence-of-returns risk intuitively
* Encourage financially responsible withdrawal behavior grounded in established research

⸻

4. Non-Goals

* No tax modeling
* No alternative asset classes beyond equities (initially 100% equity portfolios only, with US/international split)
* No user-defined arbitrary or experimental withdrawal strategies
* No intraday or high-frequency modeling
* No mobile optimization

⸻

5. Core User Experience

Users interact with:

A. Parameter Controls

* Initial retirement portfolio value
* Equity allocation:
    * US equities %
    * International equities %
* Retirement horizon (e.g. 30–70 years)
* Withdrawal strategy selection
* Strategy-specific parameters (e.g. withdrawal rate, guardrail thresholds)

All inputs are continuous where appropriate and designed for rapid scenario exploration.

⸻

B. Withdrawal Strategies (Supported Set)

Only academically or advisor-established strategies are included:

1. RMD / Life-Expectancy-Based Withdrawal
    * Annual withdrawal = real portfolio balance / remaining horizon years,
      converted to nominal dollars
    * Draws down the portfolio in proportion to remaining life expectancy
2. Fixed Percentage Withdrawal
    * Constant percentage of portfolio value annually
3. Guyton-Klinger Guardrails Strategy
    * Dynamic adjustment based on portfolio performance bands
    * Includes:
        * withdrawal increase rule (prosperity rule: +10% when WR 20% below initial)
        * withdrawal cut rule (capital-preservation rule: −10% when WR 20% above initial)
        * inflation adjustment logic (freeze after a down year when WR exceeds initial)
4. Inflation-Adjusted Hybrid Baseline Strategy
    * Percentage-of-balance withdrawal clamped to an inflation-adjusted
      floor (−20% of initial real) and ceiling (+25% of initial real)

Each strategy is deterministic and fully reproducible.

⸻

C. Simulation Modes

Each user configuration produces two independent simulation outputs:

1. Historical Backtest Mode

* Uses rolling historical market sequences
* Based on monthly return data aggregated into annual withdrawal cycles
* Evaluates every valid retirement start period in dataset

Outputs:

* Survival rate (portfolio remains > 0 at horizon)
* Distribution of ending portfolio values
* Distribution of annual withdrawals over time

⸻

2. Monte Carlo Mode

* Uses synthetic return generation calibrated to historical data characteristics
* Preserves volatility clustering and return distribution properties at a high level
* Produces large-sample probabilistic outcomes

Outputs:

* Survival probability distribution
* Expected and percentile outcomes for ending wealth
* Variance of withdrawal paths

⸻

6. Output Metrics

All outputs are shown as aggregated distributions, not single-point estimates.

Primary Metrics

* Survival Rate
    * Probability portfolio remains positive at end of horizon
* Ending Portfolio Value
    * Mean, median, variance, percentiles
* Withdrawal Behavior
    * Mean annual withdrawal (real dollars)
    * Median withdrawal
    * Variance over time

⸻

Secondary Metrics

* Maximum drawdown across retirement period
* Worst-case historical sequence performance
* Failure year distribution (if depletion occurs)

⸻

7. Visualization Requirements

The interface must support:

* Real-time updating summary metrics
* Time-series visualization of portfolio trajectories
* Distribution views for:
    * ending wealth
    * survival outcomes
* Side-by-side comparison between:
    * historical vs Monte Carlo outputs

Visualizations must emphasize:

* distribution over certainty
* risk variability across time sequences
* sensitivity to parameter changes

⸻

8. Data Requirements

* Monthly historical return data for:
    * US equities
    * International equities
* Inflation index for real-return normalization

All simulation outputs must be expressed in real (inflation-adjusted) terms, unless explicitly overridden by strategy logic.

Annual aggregation is used only for visualization and reporting layers; simulation operates at monthly granularity.

⸻

9. System Behavior Requirements

* Annual withdrawal decision at start of each year; engine deducts 1/12 of the annual amount each month (see ADR 0003)
* Deterministic execution for identical inputs
* Separation of:
    * historical deterministic outcomes
    * probabilistic Monte Carlo outcomes
* Consistent inflation adjustment across all strategies

⸻

10. Performance Expectations

* Parameter changes should trigger updated results in near real time where feasible
* If real-time response is not achievable:
    * correctness and completeness of simulation outputs take priority
* System should degrade gracefully under computational load (e.g., by simplifying update frequency rather than reducing model fidelity)

⸻

11. Success Metrics

* Users can clearly distinguish between strategies based on survival rate differences
* Users can understand how parameter changes affect long-term outcomes within seconds
* Historical vs Monte Carlo divergence is interpretable, not confusing
* Users can identify withdrawal strategies that dominate others under most conditions

⸻

12. Key Design Principles

* Truth over simplicity: do not oversimplify financial risk
* Comparability over isolation: all strategies must be directly comparable
* Distribution over point estimates: always show uncertainty
* Historical grounding first: Monte Carlo is secondary validation, not primary truth
* Deterministic strategies only: no probabilistic user-defined behaviors

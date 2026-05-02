# 0002 — Historical Market Data Sources

**Date:** 2026-05-01  
**Status:** Accepted  
**Deciders:** Jacob Wu

---

## Context

The simulation engine requires three monthly time series:

1. **US equity total returns** — used as the US-equity component of the portfolio.
2. **International (developed-market) equity total returns** — used as the non-US-equity component.
3. **US inflation (CPI)** — used to convert nominal returns to real returns and to adjust withdrawals.

Data must be:
- Monthly granularity (simulation operates at monthly resolution per PRD §8).
- Committed to the repo (no runtime network calls, per arch invariant §3.2).
- From sources that permit academic/non-commercial redistribution.
- As long as possible while maintaining data quality; target ≥100 years for US equity.

---

## Candidates considered

### US equity

| Source | Longevity | License | Notes |
|--------|-----------|---------|-------|
| Robert Shiller / Yale ("Irrational Exuberance" dataset) | 1871–present | Public domain (academic) | Requires Excel parser for raw XLS; CPI also embedded |
| **Fama-French Research Data Factors (monthly)** | **1926-07–present** | **Free for academic/non-commercial use** | **Total return = Mkt-RF + RF; CRSP value-weighted** |
| FRED SP500 series | 1928–present | Public domain | Price return only — excludes dividends |
| Bloomberg / Refinitiv | Full history | Proprietary | Not redistributable |

### International equity

| Source | Longevity | License | Notes |
|--------|-----------|---------|-------|
| **Fama-French Developed ex-US 3 Factors (monthly)** | **1990-07–present** | **Free for academic/non-commercial use** | **Total return = Mkt-RF + RF** |
| MSCI EAFE (official) | 1969–present | Licensed; © MSCI Inc. | Not freely redistributable |
| DMS (Dimson-Marsh-Staunton) | 1900–present | Licensed | Not freely redistributable |
| Ken French "International" older series | 1975–present | Free | Covers fewer markets than EAFE |

### CPI / Inflation

| Source | Longevity | License | Notes |
|--------|-----------|---------|-------|
| **FRED CPIAUCNS (BLS CPI for All Urban Consumers, NSA)** | **1913–present** | **US Government / public domain** | Standard CPI series used in academic retirement research |
| BLS download | Same | Same | Direct BLS access; same data, less stable URL |
| Shiller CPI (from Yale dataset) | 1871–present | Public domain | Embedded in the US equity XLS; usable if Excel parsing is added |

---

## Decision

Use **Fama-French** for both equity series and **FRED CPIAUCNS** for inflation.

**Rationale:**

1. **US equity — Fama-French Research Data Factors (monthly).** The CRSP value-weighted market portfolio (Mkt-RF + RF) is the standard academic US equity proxy, broadly equivalent to VTI/VTSMX. Data starts July 1926, giving ~99 years of history — close enough to the 100-year target. License is free for non-commercial academic use. File is a plain CSV in a ZIP, parseable without any non-stdlib dependency.

2. **International equity — Fama-French Developed ex-US 3 Factors (monthly).** Covers 23 developed markets excluding the US (broadly MSCI EAFE-equivalent). Data starts July 1990, giving ~36 years. This is shorter than ideal, but it is the longest freely available, non-licensed international series. MSCI EAFE and DMS are both licensed. The 1990-onward window still covers multiple full business cycles and major equity drawdowns (Dot-com, GFC, COVID-19). Extending this series retroactively would require licensing MSCI or DMS data, which is out of scope for MVP.

3. **CPI — FRED CPIAUCNS.** The standard US CPI series used in academic withdrawal-rate research (Bengen 1994, Trinity Study, etc.), published by the BLS and mirrored on FRED. Public domain. Goes back to January 1913. The FRED CSV endpoint is stable and the format is simple.

### Aligned date range

The common intersection of the three committed series is **1990-07 through 2025-09** (~419 months / ~35 years). This is determined by the international equity start date and the CPI truncation point (see Data quality note below).

For purely US-equity simulations that ignore international allocation (0 % international), the US equity series could be used from 1926-07, giving ~99 years of rolling periods. This is not implemented in MVP but is architecturally supported by the loader's clip logic.

---

## Data files and provenance

| File | Source series | Retrieved | Rows | Date range |
|------|--------------|-----------|------|------------|
| `src/data/us-equity-monthly.json` | Fama-French F-F Research Data Factors (monthly) | 2026-05-01 | 1,196 | 1926-07 – 2026-02 |
| `src/data/intl-equity-monthly.json` | Fama-French Developed ex-US 3 Factors (monthly) | 2026-05-01 | 428 | 1990-07 – 2026-02 |
| `src/data/cpi-monthly.json` | FRED CPIAUCNS (BLS CPI-U, NSA) | 2026-05-01 | 1,352 | 1913-02 – 2025-09 |

**Return computation:**  
`total_return[t] = (Mkt-RF[t] + RF[t]) / 100`  
where Mkt-RF and RF are sourced from the Fama-French monthly factor CSV files (values are expressed as percentages in the raw data).

**Inflation computation:**  
`inflation[t] = CPI[t] / CPI[t-1] - 1`  
where CPI[t] is the raw CPIAUCNS index level for month t.

**Data quality note — CPI gap:**  
The FRED CPIAUCNS series as fetched on 2026-05-01 was missing the raw October 2025 index value. The fetch script detects this and truncates the series at 2025-09 (the last complete month before the gap) rather than producing a two-month ratio. The equity series (through 2026-02) are unaffected; the loader clips to the intersection.

**Fetch script:** `scripts/fetch-market-data.py` — re-running this script will regenerate all three JSON files from their authoritative sources. The script is idempotent and records the retrieval date in each file's metadata.

---

## Consequences

- The committed data is a snapshot. It will grow stale as new months pass. Re-running `scripts/fetch-market-data.py` and committing the result is the update procedure.
- The 36-year international window limits rolling-period analysis for portfolios with international allocation (only ~6 non-overlapping 5-year periods). This is acceptable for MVP; upgrading to a longer licensed series is a tracked future enhancement.
- The loader enforces strict monotonicity and no-gap invariants at startup. If a future update introduces a gap in the raw data, the fetch script will truncate cleanly and the loader will still pass validation.
- All values are expressed in nominal terms in the committed data files. Real-return conversion is the responsibility of the simulation layer, using the `cpi` series.

---

## License summary

| Data | License |
|------|---------|
| Fama-French Research Data | Free for academic and non-commercial use. Attribution to Kenneth R. French and Eugene F. Fama is required in publications. No redistribution for commercial purposes without explicit permission. |
| FRED / BLS CPI | US Government data. Public domain. No redistribution restrictions. |

**This project is non-commercial academic/personal software. Both licenses are compatible with the intended use.**

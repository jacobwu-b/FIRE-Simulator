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
| **Bank of England Millennium Dataset (UK equity as proxy)** | **1925–1990** | **Public domain (BoE)** | **Historical UK equity; used as pre-1990 proxy** |
| **Fama-French Developed ex-US 3 Factors (monthly)** | **1990-07–present** | **Free for academic/non-commercial use** | **Total return = Mkt-RF + RF; used 1990-onward** |
| MSCI EAFE (official) | 1969–present | Licensed; © MSCI Inc. | Not freely redistributable |
| DMS (Dimson-Marsh-Staunton) | 1900–present | Licensed | Not freely redistributable; annual only in PDFs |
| Global Financial Data (GFD) | 1800–present | Licensed | Not freely redistributable |

### CPI / Inflation

| Source | Longevity | License | Notes |
|--------|-----------|---------|-------|
| **FRED CPIAUCNS (BLS CPI for All Urban Consumers, NSA)** | **1913–present** | **US Government / public domain** | Standard CPI series used in academic retirement research |
| BLS download | Same | Same | Direct BLS access; same data, less stable URL |
| Shiller CPI (from Yale dataset) | 1871–present | Public domain | Embedded in the US equity XLS; usable if Excel parsing is added |

---

## Decision

Use **spliced international data** (BoE UK proxy 1926–1990 + Fama-French 1990–present), **US equity from Fama-French**, and **FRED CPIAUCNS** for inflation.

**Rationale:**

1. **US equity — Fama-French Research Data Factors (monthly).** The CRSP value-weighted market portfolio (Mkt-RF + RF) is the standard academic US equity proxy, broadly equivalent to VTI/VTSMX. Data starts July 1926, giving ~99 years of history — meets the 100-year target. License is free for non-commercial academic use.

2. **International equity — Spliced series (BoE + Fama-French).** Desired outcome: ~100 years of ex-US developed-market data. Challenge: Fama-French Developed ex-US only covers 1990-present (~36 years); MSCI EAFE and DMS are both licensed. Solution: Use Bank of England Millennium Dataset UK equity as a free proxy for 1926–1990, then splice with Fama-French 1990-present. 
   - **1926-01 to 1990-06:** UK equity from BoE Millennium Dataset (spliced index, col. 23). Returns computed as monthly price changes; dividend component estimated as decade-level yields (5.5% 1926–32, 5.0% 1933–39, 4.0% 1940–49, 4.5% 1950–69, 5.5% 1970–79, 5.0% 1980–90, interpolated monthly). This is a single-country approximation with estimated dividends, introducing lower quality than the post-1990 data, but provides long-term context for rolling-period analysis. UK equity is a reasonable proxy for historical developed-market equity behavior (correlated with MSCI EAFE, benefits from similar macro environments).
   - **1990-07 to present:** Fama-French Developed ex-US (Mkt-RF + RF), covering 23 developed markets. High-quality official data.
   - Splice boundary validated: no overlap, clean handoff at 1990-06/1990-07 boundary.

3. **CPI — FRED CPIAUCNS.** The standard US CPI series used in academic withdrawal-rate research (Bengen 1994, Trinity Study, etc.), published by the BLS and mirrored on FRED. Public domain. Goes back to January 1913.

### Aligned date range

The common intersection of the three committed series is **1990-07 through 2025-09** (~419 months / ~35 years). This is determined by the Fama-French international start date and the CPI truncation point (see Data quality note below).

However, the international dataset now spans **1926-01 to 2026-02** (~100 years), enabling rolling-period analysis for any portfolio composition, not just US-only. The loader's clip logic allows future analysis modes to use the full extent of each series independently.

---

## Data files and provenance

| File | Source series | Retrieved | Rows | Date range | Notes |
|------|--------------|-----------|------|------------|-------|
| `src/data/us-equity-monthly.json` | Fama-French Research Data Factors (monthly) | 2026-05-01 | 1,196 | 1926-07 – 2026-02 | CRSP value-weighted, high quality |
| `src/data/intl-equity-monthly.json` | Spliced: BoE UK + Fama-French (1926–2026) | 2026-05-01 | 1,213 | 1926-01 – 2026-02 | 785 rows BoE (1926-01 to 1990-06); 428 rows F-F (1990-07 to 2026-02) |
| `src/data/cpi-monthly.json` | FRED CPIAUCNS (BLS CPI-U, NSA) | 2026-05-01 | 1,352 | 1913-02 – 2025-09 | Truncated at 2025-09 due to Oct 2025 gap |

**Return computation:**

- **Fama-French data (US equity, intl 1990+):**  
  `total_return[t] = (Mkt-RF[t] + RF[t]) / 100`  
  where values are percentages in raw CSV files.

- **UK equity proxy (intl 1926–1990):**  
  `total_return[t] = (Price_Index[t] / Price_Index[t-1] - 1) + Dividend_Yield[t]`  
  where Price_Index is from BoE Millennium col. 23 (spliced UK equity price index) and Dividend_Yield is estimated by decade (see rationale above), interpolated monthly.

**Inflation computation:**  
`inflation[t] = CPI[t] / CPI[t-1] - 1`  
where CPI[t] is the raw CPIAUCNS index level for month t.

**Data quality notes:**

- **International equity — BoE pre-1990 (1926–1990, 785 months):** Single-country (UK) approximation with estimated dividend yields. UK equity historically correlates with developed-market equity behavior and experienced similar macroeconomic shocks (WWII, stagflation, recessions) as broader DM indices. Quality is lower than post-1990 data (dividends estimated by decade) but sufficient for long-term rolling-period analysis.

- **International equity — Fama-French post-1990 (1990–2026, 428 months):** High-quality official data covering 23 developed markets (MSCI EAFE-equivalent).

- **CPI gap:** The FRED CPIAUCNS series as fetched on 2026-05-01 was missing the raw October 2025 index value. The fetch script detects this and truncates the series at 2025-09 (last complete month before the gap).

**Fetch script:** `scripts/fetch-market-data.py` — regenerates all three JSON files from authoritative sources. The script is idempotent, records retrieval date in metadata, and validates the BoE/Fama-French splice for continuity and no gaps.

---

## Consequences

- The committed data is a snapshot. It will grow stale as new months pass. Re-running `scripts/fetch-market-data.py` and committing the result is the update procedure.
- International data now spans ~100 years (1926–2026), enabling rolling-period analysis for any portfolio composition. Trade-off: pre-1990 data is UK equity with estimated dividends (lower quality) rather than a true developed-market index, but sufficient for long-term historical context.
- The BoE/Fama-French splice is validated at fetch time; if either source becomes unavailable, the splice logic will fail loudly rather than silently producing partial data.
- The loader enforces strict monotonicity and no-gap invariants at startup. If a future update introduces a gap in the raw data, the fetch script will truncate cleanly and the loader will still pass validation.
- All values are expressed in nominal terms in the committed data files. Real-return conversion is the responsibility of the simulation layer, using the `cpi` series.

---

## License summary

| Data | License |
|------|---------|
| Fama-French Research Data | Free for academic and non-commercial use. Attribution to Kenneth R. French and Eugene F. Fama is required in publications. No redistribution for commercial purposes without explicit permission. |
| Bank of England Millennium Dataset | Public domain. Bank of England data release. No restrictions on academic or non-commercial use. |
| FRED / BLS CPI | US Government data. Public domain. No redistribution restrictions. |

**This project is non-commercial academic/personal software. All licenses are compatible with the intended use.**

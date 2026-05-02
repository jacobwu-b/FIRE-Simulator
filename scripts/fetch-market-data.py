#!/usr/bin/env python3
"""
Data preparation script — run once to generate committed JSON data files.

Sources:
  US equity:    Fama-French Research Data Factors (monthly, 1926-07 onward)
                https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_CSV.zip
                Market return = Mkt-RF + RF  (CRSP value-weighted US market)

  Intl equity:  TWO-PART SPLICED SERIES
                Part A (1926-01 to 1990-06) — Bank of England Millennium Dataset, M13 sheet
                  https://www.bankofengland.co.uk/-/media/boe/files/statistics/research-datasets/a-millennium-of-macroeconomic-data-for-the-uk.xlsx
                  Column 23: spliced market-cap-weighted UK share price index (Apr 1962=100)
                  Approximate total return = monthly price change + monthly dividend yield estimate
                  Dividend yields are decade-level estimates from DMS literature (see ADR)
                Part B (1990-07 onward) — Fama-French Developed ex-US 3 Factors (monthly)
                  https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/Developed_ex_US_3_Factors_CSV.zip
                  Market return = Mkt-RF + RF

  CPI:          FRED CPIAUCNS — CPI for All Urban Consumers, Not Seasonally Adjusted
                https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCNS
                Inflation = CPI[t] / CPI[t-1] - 1

Output files (written relative to repo root src/data/):
  us-equity-monthly.json
  intl-equity-monthly.json
  cpi-monthly.json
"""

import csv
import io
import json
import subprocess
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime
from pathlib import Path

RETRIEVAL_DATE = "2026-05-02"
OUT_DIR = Path(__file__).parent.parent / "src" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Cache large files locally to avoid re-downloading on re-runs
CACHE_DIR = Path(__file__).parent / "_cache"
CACHE_DIR.mkdir(exist_ok=True)


def fetch_url(url: str) -> bytes:
    """Fetch URL; use curl for FRED (urllib times out against that host)."""
    print(f"  Fetching {url} ...")
    if "stlouisfed.org" in url or "fred." in url:
        result = subprocess.run(
            ["curl", "-s", "--max-time", "60", "--retry", "2", "-L", url],
            capture_output=True,
            check=True,
        )
        data = result.stdout
    else:
        req = urllib.request.Request(url, headers={"User-Agent": "FIRE-Simulator/data-prep"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
    print(f"  → {len(data):,} bytes")
    return data


def fetch_cached(url: str, cache_name: str) -> bytes:
    """Fetch URL with local file cache to avoid repeated large downloads."""
    cache_path = CACHE_DIR / cache_name
    if cache_path.exists():
        print(f"  Using cached {cache_path} ({cache_path.stat().st_size:,} bytes)")
        return cache_path.read_bytes()
    data = fetch_url(url)
    cache_path.write_bytes(data)
    return data


def parse_ym(s: str) -> str:
    """Convert YYYYMM integer string to 'YYYY-MM'."""
    s = s.strip()
    return f"{s[:4]}-{s[4:6]}"


def next_ym(ym: str) -> str:
    y, m = int(ym[:4]), int(ym[5:7])
    m += 1
    if m > 12:
        m, y = 1, y + 1
    return f"{y:04d}-{m:02d}"


def build_metadata(source: str, description: str, license_text: str) -> dict:
    return {
        "source": source,
        "description": description,
        "retrieved": RETRIEVAL_DATE,
        "license": license_text,
        "frequency": "monthly",
        "units": "decimal_return",
    }


# ---------------------------------------------------------------------------
# US equity — Fama-French Research Data Factors (monthly)
# ---------------------------------------------------------------------------
def fetch_us_equity() -> list[dict]:
    url = "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_CSV.zip"
    raw = fetch_url(url)

    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        name = [n for n in zf.namelist() if n.upper().endswith(".CSV")][0]
        text = zf.read(name).decode("latin-1")

    lines = text.splitlines()
    in_monthly = False
    records = []
    for line in lines:
        stripped = line.strip()
        if not in_monthly:
            if stripped and stripped[0].isdigit() and len(stripped.split(",")[0].strip()) == 6:
                in_monthly = True
            else:
                continue
        if not stripped:
            break
        parts = [p.strip() for p in stripped.split(",")]
        if len(parts) < 5 or not parts[0].isdigit():
            continue
        try:
            yyyymm = parts[0]
            mkt_rf = float(parts[1]) / 100.0
            rf = float(parts[4]) / 100.0
            records.append({"date": parse_ym(yyyymm), "value": round(mkt_rf + rf, 8)})
        except (ValueError, IndexError):
            continue

    print(f"  US equity: {len(records)} monthly rows, {records[0]['date']} – {records[-1]['date']}")
    return records


# ---------------------------------------------------------------------------
# International equity — Part A: BOE UK equity proxy (1926-01 to 1990-06)
# ---------------------------------------------------------------------------

# Annual UK equity dividend yields (percent) by decade, from DMS literature.
# UK dividend yields were consistently in the 4–6% range for this era.
# Monthly dividend component = annual_yield_pct / 12 / 100.
_UK_DIV_YIELDS: dict[tuple[int, int], float] = {
    (1926, 1932): 5.5,   # Great Depression / late-1920s boom: high nominal yields
    (1933, 1939): 5.0,   # Interwar recovery
    (1940, 1949): 4.0,   # Wartime controls depressed yields
    (1950, 1959): 4.5,   # Post-war recovery
    (1960, 1969): 4.8,   # Expansion
    (1970, 1979): 5.5,   # Stagflation: high nominal yields
    (1980, 1990): 5.0,   # Thatcher era, moderating
}


def _uk_div_yield_monthly(year: int) -> float:
    for (start, end), pct in _UK_DIV_YIELDS.items():
        if start <= year <= end:
            return pct / 12.0 / 100.0
    return 0.045 / 12.0  # fallback 4.5%


def _col_to_num(col_str: str) -> int:
    n = 0
    for ch in col_str:
        n = n * 26 + (ord(ch) - ord("A") + 1)
    return n - 1


def fetch_boe_uk_equity_proxy() -> list[dict]:
    """
    Extract monthly UK equity total returns from the Bank of England
    Millennium Dataset (M13 sheet, col 23: spliced cap-weighted price index).

    Returns records for 1926-01 through 1990-06 only.
    Total return ≈ price return + monthly dividend yield estimate.
    """
    url = "https://www.bankofengland.co.uk/-/media/boe/files/statistics/research-datasets/a-millennium-of-macroeconomic-data-for-the-uk.xlsx"
    raw = fetch_cached(url, "boe_millennium.xlsx")

    ns_s = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"

    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        # Shared strings (string cell values are stored by index)
        ss_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
        shared_strings = [
            "".join(t.text or "" for t in si.findall(f"{{{ns_s}}}t"))
            for si in ss_root.findall(f"{{{ns_s}}}si")
        ]

        # Locate the M13 sheet file
        wb = ET.fromstring(zf.read("xl/workbook.xml"))
        wb_ns = {
            "w": ns_s,
            "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        }
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        sheet_map = {
            rel.get("Id"): rel.get("Target")
            for rel in rels.findall(
                "{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"
            )
        }

        m13_path = None
        for sh in wb.findall(".//w:sheet", wb_ns):
            if "M13" in sh.get("name", ""):
                rid = sh.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
                target = sheet_map[rid]
                m13_path = f"xl/{target}" if not target.startswith("xl/") else target
                break

        if m13_path is None:
            raise RuntimeError("M13 sheet not found in BOE workbook")

        ws_root = ET.fromstring(zf.read(m13_path))

    MONTHS = {
        "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4,
        "May": 5, "Jun": 6, "Jul": 7, "Aug": 8,
        "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
    }

    # Extract (year, month, col23_value) for 1925-12 onward (need Dec 1925 as base)
    def get_cell(c: ET.Element) -> str:
        t = c.get("t", "")
        v_el = c.find(f"{{{ns_s}}}v")
        v = v_el.text if v_el is not None else ""
        if t == "s" and v:
            v = shared_strings[int(v)]
        return v

    raw_points: list[tuple[int, int, float]] = []  # (year, month, index_value)
    cur_year: int | None = None

    for row_el in ws_root.findall(f".//{{{ns_s}}}row"):
        cells: dict[int, str] = {}
        for c in row_el.findall(f"{{{ns_s}}}c"):
            ref = c.get("r", "")
            col_str = "".join(ch for ch in ref if ch.isalpha())
            cells[_col_to_num(col_str)] = get_cell(c)

        yr_str = cells.get(0, "").strip()
        mo_str = cells.get(1, "").strip()

        if yr_str.isdigit():
            cur_year = int(yr_str)

        if cur_year is None or cur_year < 1925:
            continue
        if cur_year > 1990:
            break

        if mo_str not in MONTHS:
            continue

        col23 = cells.get(23, "").strip()
        if not col23:
            continue

        try:
            raw_points.append((cur_year, MONTHS[mo_str], float(col23)))
        except ValueError:
            continue

    if not raw_points:
        raise RuntimeError("No data extracted from BOE M13 col 23")

    # Compute monthly price returns from consecutive index values,
    # then add estimated monthly dividend yield.
    records: list[dict] = []
    for i in range(1, len(raw_points)):
        yr_prev, mo_prev, idx_prev = raw_points[i - 1]
        yr_curr, mo_curr, idx_curr = raw_points[i]

        # Verify consecutive months
        expected_next_yr = yr_prev + (mo_prev // 12)
        expected_next_mo = (mo_prev % 12) + 1
        if yr_curr != expected_next_yr or mo_curr != expected_next_mo:
            date_str = f"{yr_curr:04d}-{mo_curr:02d}"
            prev_str = f"{yr_prev:04d}-{mo_prev:02d}"
            raise RuntimeError(
                f"BOE M13 col 23 gap: expected month after {prev_str}, got {date_str}"
            )

        # Exclude months beyond 1990-06 (F-F Developed ex-US takes over at 1990-07)
        if yr_curr > 1990 or (yr_curr == 1990 and mo_curr > 6):
            break

        price_return = idx_curr / idx_prev - 1.0
        div_monthly = _uk_div_yield_monthly(yr_curr)
        total_return = price_return + div_monthly

        date_str = f"{yr_curr:04d}-{mo_curr:02d}"
        records.append({"date": date_str, "value": round(total_return, 8)})

    print(f"  BOE UK proxy: {len(records)} monthly rows, {records[0]['date']} – {records[-1]['date']}")
    return records


# ---------------------------------------------------------------------------
# International equity — Part B: Fama-French Developed ex-US (1990-07 onward)
# ---------------------------------------------------------------------------
def fetch_ff_developed_ex_us() -> list[dict]:
    url = "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/Developed_ex_US_3_Factors_CSV.zip"
    raw = fetch_url(url)

    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        name = [n for n in zf.namelist() if n.upper().endswith(".CSV")][0]
        text = zf.read(name).decode("latin-1")

    lines = text.splitlines()
    in_monthly = False
    records = []
    for line in lines:
        stripped = line.strip()
        if not in_monthly:
            if stripped and stripped[0].isdigit() and len(stripped.split(",")[0].strip()) == 6:
                in_monthly = True
            else:
                continue
        if not stripped:
            break
        parts = [p.strip() for p in stripped.split(",")]
        if len(parts) < 5 or not parts[0].isdigit():
            continue
        try:
            yyyymm = parts[0]
            mkt_rf = float(parts[1]) / 100.0
            rf = float(parts[4]) / 100.0
            records.append({"date": parse_ym(yyyymm), "value": round(mkt_rf + rf, 8)})
        except (ValueError, IndexError):
            continue

    print(f"  F-F Developed ex-US: {len(records)} monthly rows, {records[0]['date']} – {records[-1]['date']}")
    return records


# ---------------------------------------------------------------------------
# International equity — splice Part A + Part B
# ---------------------------------------------------------------------------
def build_intl_equity() -> list[dict]:
    uk_proxy = fetch_boe_uk_equity_proxy()     # 1926-01 → 1990-06
    ff_intl = fetch_ff_developed_ex_us()        # 1990-07 → latest

    # Verify no overlap and clean boundary
    assert uk_proxy[-1]["date"] == "1990-06", f"UK proxy last date: {uk_proxy[-1]['date']}"
    assert ff_intl[0]["date"] == "1990-07", f"F-F first date: {ff_intl[0]['date']}"

    spliced = uk_proxy + ff_intl

    # Validate full series is gap-free
    for i in range(1, len(spliced)):
        expected = next_ym(spliced[i - 1]["date"])
        if spliced[i]["date"] != expected:
            raise RuntimeError(
                f"Gap in spliced intl series: expected {expected}, got {spliced[i]['date']}"
            )

    print(
        f"  Spliced intl: {len(spliced)} total rows, "
        f"{spliced[0]['date']} – {spliced[-1]['date']} "
        f"({len(uk_proxy)} UK proxy + {len(ff_intl)} F-F)"
    )
    return spliced


# ---------------------------------------------------------------------------
# CPI — FRED CPIAUCNS
# ---------------------------------------------------------------------------
def fetch_cpi() -> list[dict]:
    url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCNS"
    raw = fetch_url(url)

    reader = csv.reader(io.StringIO(raw.decode("utf-8")))
    next(reader)  # skip header

    rows: list[tuple[str, float]] = []
    for row in reader:
        if len(row) < 2 or not row[1].strip() or row[1].strip() == ".":
            continue
        d = datetime.strptime(row[0].strip(), "%Y-%m-%d")
        rows.append((f"{d.year:04d}-{d.month:02d}", float(row[1])))

    # Build inflation; truncate at first raw-data gap so the output is gap-free.
    records = []
    for i in range(1, len(rows)):
        date_prev, cpi_prev = rows[i - 1]
        date_curr, cpi_curr = rows[i]
        if date_curr != next_ym(date_prev):
            print(f"  WARNING: raw CPI gap {date_prev} → {date_curr}; truncating series here")
            break
        inflation = cpi_curr / cpi_prev - 1.0
        records.append({"date": date_curr, "value": round(inflation, 8)})

    print(f"  CPI: {len(records)} monthly rows, {records[0]['date']} – {records[-1]['date']}")
    return records


# ---------------------------------------------------------------------------
# Write output JSON
# ---------------------------------------------------------------------------
def write_json(filename: str, metadata: dict, series: list[dict]) -> None:
    out = {"metadata": metadata, "series": series}
    path = OUT_DIR / filename
    path.write_text(json.dumps(out, indent=2) + "\n")
    print(f"  Wrote {path} ({path.stat().st_size:,} bytes)")


def main() -> None:
    print("=== Fetching US equity (Fama-French) ===")
    us_series = fetch_us_equity()
    write_json(
        "us-equity-monthly.json",
        build_metadata(
            source="Kenneth R. French Data Library — F-F Research Data Factors (monthly)",
            description=(
                "Monthly total return of CRSP value-weighted US equity market "
                "(Mkt-RF + RF from Fama-French monthly factors). Equivalent to a "
                "broad US total-market index proxy (similar to VTI/VTSMX)."
            ),
            license_text="Free for academic/non-commercial use per Kenneth French Data Library terms",
        ),
        us_series,
    )

    print("\n=== Building international equity (spliced series) ===")
    intl_series = build_intl_equity()
    write_json(
        "intl-equity-monthly.json",
        build_metadata(
            source=(
                "1926-01 to 1990-06: Bank of England Millennium Dataset M13 col 23 "
                "(spliced cap-weighted UK share price index) + estimated dividend yields; "
                "1990-07 onward: Kenneth R. French Data Library — Developed ex-US 3 Factors"
            ),
            description=(
                "Monthly total return of international developed equity. "
                "1926-01 to 1990-06: UK equity price proxy (BOE Millennium Dataset, "
                "spliced cap-weighted index) with estimated decade-level dividend yields — "
                "use as rough regime-sequence proxy only; dividend component is approximate. "
                "1990-07 onward: Fama-French Developed ex-US (Mkt-RF + RF), covers "
                "Western Europe, Japan, Pacific ex-Japan. Broadly MSCI EAFE-equivalent."
            ),
            license_text=(
                "BOE Millennium Dataset: Crown copyright, open government licence. "
                "Fama-French: free for academic/non-commercial use."
            ),
        ),
        intl_series,
    )

    print("\n=== Fetching CPI (FRED CPIAUCNS) ===")
    cpi_series = fetch_cpi()
    write_json(
        "cpi-monthly.json",
        build_metadata(
            source="Federal Reserve Bank of St. Louis (FRED) — CPIAUCNS series",
            description=(
                "Monthly US CPI for All Urban Consumers, Not Seasonally Adjusted "
                "(BLS series CUUR0000SA0). Expressed as month-over-month fractional change."
            ),
            license_text="US Government data, public domain (BLS/FRED)",
        ),
        cpi_series,
    )

    print("\nDone.")


if __name__ == "__main__":
    main()

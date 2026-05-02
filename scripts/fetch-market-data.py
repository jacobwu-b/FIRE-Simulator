#!/usr/bin/env python3
"""
Data preparation script — run once to generate committed JSON data files.

Sources:
  US equity:    Fama-French Research Data Factors (monthly, 1926-07 onward)
                https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_CSV.zip
                Market return = Mkt-RF + RF  (CRSP value-weighted US market)

  Intl equity:  Fama-French Developed ex-US 3 Factors (monthly, 1990-07 onward)
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
import sys
import urllib.request
import zipfile
from datetime import date, datetime
from pathlib import Path

RETRIEVAL_DATE = "2026-05-01"
OUT_DIR = Path(__file__).parent.parent / "src" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def fetch_url(url: str) -> bytes:
    """Fetch URL; use curl for FRED (urllib times out against that host)."""
    import subprocess

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
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
    print(f"  → {len(data):,} bytes")
    return data


def parse_ym(s: str) -> str:
    """Convert YYYYMM integer string to 'YYYY-MM'."""
    s = s.strip()
    return f"{s[:4]}-{s[4:6]}"


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
        name = [n for n in zf.namelist() if n.endswith(".CSV") or n.endswith(".csv")][0]
        text = zf.read(name).decode("latin-1")

    # File has a header block then monthly data then annual data.
    # Monthly section starts after the first blank line following the header.
    lines = text.splitlines()

    # Find the monthly data section (before the blank line that precedes "Annual Factors")
    in_monthly = False
    records = []
    for line in lines:
        stripped = line.strip()
        if not in_monthly:
            # First row of data: 6-digit YYYYMM followed by numbers
            if stripped and stripped[0].isdigit() and len(stripped.split(",")[0].strip()) == 6:
                in_monthly = True
            else:
                continue
        if not stripped:
            # Blank line ends the monthly section
            break
        parts = [p.strip() for p in stripped.split(",")]
        if len(parts) < 5 or not parts[0].isdigit():
            continue
        try:
            yyyymm = parts[0]
            mkt_rf = float(parts[1]) / 100.0
            rf = float(parts[4]) / 100.0
            total_return = mkt_rf + rf
            records.append({"date": parse_ym(yyyymm), "value": round(total_return, 8)})
        except (ValueError, IndexError):
            continue

    print(f"  US equity: {len(records)} monthly rows, {records[0]['date']} – {records[-1]['date']}")
    return records


# ---------------------------------------------------------------------------
# International equity — Fama-French Developed ex-US 3 Factors (monthly)
# ---------------------------------------------------------------------------
def fetch_intl_equity() -> list[dict]:
    url = "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/Developed_ex_US_3_Factors_CSV.zip"
    raw = fetch_url(url)

    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        name = [n for n in zf.namelist() if n.endswith(".CSV") or n.endswith(".csv")][0]
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
            total_return = mkt_rf + rf
            records.append({"date": parse_ym(yyyymm), "value": round(total_return, 8)})
        except (ValueError, IndexError):
            continue

    print(f"  Intl equity: {len(records)} monthly rows, {records[0]['date']} – {records[-1]['date']}")
    return records


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

    # Monthly inflation = CPI[t] / CPI[t-1] - 1.
    # Skip rows where source is not exactly 1 month apart (data gaps from BLS).
    from calendar import monthrange

    def next_ym(ym: str) -> str:
        y, m = int(ym[:4]), int(ym[5:7])
        m += 1
        if m > 12:
            m, y = 1, y + 1
        return f"{y:04d}-{m:02d}"

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

    print("\n=== Fetching international equity (Fama-French Developed ex-US) ===")
    intl_series = fetch_intl_equity()
    write_json(
        "intl-equity-monthly.json",
        build_metadata(
            source="Kenneth R. French Data Library — Developed ex-US 3 Factors (monthly)",
            description=(
                "Monthly total return of MSCI-like developed markets ex-US equity "
                "(Mkt-RF + RF). Covers Western Europe, Japan, Pacific ex-Japan. "
                "Broadly equivalent to VXUS-developed / MSCI EAFE proxy."
            ),
            license_text="Free for academic/non-commercial use per Kenneth French Data Library terms",
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

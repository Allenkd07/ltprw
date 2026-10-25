"""Fetch national wind actuals (FUELHH) and forecasts (WINDFOR) from Elexon BMRS into CSVs.

Scope: day-ahead purchase decisions made in January 2026, i.e. delivery days
2026-01-02 .. 2026-02-01. Forecast publishes start on 2025-12-31 so that early-morning
cutoffs on 1 Jan still have an earlier run to fall back on.

Usage (from backend/):  python -m ingest.fetch_elexon
"""

import argparse
from datetime import date, datetime, timedelta

import httpx
import pandas as pd

from app.config import settings
from app.data.store import ACTUALS_FILE, FORECASTS_FILE

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
CHUNK_DAYS = 7


def _chunks(start: date, end: date):
    """Yield inclusive (chunk_start, chunk_end) date pairs covering start..end."""
    cur = start
    while cur <= end:
        nxt = min(cur + timedelta(days=CHUNK_DAYS - 1), end)
        yield cur, nxt
        cur = nxt + timedelta(days=1)


def _get(client: httpx.Client, dataset: str, params: dict) -> list[dict]:
    r = client.get(f"{BASE_URL}/{dataset}/stream", params=params)
    r.raise_for_status()
    return r.json()


def fetch_actuals(client: httpx.Client, start: date, end: date) -> pd.DataFrame:
    rows = []
    for a, b in _chunks(start, end):
        chunk = _get(
            client,
            "FUELHH",
            {
                "settlementDateFrom": a.isoformat(),
                "settlementDateTo": b.isoformat(),
                "fuelType": "WIND",
            },
        )
        print(f"  FUELHH  {a}..{b}: {len(chunk)} rows")
        rows.extend(chunk)
    df = pd.DataFrame(rows)
    df = df[df["fuelType"] == "WIND"]
    df = df[["startTime", "settlementDate", "settlementPeriod", "generation"]]
    return df.drop_duplicates("startTime").sort_values("startTime")


def fetch_forecasts(client: httpx.Client, start: date, end: date) -> pd.DataFrame:
    rows = []
    for a, b in _chunks(start, end):
        chunk = _get(
            client,
            "WINDFOR",
            {
                "publishDateTimeFrom": f"{a.isoformat()}T00:00:00Z",
                "publishDateTimeTo": f"{(b + timedelta(days=1)).isoformat()}T00:00:00Z",
            },
        )
        print(f"  WINDFOR {a}..{b}: {len(chunk)} rows")
        rows.extend(chunk)
    key = ["publishTime", "startTime"]
    df = pd.DataFrame(rows)[[*key, "generation"]]
    return df.drop_duplicates(key).sort_values(key)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--actuals-from", type=date.fromisoformat, default=date(2026, 1, 1))
    p.add_argument("--actuals-to", type=date.fromisoformat, default=date(2026, 2, 1))
    p.add_argument("--publish-from", type=date.fromisoformat, default=date(2025, 12, 31))
    p.add_argument("--publish-to", type=date.fromisoformat, default=date(2026, 1, 31))
    args = p.parse_args()

    settings.data_dir.mkdir(parents=True, exist_ok=True)
    started = datetime.now()
    with httpx.Client(timeout=60) as client:
        actuals = fetch_actuals(client, args.actuals_from, args.actuals_to)
        forecasts = fetch_forecasts(client, args.publish_from, args.publish_to)

    actuals.to_csv(settings.data_dir / ACTUALS_FILE, index=False)
    forecasts.to_csv(settings.data_dir / FORECASTS_FILE, index=False)
    elapsed = (datetime.now() - started).seconds
    print(
        f"Wrote {len(actuals)} actuals + {len(forecasts)} forecast rows to {settings.data_dir} "
        f"in {elapsed}s"
    )


if __name__ == "__main__":
    main()

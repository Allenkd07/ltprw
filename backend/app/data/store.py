"""Loads the pre-ingested Elexon CSVs (produced by `python -m ingest.fetch_elexon`)."""

from functools import lru_cache

import pandas as pd

from app.config import settings

ACTUALS_FILE = "actuals_wind.csv"
FORECASTS_FILE = "forecasts_wind.csv"


@lru_cache
def load_actuals() -> pd.DataFrame:
    """Half-hourly actuals: startTime, settlementDate, settlementPeriod, generation (MW)."""
    return pd.read_csv(settings.data_dir / ACTUALS_FILE, parse_dates=["startTime"])


@lru_cache
def load_forecasts() -> pd.DataFrame:
    """Hourly forecasts, one row per (publishTime, startTime), with generation (MW)."""
    return pd.read_csv(settings.data_dir / FORECASTS_FILE, parse_dates=["publishTime", "startTime"])


def data_available() -> bool:
    return all((settings.data_dir / f).is_file() for f in (ACTUALS_FILE, FORECASTS_FILE))

from datetime import date, time
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.api.schemas import DayForecastResponse, MetaResponse, MetricsResponse
from app.data.store import data_available, load_actuals, load_forecasts
from app.domain.metrics import DELIVERY_END, DELIVERY_START, accuracy_report, day_report

router = APIRouter()

DEFAULT_CUTOFF = time(9, 0)
CutoffQuery = Annotated[time, Query(description="Decision time on D-1, UK time (HH:MM)")]


def _require_data() -> None:
    if not data_available():
        raise HTTPException(503, "Data not ingested; run `python -m ingest.fetch_elexon`")


def _minute(t: time) -> time:
    return t.replace(second=0, microsecond=0)


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "data_loaded": data_available()}


@router.get("/meta", response_model=MetaResponse)
def meta() -> dict:
    """Valid delivery-day range and the forecast publish schedule, for building the UI."""
    _require_data()
    runs = load_forecasts()["publishTime"].drop_duplicates()
    # Regular schedule = times seen on most days; occasional late runs (e.g. 12:25) excluded.
    per_time = runs.dt.strftime("%H:%M").value_counts()
    n_days = runs.dt.date.nunique()
    return {
        "delivery_start": DELIVERY_START,
        "delivery_end": DELIVERY_END,
        "default_cutoff": DEFAULT_CUTOFF.strftime("%H:%M"),
        "publish_times_utc": sorted(per_time[per_time > n_days / 2].index),
    }


@lru_cache(maxsize=64)
def _cached_report(cutoff: time) -> dict:
    return accuracy_report(load_forecasts(), load_actuals(), cutoff)


@router.get("/metrics", response_model=MetricsResponse)
def metrics(cutoff: CutoffQuery = DEFAULT_CUTOFF) -> dict:
    _require_data()
    return _cached_report(_minute(cutoff))


@lru_cache(maxsize=512)
def _cached_day(day: date, cutoff: time) -> dict:
    return day_report(load_forecasts(), load_actuals(), day, cutoff)


@router.get("/forecast", response_model=DayForecastResponse)
def forecast(
    day: Annotated[date, Query(description="Delivery day (YYYY-MM-DD)")],
    cutoff: CutoffQuery = DEFAULT_CUTOFF,
) -> dict:
    _require_data()
    if not DELIVERY_START <= day <= DELIVERY_END:
        raise HTTPException(422, f"day must be between {DELIVERY_START} and {DELIVERY_END}")
    return _cached_day(day, _minute(cutoff))

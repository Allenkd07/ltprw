"""Accuracy of decision-time wind forecasts against actual generation.

Sign convention: error = actual - forecast (MW). A negative error means wind came in below
the forecast, i.e. a shortfall the trader would have had to cover by buying more power.
"""

import math
from datetime import date, time, timedelta

import numpy as np
import pandas as pd

from app.domain.forecast import select_decision_forecast

# Day-ahead decisions made in January 2026 => delivery days 2 Jan .. 1 Feb.
DELIVERY_START = date(2026, 1, 2)
DELIVERY_END = date(2026, 2, 1)
HORIZON_BUCKET_H = 6
HISTOGRAM_BIN_MW = 500
LEVEL_BUCKET_MW = 4000


def delivery_days(start: date = DELIVERY_START, end: date = DELIVERY_END) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def build_decision_series(
    forecasts: pd.DataFrame,
    actuals: pd.DataFrame,
    cutoff: time,
    days: list[date],
    drop_missing_actuals: bool = True,
) -> pd.DataFrame:
    """Decision-time forecast joined with actuals, one row per hourly target.

    WINDFOR is hourly and FUELHH half-hourly, so forecasts are compared with the actual for
    the half-hour starting on the hour. Targets without an actual are dropped unless
    `drop_missing_actuals` is False, in which case actual and error are NaN.
    Returns columns: startTime, publishTime, horizon_h, forecast, actual, error.
    """
    selected = pd.concat(
        [select_decision_forecast(forecasts, d, cutoff) for d in days], ignore_index=True
    )
    actual = actuals[["startTime", "generation"]].rename(columns={"generation": "actual"})
    merged = selected.rename(columns={"generation": "forecast"}).merge(
        actual, on="startTime", how="inner" if drop_missing_actuals else "left"
    )
    return merged.assign(error=merged["actual"] - merged["forecast"])


def summarize(error: pd.Series, actual: pd.Series) -> dict:
    """Headline accuracy figures for a set of hourly errors (MW)."""
    if error.empty:
        return {"n": 0}
    shortfall = -error
    mean_actual = actual.mean()
    return {
        "n": int(len(error)),
        "mae": float(error.abs().mean()),
        "rmse": float(np.sqrt((error**2).mean())),
        "bias": float(error.mean()),
        "mean_actual": float(mean_actual),
        "mae_pct_of_mean_actual": float(error.abs().mean() / mean_actual * 100)
        if mean_actual
        else None,
        "error_p10": float(error.quantile(0.10)),
        "error_p50": float(error.quantile(0.50)),
        "error_p90": float(error.quantile(0.90)),
        # Extra MW to hold so that wind shortfalls are covered in 90% / 95% of hours.
        "buffer_p90": max(0.0, float(shortfall.quantile(0.90))),
        "buffer_p95": max(0.0, float(shortfall.quantile(0.95))),
    }


def _grouped(series: pd.DataFrame, key: pd.Series) -> list[dict]:
    return [
        {"key": k, **summarize(g["error"], g["actual"])} for k, g in series.groupby(key, sort=True)
    ]


def error_histogram(error: pd.Series, bin_mw: int = HISTOGRAM_BIN_MW) -> list[dict]:
    if error.empty:
        return []
    lo = math.floor(error.min() / bin_mw) * bin_mw
    hi = math.ceil(error.max() / bin_mw) * bin_mw + bin_mw
    counts, edges = np.histogram(error, bins=np.arange(lo, hi + 1, bin_mw))
    return [
        {"lo": int(edges[i]), "hi": int(edges[i + 1]), "count": int(c)}
        for i, c in enumerate(counts)
    ]


def accuracy_report(
    forecasts: pd.DataFrame, actuals: pd.DataFrame, cutoff: time, days: list[date] | None = None
) -> dict:
    """Overall accuracy plus breakdowns by hour of day, horizon, forecast level and delivery day."""
    series = build_decision_series(forecasts, actuals, cutoff, days or delivery_days())
    horizon_bucket = (series["horizon_h"] // HORIZON_BUCKET_H * HORIZON_BUCKET_H).astype(int)
    # Bias that grows with forecast level points to curtailment rather than weather skill (F3).
    level_bucket = (series["forecast"] // LEVEL_BUCKET_MW * LEVEL_BUCKET_MW).astype(int)
    return {
        "cutoff": cutoff.strftime("%H:%M"),
        "summary": summarize(series["error"], series["actual"]),
        "by_hour": _grouped(series, series["startTime"].dt.hour.rename("hour")),
        "by_horizon": _grouped(series, horizon_bucket.rename("horizon_bucket_h")),
        "by_level": _grouped(series, level_bucket.rename("forecast_bucket_mw")),
        "by_day": _grouped(series, series["startTime"].dt.strftime("%Y-%m-%d").rename("day")),
        "histogram": error_histogram(series["error"]),
    }


def _records(df: pd.DataFrame) -> list[dict]:
    """DataFrame rows as dicts, with NaN turned into None for JSON."""
    return df.astype(object).where(df.notna(), None).to_dict("records")


def day_report(forecasts: pd.DataFrame, actuals: pd.DataFrame, day: date, cutoff: time) -> dict:
    """Decision-time forecast vs actuals for a single delivery day, for charting."""
    hourly = build_decision_series(forecasts, actuals, cutoff, [day], drop_missing_actuals=False)
    day_start = pd.Timestamp(day.isoformat(), tz="UTC")
    in_day = (actuals["startTime"] >= day_start) & (
        actuals["startTime"] < day_start + pd.Timedelta(days=1)
    )
    scored = hourly.dropna(subset=["actual"])
    runs = forecasts["publishTime"].drop_duplicates()
    decision_day_runs = runs[(runs >= day_start - pd.Timedelta(days=1)) & (runs < day_start)]
    return {
        "day": day.isoformat(),
        "cutoff": cutoff.strftime("%H:%M"),
        # Normally a single run; more than one only if the latest run lacked some targets.
        "publish_times_used": sorted(hourly["publishTime"].unique()),
        # Every run published on D-1, so the UI can show what was / wasn't available yet.
        "runs_on_decision_day": sorted(decision_day_runs),
        "points": _records(hourly),
        "actuals_half_hourly": _records(actuals.loc[in_day, ["startTime", "generation"]]),
        "summary": summarize(scored["error"], scored["actual"]),
    }

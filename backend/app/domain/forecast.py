"""Selection of the forecast a day-ahead trader would actually have seen at decision time."""

from datetime import date, time

import pandas as pd


def select_decision_forecast(
    forecasts: pd.DataFrame, delivery_day: date, cutoff: time
) -> pd.DataFrame:
    """For each hourly target in `delivery_day`, pick the latest forecast published at or
    before `cutoff` on the day before delivery.

    All times are UTC (equal to UK local time throughout January, so no DST handling).
    WINDFOR runs also contain targets already in the past at publish time; those are dropped.
    Returns columns: startTime, publishTime, generation, horizon_h.
    """
    day_start = pd.Timestamp(delivery_day.isoformat(), tz="UTC")
    day_end = day_start + pd.Timedelta(days=1)
    cutoff_ts = (
        day_start - pd.Timedelta(days=1) + pd.Timedelta(hours=cutoff.hour, minutes=cutoff.minute)
    )

    eligible = forecasts[
        (forecasts["publishTime"] <= cutoff_ts)
        & (forecasts["startTime"] >= day_start)
        & (forecasts["startTime"] < day_end)
        & (forecasts["startTime"] > forecasts["publishTime"])
    ]
    latest = (
        eligible.sort_values("publishTime")
        .groupby("startTime")
        .tail(1)
        .sort_values("startTime")
        .reset_index(drop=True)
    )
    horizon = (latest["startTime"] - latest["publishTime"]).dt.total_seconds() / 3600
    return latest[["startTime", "publishTime", "generation"]].assign(horizon_h=horizon)

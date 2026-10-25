from datetime import date, time

import pandas as pd

from app.domain.forecast import select_decision_forecast


def _forecasts(rows: list[tuple[str, str, int]]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=["publishTime", "startTime", "generation"])
    df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    return df


def test_picks_latest_run_before_cutoff():
    df = _forecasts(
        [
            ("2026-01-14T04:30Z", "2026-01-15T00:00Z", 100),
            ("2026-01-14T07:30Z", "2026-01-15T00:00Z", 200),  # latest before 09:00
            ("2026-01-14T09:30Z", "2026-01-15T00:00Z", 300),  # after cutoff
        ]
    )
    out = select_decision_forecast(df, date(2026, 1, 15), time(9, 0))
    assert out["generation"].tolist() == [200]
    assert out["horizon_h"].tolist() == [16.5]


def test_cutoff_is_inclusive_and_excludes_other_days():
    df = _forecasts(
        [
            ("2026-01-14T09:30Z", "2026-01-15T05:00Z", 300),
            ("2026-01-14T09:30Z", "2026-01-16T00:00Z", 999),  # next delivery day
        ]
    )
    out = select_decision_forecast(df, date(2026, 1, 15), time(9, 30))
    assert out["generation"].tolist() == [300]


def test_no_forecast_before_cutoff_returns_empty():
    df = _forecasts([("2026-01-14T11:30Z", "2026-01-15T00:00Z", 100)])
    assert select_decision_forecast(df, date(2026, 1, 15), time(9, 0)).empty

from datetime import date, time

import pandas as pd
import pytest

from app.domain.metrics import (
    accuracy_report,
    build_decision_series,
    day_report,
    error_histogram,
    summarize,
)


def _ts(values: list[str]) -> pd.Series:
    return pd.to_datetime(pd.Series(values), utc=True)


@pytest.fixture
def data() -> tuple[pd.DataFrame, pd.DataFrame]:
    forecasts = pd.DataFrame(
        {
            "publishTime": _ts(["2026-01-14T07:30Z"] * 3),
            "startTime": _ts(["2026-01-15T00:00Z", "2026-01-15T01:00Z", "2026-01-15T02:00Z"]),
            "generation": [1000, 2000, 3000],
        }
    )
    actuals = pd.DataFrame(
        {
            "startTime": _ts(
                ["2026-01-15T00:00Z", "2026-01-15T00:30Z", "2026-01-15T01:00Z"]
            ),  # no actual for 02:00
            "generation": [1100, 9999, 1500],
        }
    )
    return forecasts, actuals


def test_series_joins_on_the_hour_and_drops_missing_actuals(data):
    s = build_decision_series(*data, time(9, 0), [date(2026, 1, 15)])
    assert s["actual"].tolist() == [1100, 1500]  # :30 actual ignored, 02:00 dropped
    assert s["error"].tolist() == [100, -500]


def test_summarize_figures():
    error = pd.Series([100.0, -500.0, 200.0, -200.0])
    s = summarize(error, pd.Series([1000.0] * 4))
    assert s["n"] == 4
    assert s["mae"] == pytest.approx(250)
    assert s["rmse"] == pytest.approx((340000 / 4) ** 0.5)
    assert s["bias"] == pytest.approx(-100)
    assert s["mean_actual"] == pytest.approx(1000)
    assert s["mae_pct_of_mean_actual"] == pytest.approx(25)
    assert s["buffer_p90"] == pytest.approx(pd.Series([-100, 500, -200, 200]).quantile(0.9))


def test_buffer_is_zero_when_wind_always_beats_forecast():
    s = summarize(pd.Series([100.0, 300.0]), pd.Series([1000.0, 1000.0]))
    assert s["buffer_p90"] == 0.0


def test_summarize_empty():
    assert summarize(pd.Series(dtype=float), pd.Series(dtype=float)) == {"n": 0}


def test_histogram_bins_cover_all_errors():
    bins = error_histogram(pd.Series([-750.0, -10.0, 0.0, 499.0, 500.0]))
    assert sum(b["count"] for b in bins) == 5
    assert bins[0]["lo"] == -1000 and bins[-1]["hi"] >= 500


def test_report_breakdowns(data):
    r = accuracy_report(*data, time(9, 0), [date(2026, 1, 15)])
    assert r["summary"]["n"] == 2
    assert [g["key"] for g in r["by_hour"]] == [0, 1]
    assert [g["key"] for g in r["by_horizon"]] == [12]  # horizons 16.5h, 17.5h
    assert [g["key"] for g in r["by_level"]] == [0]  # forecasts 1,000 and 2,000 MW
    assert [g["key"] for g in r["by_day"]] == ["2026-01-15"]


def test_day_report_keeps_forecast_hours_without_actuals(data):
    r = day_report(*data, date(2026, 1, 15), time(9, 0))
    assert [p["forecast"] for p in r["points"]] == [1000, 2000, 3000]
    assert r["points"][2]["actual"] is None and r["points"][2]["error"] is None
    assert len(r["actuals_half_hourly"]) == 3
    assert r["summary"]["n"] == 2  # only hours with actuals are scored
    assert len(r["publish_times_used"]) == 1

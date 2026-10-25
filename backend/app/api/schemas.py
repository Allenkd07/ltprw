from datetime import date, datetime

from pydantic import BaseModel, Field


class AccuracySummary(BaseModel):
    n: int = Field(description="Number of hourly targets compared")
    mae: float | None = Field(None, description="Mean absolute error, MW")
    rmse: float | None = Field(None, description="Root mean squared error, MW")
    bias: float | None = Field(
        None, description="Mean of actual - forecast, MW; <0 = over-forecast"
    )
    mean_actual: float | None = Field(None, description="Mean actual generation, MW")
    mae_pct_of_mean_actual: float | None = None
    error_p10: float | None = None
    error_p50: float | None = None
    error_p90: float | None = None
    buffer_p90: float | None = Field(None, description="MW covering shortfalls in 90% of hours")
    buffer_p95: float | None = Field(None, description="MW covering shortfalls in 95% of hours")


class GroupedAccuracy(AccuracySummary):
    key: int | str


class HistogramBin(BaseModel):
    lo: int
    hi: int
    count: int


class MetricsResponse(BaseModel):
    cutoff: str
    summary: AccuracySummary
    by_hour: list[GroupedAccuracy]
    by_horizon: list[GroupedAccuracy]
    by_level: list[GroupedAccuracy] = Field(
        description="Grouped by decision-time forecast, keyed by bucket start in MW"
    )
    by_day: list[GroupedAccuracy]
    histogram: list[HistogramBin]


class ForecastPoint(BaseModel):
    startTime: datetime
    publishTime: datetime
    horizon_h: float
    forecast: float
    actual: float | None
    error: float | None = Field(description="actual - forecast, MW")


class ActualPoint(BaseModel):
    startTime: datetime
    generation: float


class DayForecastResponse(BaseModel):
    day: date
    cutoff: str
    publish_times_used: list[datetime]
    runs_on_decision_day: list[datetime]
    points: list[ForecastPoint]
    actuals_half_hourly: list[ActualPoint]
    summary: AccuracySummary


class MetaResponse(BaseModel):
    delivery_start: date
    delivery_end: date
    default_cutoff: str
    publish_times_utc: list[str]

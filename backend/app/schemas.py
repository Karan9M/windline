from typing import Literal
from pydantic import BaseModel, Field


class Metrics(BaseModel):
    mae_mw: float | None = None
    rmse_mw: float | None = None
    bias_mw: float | None = None
    wape_pct: float | None = None
    matched_intervals: int = 0
    available_intervals: int = 744
    coverage_pct: float = 0.0


class IntervalRecord(BaseModel):
    decision_date: str
    delivery_start: str
    delivery_local_time: str
    forecast_mw: float | None = None
    actual_mw: float | None = None
    error_mw: float | None = None
    abs_error_mw: float | None = None
    forecast_publish_time: str | None = None
    forecast_lead_minutes: int | None = None
    status: Literal["matched", "missing_forecast", "missing_actual"]


class DailyMetrics(BaseModel):
    decision_date: str
    delivery_date: str
    mae_mw: float | None = None
    bias_mw: float | None = None
    matched_intervals: int = 0
    forecast_coverage_pct: float = 0.0


class SelectedDay(BaseModel):
    decision_date: str
    delivery_date: str
    selected_forecast_publish_time: str | None = None
    forecast_versions_available: int = 0
    intervals: list[IntervalRecord] = Field(default_factory=list)


class DataStatus(BaseModel):
    mode: Literal["live", "demo"]
    source: str = "Elexon BMRS / Insights API"
    retrieved_at: str
    forecast_rows_loaded: int = 0
    actual_rows_loaded: int = 0
    warning: str | None = None


class AnalysisResponse(BaseModel):
    decision_month: str
    decision_cutoff: str
    timezone: str = "Europe/London"
    interpretation: str
    metrics: Metrics
    daily_metrics: list[DailyMetrics]
    records: list[IntervalRecord]
    selected_day: SelectedDay
    data_status: DataStatus

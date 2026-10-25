from datetime import date, timezone
import pytest
from app.analytics import analyze_period, calculate_metrics, normalize_actuals, normalize_forecasts

UTC = timezone.utc

def z(value: str) -> str:
    return value + "Z"


def test_metrics_are_sign_consistent_and_exclude_missing_rows():
    rows = [
        {"forecast_mw": 110, "actual_mw": 100, "status": "matched"},
        {"forecast_mw": 80, "actual_mw": 100, "status": "matched"},
        {"forecast_mw": None, "actual_mw": 100, "status": "missing_forecast"},
    ]
    metrics = calculate_metrics(rows, expected=3)
    assert metrics["mae_mw"] == 15
    assert metrics["bias_mw"] == -5
    assert metrics["rmse_mw"] == pytest.approx(15.81, abs=.01)
    assert metrics["wape_pct"] == 15
    assert metrics["matched_intervals"] == 2
    assert metrics["coverage_pct"] == pytest.approx(66.7)


def test_actuals_keep_latest_publish_revision_and_only_wind():
    rows = [
        {"fuelType": "WIND", "startTime": z("2026-01-02T00:00:00"), "publishTime": z("2026-01-02T00:35:00"), "generation": 100},
        {"fuelType": "WIND", "startTime": z("2026-01-02T00:00:00"), "publishTime": z("2026-01-02T01:00:00"), "generation": 120},
        {"fuelType": "GAS", "startTime": z("2026-01-02T00:00:00"), "publishTime": z("2026-01-02T01:00:00"), "generation": 500},
    ]
    actuals = normalize_actuals(rows)
    assert len(actuals) == 1
    assert list(actuals.values())[0]["generation"] == 120


def test_latest_forecast_before_cutoff_is_selected_not_future_revision():
    actuals = []
    forecasts = []
    for day in range(1, 32):
        decision_date = date(2026, 1, day)
        for period in range(48):
            # Jan 2 first delivery day has three forecast publications for one period.
            if day == 1 and period == 0:
                start = "2026-01-02T00:00:00Z"
                actuals.append({"fuelType": "WIND", "startTime": start, "publishTime": "2026-01-02T00:35:00Z", "generation": 1000})
                actuals.append({"fuelType": "WIND", "startTime": "2026-01-02T00:30:00Z", "publishTime": "2026-01-02T01:05:00Z", "generation": 1000})
                forecasts.extend([
                    {"startTime": start, "publishTime": "2026-01-01T08:30:00Z", "generation": 900},
                    {"startTime": start, "publishTime": "2026-01-01T10:30:00Z", "generation": 950},
                    {"startTime": start, "publishTime": "2026-01-01T12:30:00Z", "generation": 999},
                ])
    payload = analyze_period(actuals, forecasts, "12:00", "2026-01-01")
    first = payload["selected_day"]["intervals"][0]
    assert first["forecast_mw"] == 950
    assert first["actual_mw"] == 1000
    assert first["forecast_publish_time"] == "2026-01-01T10:30:00Z"
    assert first["error_mw"] == -50
    assert first["status"] == "matched"


def test_decision_date_january_means_delivery_next_day_including_february():
    payload = analyze_period([], [], "12:00", "2026-01-31", mode="demo")
    assert payload["selected_day"]["decision_date"] == "2026-01-31"
    assert payload["selected_day"]["delivery_date"] == "2026-02-01"
    assert len(payload["records"]) == 31 * 24
    assert len(payload["selected_day"]["intervals"]) == 24


def test_forecast_rows_preserve_versions_but_dedupe_exact_duplicates():
    row = {"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T10:30:00Z", "generation": "123.4"}
    assert len(normalize_forecasts([row, row])) == 1


def test_invalid_cutoff_rejected():
    with pytest.raises(ValueError):
        analyze_period([], [], "25:00", "2026-01-15")


def test_previous_evening_vintage_is_available_for_early_january_cutoff():
    start = "2026-01-02T00:00:00Z"
    actuals = [{"fuelType": "WIND", "startTime": start, "publishTime": "2026-01-02T00:35:00Z", "generation": 1000}]
    forecasts = [
        {"startTime": start, "publishTime": "2025-12-31T23:30:00Z", "generation": 875},
        {"startTime": start, "publishTime": "2026-01-01T08:30:00Z", "generation": 925},
    ]
    payload = analyze_period(actuals, forecasts, "08:00", "2026-01-01")
    first = payload["selected_day"]["intervals"][0]
    assert first["forecast_mw"] == 875
    assert first["forecast_publish_time"] == "2025-12-31T23:30:00Z"



def test_hourly_forecast_is_compared_with_mean_of_two_half_hour_actuals():
    actuals = [
        {"fuelType": "WIND", "startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-02T00:35:00Z", "generation": 100},
        {"fuelType": "WIND", "startTime": "2026-01-02T00:30:00Z", "publishTime": "2026-01-02T01:05:00Z", "generation": 200},
    ]
    forecasts = [
        {"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T10:30:00Z", "generation": 180},
    ]
    payload = analyze_period(actuals, forecasts, "12:00", "2026-01-01")
    first = payload["selected_day"]["intervals"][0]
    assert first["actual_mw"] == 150
    assert first["forecast_mw"] == 180
    assert first["error_mw"] == 30
    assert first["status"] == "matched"
    assert len(payload["records"]) == 744
    assert payload["metrics"]["available_intervals"] == 744
    assert payload["metrics"]["matched_intervals"] == 1
    assert payload["metrics"]["coverage_pct"] == pytest.approx(0.1, abs=0.01)

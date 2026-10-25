from __future__ import annotations
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from math import sqrt
from zoneinfo import ZoneInfo
from typing import Any

UK = ZoneInfo("Europe/London")
UTC = timezone.utc
DECISION_MONTH = "2026-01"
DECISION_DAYS = [date(2026, 1, day) for day in range(1, 32)]
HOURS_PER_DAY = 24
EXPECTED_INTERVALS = len(DECISION_DAYS) * HOURS_PER_DAY  # WINDFOR is hourly: 31 * 24 = 744


def parse_datetime(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None
    if dt.tzinfo is None:
        # Elexon ISO timestamps are expected to be timezone-aware. Treat naive
        # values as UTC and make the assumption explicit in code for consistency.
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def iso_z(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def as_number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number or number in (float("inf"), float("-inf")):
        return None
    return number


def cutoff_for_decision(decision_date: date, cutoff: str) -> datetime:
    hour, minute = (int(part) for part in cutoff.split(":", 1))
    # Convert the local UK decision cut-off to UTC. ZoneInfo handles the local
    # offset correctly. The decision dates here are all in January (GMT).
    local = datetime.combine(decision_date, time(hour, minute), tzinfo=UK)
    return local.astimezone(UTC)


def normalize_actuals(rows: list[dict[str, Any]]) -> dict[datetime, dict[str, Any]]:
    """Keep the latest published actual outturn for each FUELHH half-hour."""
    chosen: dict[datetime, dict[str, Any]] = {}
    for row in rows:
        if str(row.get("fuelType", "")).upper() != "WIND":
            continue
        start = parse_datetime(row.get("startTime"))
        generation = as_number(row.get("generation"))
        if start is None or generation is None:
            continue
        publish = parse_datetime(row.get("publishTime"))
        current = chosen.get(start)
        current_publish = parse_datetime(current.get("publishTime")) if current else None
        if current is None or (publish is not None and (current_publish is None or publish >= current_publish)):
            chosen[start] = {"start": start, "generation": generation, "publishTime": row.get("publishTime")}
    return chosen


def normalize_forecasts(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Normalize hourly forecast-version rows, preserving publication timestamps."""
    normalized: list[dict[str, Any]] = []
    seen: set[tuple[datetime, datetime, float]] = set()
    for row in rows:
        start = parse_datetime(row.get("startTime"))
        publish = parse_datetime(row.get("publishTime"))
        generation = as_number(row.get("generation"))
        if start is None or publish is None or generation is None:
            continue
        key = (start, publish, generation)
        if key in seen:
            continue
        seen.add(key)
        normalized.append({"start": start, "publish": publish, "generation": generation})
    return normalized


def hourly_actual_mean(actuals: dict[datetime, dict[str, Any]], hour_start_utc: datetime) -> float | None:
    """Aggregate two FUELHH half-hour MW observations to one hourly mean.

    WINDFOR is documented by Elexon as an hourly forecast. For a like-for-like
    comparison, require both half-hour actuals covering [hour_start, hour_start+1h)
    and average their MW values. Do not interpolate or duplicate forecast values.
    """
    first = actuals.get(hour_start_utc)
    second = actuals.get(hour_start_utc + timedelta(minutes=30))
    if first is None or second is None:
        return None
    return (float(first["generation"]) + float(second["generation"])) / 2.0


def calculate_metrics(records: list[dict[str, Any]], expected: int = EXPECTED_INTERVALS) -> dict[str, Any]:
    matched = [row for row in records if row.get("forecast_mw") is not None and row.get("actual_mw") is not None]
    if not matched:
        return {"mae_mw": None, "rmse_mw": None, "bias_mw": None, "wape_pct": None,
                "matched_intervals": 0, "available_intervals": expected, "coverage_pct": 0.0}
    errors = [float(row["forecast_mw"]) - float(row["actual_mw"]) for row in matched]
    abs_sum = sum(abs(error) for error in errors)
    actual_sum = sum(abs(float(row["actual_mw"])) for row in matched)
    return {
        "mae_mw": round(sum(abs(error) for error in errors) / len(errors), 2),
        "rmse_mw": round(sqrt(sum(error * error for error in errors) / len(errors)), 2),
        "bias_mw": round(sum(errors) / len(errors), 2),
        "wape_pct": round(abs_sum / actual_sum * 100, 2) if actual_sum else None,
        "matched_intervals": len(matched),
        "available_intervals": expected,
        "coverage_pct": round(len(matched) / expected * 100, 1) if expected else 0.0,
    }


def analyze_period(
    actual_rows: list[dict[str, Any]], forecast_rows: list[dict[str, Any]],
    decision_cutoff: str = "12:00", selected_decision_date: str = "2026-01-15",
    mode: str = "live", warning: str | None = None,
) -> dict[str, Any]:
    if decision_cutoff < "00:00" or decision_cutoff > "23:59" or len(decision_cutoff) != 5:
        raise ValueError("decision_cutoff must use HH:MM in 24-hour time")
    try:
        hour, minute = [int(value) for value in decision_cutoff.split(":")]
        if not 0 <= hour <= 23 or not 0 <= minute <= 59:
            raise ValueError
    except (ValueError, TypeError):
        raise ValueError("decision_cutoff must use HH:MM in 24-hour time")
    if selected_decision_date not in {day.isoformat() for day in DECISION_DAYS}:
        selected_decision_date = "2026-01-15"

    actuals = normalize_actuals(actual_rows)
    forecasts = normalize_forecasts(forecast_rows)
    forecast_by_start: dict[datetime, list[dict[str, Any]]] = defaultdict(list)
    for row in forecasts:
        forecast_by_start[row["start"]].append(row)
    for versions in forecast_by_start.values():
        versions.sort(key=lambda row: row["publish"])

    target_records: list[dict[str, Any]] = []
    daily: list[dict[str, Any]] = []
    for decision_day in DECISION_DAYS:
        delivery_day = decision_day + timedelta(days=1)
        cutoff_dt = cutoff_for_decision(decision_day, decision_cutoff)
        day_records: list[dict[str, Any]] = []
        for hour_index in range(HOURS_PER_DAY):
            delivery_local = datetime.combine(delivery_day, time(hour_index, 0), tzinfo=UK)
            start_utc = delivery_local.astimezone(UTC)
            actual_value = hourly_actual_mean(actuals, start_utc)
            all_versions = forecast_by_start.get(start_utc, [])
            eligible = [version for version in all_versions if version["publish"] <= cutoff_dt]
            selected = eligible[-1] if eligible else None
            forecast_value = selected["generation"] if selected else None
            error = round(forecast_value - actual_value, 2) if forecast_value is not None and actual_value is not None else None
            lead = int((start_utc - selected["publish"]).total_seconds() // 60) if selected else None
            status = "matched" if forecast_value is not None and actual_value is not None else ("missing_forecast" if forecast_value is None else "missing_actual")
            row = {
                "decision_date": decision_day.isoformat(),
                "delivery_start": iso_z(start_utc),
                "delivery_local_time": delivery_local.strftime("%H:%M"),
                "forecast_mw": round(forecast_value, 2) if forecast_value is not None else None,
                "actual_mw": round(actual_value, 2) if actual_value is not None else None,
                "error_mw": error,
                "abs_error_mw": abs(error) if error is not None else None,
                "forecast_publish_time": iso_z(selected["publish"]) if selected else None,
                "forecast_lead_minutes": lead,
                "status": status,
            }
            target_records.append(row)
            day_records.append(row)
        day_metrics = calculate_metrics(day_records, expected=HOURS_PER_DAY)
        daily.append({
            "decision_date": decision_day.isoformat(),
            "delivery_date": delivery_day.isoformat(),
            "mae_mw": day_metrics["mae_mw"],
            "bias_mw": day_metrics["bias_mw"],
            "matched_intervals": day_metrics["matched_intervals"],
            "forecast_coverage_pct": round(sum(r["forecast_mw"] is not None for r in day_records) / HOURS_PER_DAY * 100, 1),
        })

    selected_day = next((d for d in DECISION_DAYS if d.isoformat() == selected_decision_date), DECISION_DAYS[14])
    selected_delivery_day = selected_day + timedelta(days=1)
    selected_records = [r for r in target_records if r["decision_date"] == selected_day.isoformat()]
    selected_publish_times = [r["forecast_publish_time"] for r in selected_records if r["forecast_publish_time"]]
    selected_cutoff = cutoff_for_decision(selected_day, decision_cutoff)
    eligible_publications: set[str] = set()
    for hour_index in range(HOURS_PER_DAY):
        local_start = datetime.combine(selected_delivery_day, time(hour_index, 0), tzinfo=UK)
        start_utc = local_start.astimezone(UTC)
        for version in forecast_by_start.get(start_utc, []):
            if version["publish"] <= selected_cutoff:
                eligible_publications.add(iso_z(version["publish"]) or "")
    last_publish = max((parse_datetime(p) for p in selected_publish_times if p), default=None)
    retrieved_at = datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")
    return {
        "decision_month": DECISION_MONTH,
        "decision_cutoff": decision_cutoff,
        "timezone": "Europe/London",
        "interpretation": (
            "Purchase decision date is in January 2026; each selected decision covers the following delivery day. "
            "WINDFOR forecasts are hourly; actual FUELHH half-hour observations are averaged in pairs for comparison."
        ),
        "metrics": calculate_metrics(target_records, expected=EXPECTED_INTERVALS),
        "daily_metrics": daily,
        "records": target_records,
        "selected_day": {
            "decision_date": selected_day.isoformat(),
            "delivery_date": selected_delivery_day.isoformat(),
            "selected_forecast_publish_time": iso_z(last_publish),
            "forecast_versions_available": len(eligible_publications),
            "intervals": selected_records,
        },
        "data_status": {
            "mode": mode,
            "source": "Elexon BMRS / Insights API" if mode == "live" else "Synthetic demonstration data — not Elexon observations",
            "retrieved_at": retrieved_at,
            "forecast_rows_loaded": len(forecast_rows),
            "actual_rows_loaded": len(actual_rows),
            "warning": warning,
        },
    }

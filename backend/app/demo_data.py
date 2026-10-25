"""Deterministic synthetic data for UI development and offline demonstrations.

These rows are intentionally synthetic and must never be represented as Elexon data.
"""
from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
import math
import random
from zoneinfo import ZoneInfo

UK = ZoneInfo("Europe/London")
UTC = timezone.utc


@lru_cache(maxsize=1)
def synthetic_rows() -> tuple[list[dict], list[dict]]:
    rng = random.Random(202601)
    actuals: list[dict] = []
    forecasts: list[dict] = []
    publish_times = [(3, 30), (5, 30), (8, 30), (10, 30), (12, 30), (16, 30), (19, 30), (23, 30)]
    # Decision dates January 1–31 map to next-day deliveries January 2–February 1.
    for day in range(1, 32):
        decision_day = date(2026, 1, day)
        delivery_day = decision_day + timedelta(days=1)
        day_weather = 600 + 900 * math.sin((day / 31) * math.pi * 2) + rng.uniform(-150, 150)
        actual_values: list[tuple[datetime, float]] = []
        for period in range(48):
            local = datetime.combine(delivery_day, time(0, 0), tzinfo=UK) + timedelta(minutes=period * 30)
            shape = 1_600 + 900 * math.sin((period / 48) * math.pi * 2 - 0.5) + 250 * math.sin(period / 48 * math.pi * 4)
            actual = max(350.0, shape + day_weather + rng.gauss(0, 180))
            start_iso = local.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")
            actual_values.append((local, actual))
            actuals.append({"fuelType": "WIND", "startTime": start_iso,
                            "publishTime": (local.astimezone(UTC) + timedelta(minutes=35)).isoformat(timespec="seconds").replace("+00:00", "Z"),
                            "generation": round(actual, 2)})
        # WINDFOR provides hourly forecast values. Create one forecast per hour
        # and use the mean of the corresponding two synthetic half-hour actuals.
        hourly_values: list[tuple[datetime, float]] = []
        for hour_index in range(24):
            first_actual = actual_values[hour_index * 2]
            second_actual = actual_values[hour_index * 2 + 1]
            hourly_values.append((first_actual[0], (first_actual[1] + second_actual[1]) / 2.0))

        for version_idx, (hour, minute) in enumerate(publish_times):
            publish_local = datetime.combine(decision_day, time(hour, minute), tzinfo=UK)
            publish_iso = publish_local.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")
            # Forecast errors improve on average with later issue times; still noisy.
            error_scale = max(110, 560 - version_idx * 55)
            for local, actual_hourly_mean in hourly_values:
                forecast = max(0.0, actual_hourly_mean + rng.gauss(0, error_scale) + (100 if version_idx < 3 else -35))
                forecasts.append({
                    "startTime": local.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
                    "publishTime": publish_iso,
                    "generation": round(forecast, 2),
                })
    return actuals, forecasts

# WINDFOR hourly alignment decision

## Evidence

The live `/datasets/WINDFOR/stream` response observed during validation returned forecast `startTime` values at `HH:00` and no `HH:30` starts for the examined delivery day. This produced 24 matched points per delivery day when compared to the 48 half-hour FUELHH records.

Elexon's public Wind Generation page describes the NESO wind-generation forecast as **hourly** for the period from 20:00 GMT on day D to 20:00 GMT on D+2, with forecasts updated up to eight times per day: https://bmrs.elexon.co.uk/wind-generation

This means the product should not describe the forecast data as half-hourly or duplicate hourly forecast values into half-hour periods.

## Comparison method

- Keep `FUELHH` actual observations at their native half-hour resolution during ingestion.
- For a WINDFOR forecast starting at hour `HH:00`, compute the hourly actual as the arithmetic mean of the FUELHH actuals starting at `HH:00` and `HH:30`.
- Require both half-hour actuals to be present. Do not silently interpolate or use a partial hour.
- Select the latest forecast version for that hourly `startTime` whose `publishTime` is on or before the configured decision cutoff.
- Calculate January metrics across 31 × 24 = 744 expected hourly delivery points. Coverage is matched hourly comparisons / 744.
- Label charts, tables, exports and method notes as hourly comparisons, and document the aggregation rule.

## Caveat

The assignment brief informally describes forecast `startTime` as similar to the half-hour actual `startTime`, but the live WINDFOR records inspected were hourly and Elexon's public Wind Generation documentation describes the forecast as hourly. This implementation follows observed and documented WINDFOR cadence. It does not invent half-hour forecast values. The hourly average is an explicit, auditable aggregation assumption for comparing hourly forecasts with half-hour outturn.

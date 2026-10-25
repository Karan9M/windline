# Elexon dataset stream query fix

The first live smoke test returned rows but zero matched intervals because the adapter sent `from` / `to` to the raw FUELHH and WINDFOR dataset stream endpoints. These dataset streams use publication-time filters (`publishDateTimeFrom` / `publishDateTimeTo`). The analytics layer independently joins rows on `startTime` and picks the latest forecast publication no later than the decision cutoff.

## Verify locally

1. Stop the API server.
2. Ensure `backend/.env` has `WINDLINE_DEMO_MODE=false` and `WINDLINE_ALLOW_DEMO_FALLBACK=false`.
3. From `backend/`, run `python -m pip install -r requirements.txt` then `uvicorn app.main:app --reload --port 8000`.
4. Request `http://localhost:8000/api/v1/analysis?decision_cutoff=12%3A00&selected_decision_date=2026-01-15&refresh=true`.
5. Confirm `data_status.mode` is `live`, `data_status.warning` is null, and `metrics.matched_intervals` is greater than zero. Coverage may be below 100%; it must reflect matched data, not be assumed complete.
6. Run `python -m pytest -q`.

The added regression test checks that publication-time query parameter names are used. It does not replace a live integration check against Elexon.

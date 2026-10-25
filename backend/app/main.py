from __future__ import annotations
import asyncio
import csv
import io
import time
from typing import Any
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

from .analytics import analyze_period
from .config import get_settings
from .demo_data import synthetic_rows
from .elexon import ElexonClient, ElexonError
from .schemas import AnalysisResponse

settings = get_settings()
app = FastAPI(title=settings.app_name, version="1.0.0", description="Time-aware historical wind forecast analysis for January 2026.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

_cache: dict[str, Any] = {"expires": 0.0, "actuals": None, "forecasts": None, "mode": None, "warning": None}
_cache_lock = asyncio.Lock()


async def load_rows(force_refresh: bool = False) -> tuple[list[dict], list[dict], str, str | None]:
    if settings.demo_mode:
        actuals, forecasts = synthetic_rows()
        return actuals, forecasts, "demo", "Demo mode is enabled. Values are synthetic and are not Elexon observations."
    async with _cache_lock:
        if not force_refresh and _cache["actuals"] is not None and time.monotonic() < _cache["expires"]:
            return _cache["actuals"], _cache["forecasts"], _cache["mode"], _cache["warning"]
        try:
            actuals, forecasts = await ElexonClient(settings).load_january_decisions()
            mode, warning = "live", None
        except ElexonError as exc:
            if not settings.allow_demo_fallback:
                raise HTTPException(status_code=502, detail=str(exc)) from exc
            actuals, forecasts = synthetic_rows()
            mode = "demo"
            warning = f"Elexon could not be reached; showing synthetic demo data only. Source error: {exc}"
        _cache.update({"actuals": actuals, "forecasts": forecasts, "mode": mode, "warning": warning,
                       "expires": time.monotonic() + max(settings.cache_ttl_seconds, 0)})
        return actuals, forecasts, mode, warning


def get_analysis_payload(actuals: list[dict], forecasts: list[dict], mode: str, warning: str | None, cutoff: str, selected_date: str) -> dict:
    payload = analyze_period(actuals, forecasts, cutoff, selected_date, mode, warning)
    if mode == "live" and payload["metrics"]["matched_intervals"] == 0:
        payload["data_status"]["warning"] = (
            "Elexon returned rows, but no January decision intervals matched between actuals and forecasts. "
            "Check the live endpoint query semantics and response schema before relying on these results."
        )
    return payload


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "windline-api"}


@app.get(f"{settings.api_prefix}/analysis", response_model=AnalysisResponse)
async def analysis(
    decision_cutoff: str = Query(default=settings.decision_cutoff_default, pattern=r"^([01]\d|2[0-3]):[0-5]\d$"),
    selected_decision_date: str = Query(default="2026-01-15", pattern=r"^2026-01-(0[1-9]|[12]\d|3[01])$"),
    refresh: bool = Query(default=False),
) -> dict:
    actuals, forecasts, mode, warning = await load_rows(force_refresh=refresh)
    return get_analysis_payload(actuals, forecasts, mode, warning, decision_cutoff, selected_decision_date)


@app.get(f"{settings.api_prefix}/export.csv")
async def export_csv(
    decision_cutoff: str = Query(default=settings.decision_cutoff_default, pattern=r"^([01]\d|2[0-3]):[0-5]\d$"),
) -> Response:
    actuals, forecasts, mode, warning = await load_rows()
    payload = get_analysis_payload(actuals, forecasts, mode, warning, decision_cutoff, "2026-01-15")
    buffer = io.StringIO(newline="")
    fields = ["decision_date", "delivery_start", "delivery_local_time", "forecast_mw", "actual_mw", "error_mw", "abs_error_mw", "forecast_publish_time", "forecast_lead_minutes", "status"]
    writer = csv.DictWriter(buffer, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(payload["records"])
    return Response(
        content=buffer.getvalue(), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="windline-january-2026.csv"', "Cache-Control": "no-store"},
    )


@app.get(f"{settings.api_prefix}/source-info")
async def source_info() -> dict[str, Any]:
    return {
        "actuals_endpoint": f"{settings.elexon_base_url.rstrip('/')}/datasets/FUELHH/stream",
        "forecasts_endpoint": f"{settings.elexon_base_url.rstrip('/')}/datasets/WINDFOR/stream",
        "decision_month": "2026-01",
        "decision_timezone": "Europe/London",
        "default_cutoff": settings.decision_cutoff_default,
        "data_mode": "demo" if settings.demo_mode else "live-with-explicit-demo-fallback",
    }

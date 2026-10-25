from __future__ import annotations
import asyncio
from datetime import datetime, timezone
from typing import Any
import httpx

from .config import Settings

UTC = timezone.utc


class ElexonError(RuntimeError):
    pass


def api_timestamp(dt: datetime) -> str:
    return dt.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


class ElexonClient:
    """Small adapter around Elexon public dataset stream endpoints."""
    def __init__(self, settings: Settings):
        self.settings = settings

    async def _get_stream(self, dataset: str, from_dt: datetime, to_dt: datetime) -> list[dict[str, Any]]:
        url = f"{self.settings.elexon_base_url.rstrip('/')}/datasets/{dataset}/stream"
        params = {
            # Raw dataset stream endpoints filter by publication timestamp.
            # Using `from`/`to` can return unrelated/default rows and leave
            # the requested historical delivery periods unmatched.
            "publishDateTimeFrom": api_timestamp(from_dt),
            "publishDateTimeTo": api_timestamp(to_dt),
        }
        headers = {"Accept": "application/json", "User-Agent": "Windline/1.0 (forecast accuracy pilot)"}
        try:
            async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds, follow_redirects=True) as client:
                response = await client.get(url, params=params, headers=headers)
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ElexonError(f"Elexon {dataset} request failed: {exc}") from exc
        if not isinstance(payload, list):
            raise ElexonError(f"Elexon {dataset} returned an unexpected payload shape (expected a JSON array)")
        return [row for row in payload if isinstance(row, dict)]

    async def load_january_decisions(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        # The request window is intentionally wider than the delivery month:
        # decision dates are in January, and each decision covers next-day delivery.
        # Dataset stream requests below filter on publishTime. The analytics layer
        # separately joins by delivery startTime and applies each decision cutoff.
        actual_from = datetime(2026, 1, 2, tzinfo=UTC)
        actual_to = datetime(2026, 2, 4, tzinfo=UTC)
        # Include the prior-day late publication for the first January decision date.
        forecast_from = datetime(2025, 12, 31, tzinfo=UTC)
        forecast_to = datetime(2026, 2, 3, tzinfo=UTC)
        actual_task = self._get_stream("FUELHH", actual_from, actual_to)
        forecast_task = self._get_stream("WINDFOR", forecast_from, forecast_to)
        actual_rows, forecast_rows = await asyncio.gather(actual_task, forecast_task)
        if not actual_rows:
            raise ElexonError("Elexon FUELHH returned no rows for the requested historical window")
        if not forecast_rows:
            raise ElexonError("Elexon WINDFOR returned no rows for the requested publication window")
        return actual_rows, forecast_rows

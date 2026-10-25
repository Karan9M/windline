from datetime import datetime, timezone

import pytest

from app.config import Settings
from app.elexon import ElexonClient


class FakeResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return [{"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-02T00:05:00Z", "generation": 123}]


class FakeAsyncClient:
    captured = {}

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, url, params=None, headers=None):
        type(self).captured = {"url": url, "params": params, "headers": headers}
        return FakeResponse()


@pytest.mark.asyncio
async def test_stream_uses_publication_datetime_filters(monkeypatch):
    monkeypatch.setattr("app.elexon.httpx.AsyncClient", FakeAsyncClient)
    client = ElexonClient(Settings())
    start = datetime(2026, 1, 2, tzinfo=timezone.utc)
    end = datetime(2026, 1, 3, tzinfo=timezone.utc)

    rows = await client._get_stream("WINDFOR", start, end)

    assert len(rows) == 1
    assert FakeAsyncClient.captured["url"].endswith("/datasets/WINDFOR/stream")
    assert FakeAsyncClient.captured["params"] == {
        "publishDateTimeFrom": "2026-01-02T00:00:00Z",
        "publishDateTimeTo": "2026-01-03T00:00:00Z",
    }

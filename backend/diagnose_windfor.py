import asyncio

from app.config import get_settings
from app.elexon import ElexonClient


async def main():
    client = ElexonClient(get_settings())
    _, forecasts = await client.load_january_decisions()

    target = "2026-01-16T00:00:00Z"

    rows = [
        row for row in forecasts
        if row.get("startTime") == target
    ]

    rows.sort(key=lambda row: row.get("publishTime", ""))

    print("Delivery period:", target)
    print("Forecast versions found:", len(rows))

    cutoff = "2026-01-15T12:00:00Z"

    eligible = [
        row for row in rows
        if row.get("publishTime")
        and row["publishTime"] <= cutoff
    ]

    print("\nForecast versions available by cutoff:")
    for row in eligible:
        print(
            "Published:", row.get("publishTime"),
            "| Generation:", row.get("generation")
        )

    if eligible:
        latest = max(eligible, key=lambda row: row["publishTime"])
        print("\nLatest eligible publication:", latest["publishTime"])


asyncio.run(main())
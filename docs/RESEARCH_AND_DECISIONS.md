# Research notes and engineering decisions

**Research date:** 25 October 2026. This is a pilot/research implementation, not a production trading system.

## Domain/data findings

### Elexon API access

The official Elexon Insights Solution developer portal says its APIs are public and do not require an API key. It differentiates raw dataset endpoints, opinionated endpoints and streaming endpoints. It also notes dataset endpoints support requests by publication times, which matters for retrieving superseded forecast versions.

- Portal: https://developer.data.elexon.co.uk/
- Endpoint catalogue: https://bmrs.elexon.co.uk/api-documentation/endpoint
- FUELHH stream: https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream
- WINDFOR stream: https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream
- Current forecast optimized endpoints can be useful operationally, but the requested `WINDFOR` history is retained here to make the as-of calculation explicit.

The published `latest/stream` forecast documentation describes forecast updates up to eight times daily (03:30, 05:30, 08:30, 10:30, 12:30, 16:30, 19:30 and 23:30). The application therefore treats `publishTime` as a first-class audit field and excludes versions published after the selected cut-off. The schedule is source documentation, not a guarantee every expected version exists in every historical period.

Elexon requires appropriate attribution for BMRS data. The UI footer and README include attribution references. Before submitting, verify the actual live response's units, timezone offset, revisions and query semantics against the live endpoint documentation.

## Scope choice: decision month vs delivery month

The requirement states that data should be relevant to purchase decisions made in January 2026. We interpret that literally as **decision dates** 2026-01-01 through 2026-01-31. Because buying decisions are day-ahead, the matching delivery intervals are 2026-01-02 through 2026-02-01, 48 periods per delivery date. This avoids incorrectly dropping the Feb 1 delivery that follows a Jan 31 decision and avoids including Jan 1 delivery that would have been decided on Dec 31.

## Cut-off assumption

The task does not give an exact internal decision timestamp. Default 12:00 UK local time is a configurable analysis assumption, not an assertion about an official exchange gate closure. Changing the selected cutoff re-runs forecast vintage selection and metrics. For a noon cutoff, the 12:30 issue would be ineligible; the last forecast before noon is chosen when present.

## Forecast vintage selection

1. Parse Elexon `startTime` and `publishTime` into timezone-aware UTC datetimes.
2. Retain target intervals whose *decision date* is in January 2026; delivery day is the next local date in Europe/London.
3. For each target start time, find candidate forecast rows with the same startTime.
4. Compute the decision cut-off for the prior local day and retain candidates whose `publishTime <= cutoff`.
5. Choose the candidate with the greatest eligible `publishTime`.
6. Join to latest available actual by identical `startTime` and compute `forecast - actual`.
7. Never interpolate missing forecasts or actuals. Exclude unmatched pairs from metric formulas and report coverage.

This is designed to prevent look-ahead bias. It is important to validate that the upstream `from`/`to` semantics return the required historical `publishTime` versions. If a live query confirms different parameters or retention constraints, update `backend/app/elexon.py` rather than weakening the as-of rule.

## Metric definitions

- `error = forecast_mw - actual_mw`; positive is an overforecast.
- MAE = mean of `abs(error)` over matched pairs.
- RMSE = square root of mean squared error over matched pairs.
- Bias = mean of signed error over matched pairs.
- WAPE = sum absolute error / sum absolute actual generation × 100. This avoids dividing by near-zero individual actuals as MAPE does; WAPE is undefined when the denominator is zero.
- Coverage = number of matched hourly forecast/actual pairs / 744 expected hourly intervals. WINDFOR is hourly according to Elexon's Wind Generation documentation; FUELHH actuals are aggregated by averaging each pair of half-hours for the same hour.

The app reports both coverage and accuracy; a small error on very few matched observations must not appear equivalent to a high-coverage result.

## Stack rationale

- React 19.3 + TypeScript + Vite 8 suits a focused SPA; no server-side rendering or complex route tree is needed for the three workspaces.
- TanStack Query provides cache/loading/error behavior for API-backed state; selection and navigation remain simple local state.
- Recharts provides SVG line/bar charts and tooltips without custom chart geometry.
- FastAPI/Pydantic provide a clear typed boundary; the Elexon adapter, analytics, demo fallback, and HTTP endpoints are separated for independent tests.
- Docker Compose makes the full local setup repeatable. Nginx serves the built SPA and forwards `/api` to the backend. Vercel + Render allows a static front end and independent Python API hosting.
- CSS tokens and restrained motion were preferred over adding a large UI kit. `prefers-reduced-motion` is supported.

## External research references

- React documentation (React 19.3 listed as latest on the current versions page): https://react.dev/versions
- React guidance on router/data-fetching libraries: https://react.dev/learn/build-a-react-app-from-scratch
- TanStack Router docs, if routing becomes necessary: https://tanstack.com/router/latest/docs/framework/react
- Raphael Salaja's User Interface Wiki skill: https://github.com/raphaelsalaja/userinterface-wiki and https://www.userinterface.wiki/skill

## Validation record

- Backend unit tests: 11 passed.
- Full Vite/TypeScript build: not run; npm registry access unavailable in the working environment.
- Docker build: not run; Docker CLI is not installed in the working environment.
- Live Elexon integration: not run from this environment because outbound network/DNS access is unavailable. A live integration test is a pre-submission requirement; do not treat the synthetic demo data as evidence of real forecast performance.

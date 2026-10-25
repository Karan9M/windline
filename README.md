# Windline — day-ahead wind forecast intelligence

Windline is a small, production-minded full-stack pilot for a UK energy utility. It reconstructs the national wind-generation forecast available at a configurable day-ahead decision cut-off, compares it with the actual generation outturn, and makes forecast selection and error metrics auditable.

> **Scope and honesty:** this pilot uses only Elexon `FUELHH` and `WINDFOR`. It does not use demand forecasts, market prices, other generation types, or external weather data. It therefore evaluates the wind forecast; it does not calculate a complete electricity procurement position. Synthetic data is used only when explicitly configured or when Elexon cannot be reached and fallback is enabled. The UI marks this as demo data.

## Product goals

- Make the selected forecast publication visible for a historical day-ahead buying decision.
- Prevent look-ahead bias by excluding forecasts published after the selected decision cut-off.
- Quantify accuracy with MAE, RMSE, signed bias and WAPE, alongside data coverage.
- Let users inspect each hourly forecast interval and export the complete January decision set as CSV.
- Keep the application simple to run, test, review and deploy.

## What the app shows

1. **Overview:** generation profile for a chosen purchase decision date, forecast-vs-actual series for the next delivery day, monthly error KPIs, daily MAE and a decision snapshot.
2. **Forecast accuracy:** daily error profile, over/underforecast mix and the largest absolute misses.
3. **Data explorer:** hourly forecast, publication timestamp, hourly actual (mean of two half-hour observations), error and data-quality status; search, pagination and CSV export.

## Critical period interpretation

The requirement says purchase decisions are made in **January 2026**, and decisions are day-ahead. Windline therefore filters **decision dates** to 1–31 January 2026 and maps each decision date to the following delivery date. The official Elexon Wind Generation page describes WINDFOR as an hourly forecast. Windline therefore compares 31 decision days × 24 hourly forecast intervals = **744 expected delivery hours**. The delivery dates run from 2 January to 1 February 2026.

The default decision cut-off is **12:00 Europe/London**, provided as an explicit pilot assumption because the brief does not give a specific internal purchase time or gate-closure time. The control is configurable. For each hourly delivery period, the algorithm chooses the latest `WINDFOR.publishTime` that is at or before the decision-day cut-off. The two corresponding half-hour `FUELHH` actuals are averaged to create a comparable hourly actual; both half-hours must be present. A 12:30 publication is not eligible at a 12:00 cut-off.

Actuals are deduplicated to the latest available publication per `startTime`. Each hourly forecast is compared with the mean of the two half-hour actuals starting at that hour and 30 minutes later. A missing half-hour makes that hourly actual unavailable; values are never interpolated or duplicated. Periods without a forecast or complete actual pair are not imputed; metrics use matched pairs only and report coverage independently.

## Technology choices

| Layer | Choice | Why |
|---|---|---|
| Front end | React 19 + TypeScript + Vite | A responsive SPA with typed API contracts and a fast, straightforward build. |
| Server-state | TanStack Query | Consistent loading/error states, request deduplication and caching for cutoff/date changes. |
| Charts | Recharts | Lightweight, accessible SVG charts that suit line comparisons and daily error exploration. |
| Icons and styling | Lucide React + CSS design tokens | Small icon vocabulary and a bespoke visual system without a heavy component framework. |
| API | Python 3.12 + FastAPI + Pydantic v2 | Typed API boundary, easy testing and clear separation of data access from analytics. |
| HTTP client | HTTPX async | Concurrent public Elexon calls, request timeouts and useful failures. |
| Packaging | Docker + Compose + Nginx | Reproducible two-service local run; Nginx serves the built SPA and proxies the API. |
| Hosting path | Vercel (front end) + Render (FastAPI) | Static front end and a separate Python service; both can be deployed independently. |

## Data and API sources

- Actual generation: `FUELHH` stream — https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream
- Wind forecast versions: `WINDFOR` stream — https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream
- Elexon developer portal — https://developer.data.elexon.co.uk/
- Elexon API terms/attribution — https://www.elexon.co.uk/bsc/data/balancing-mechanism-reporting-agent/copyright-licence-bmrs-data/

The API base is configurable with `WINDLINE_ELEXON_BASE_URL` (default `https://data.elexon.co.uk/bmrs/api/v1`). The backend requests a date range wide enough to include actual publication lag and forecasts published on January decision days, then filters the target delivery intervals in code. This is deliberate: publication time and delivery `startTime` answer different questions.

## Project structure

```text
windline/
├── .github/workflows/ci.yml       # Python tests and front-end build in CI
├── AGENTS.md                      # domain, engineering and UI quality rules
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── analytics.py            # timezone-aware as-of selection and metrics
│   │   ├── config.py               # environment-based settings
│   │   ├── demo_data.py            # deterministic synthetic fallback, clearly labelled
│   │   ├── elexon.py               # FUELHH and WINDFOR stream API adapter
│   │   ├── main.py                 # FastAPI routes, cache and CSV export
│   │   └── schemas.py              # typed response contracts
│   ├── tests/
│   │   ├── test_analytics.py       # metric, vintage, date-scope and cutoff tests
│   │   └── test_api.py             # API, validation and CSV tests
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/             # brand mark, reusable metrics and chart components
│   │   ├── lib/api.ts              # typed API client and response shapes
│   │   ├── App.tsx                  # overview, accuracy and data explorer
│   │   ├── main.tsx                 # React Query and app bootstrap
│   │   ├── styles.css               # design tokens, responsive layout, motion and focus states
│   │   └── vite-env.d.ts
│   ├── Dockerfile                   # multi-stage build and Nginx runtime
│   ├── index.html
│   ├── nginx.conf                   # SPA fallback and API reverse proxy
│   ├── package.json
│   ├── tsconfig.json
│   ├── vercel.json                  # Vercel SPA config
│   └── vite.config.ts
├── docs/
│   ├── ARCHITECTURE.md              # system diagram and module boundaries
│   ├── RESEARCH_AND_DECISIONS.md    # domain research, assumptions and stack rationale
│   ├── SUBMISSION_CHECKLIST.md      # anonymous repo, deploy and final review steps
│   ├── TECHNICAL_WALKTHROUGH.md     # 10-minute video script
│   └── UI_UX_SKILL_NOTES.md         # UI/UX skill research and applied principles
├── .env.example                     # safe sample environment values (no secrets)
├── .gitignore
├── docker-compose.yml
└── render.yaml                      # Render Docker service blueprint
```

## Run locally

### Option A — Docker Compose (recommended)

Requires Docker Engine and Docker Compose.

```bash
cp .env.example .env
docker compose up --build
```

Open **http://localhost:8080**. The API health endpoint is **http://localhost:8000/health** and the analysis endpoint is **http://localhost:8000/api/v1/analysis**. To force synthetic data for a stable screen recording, set `WINDLINE_DEMO_MODE=true` in `.env` and restart Compose.

The app attempts live Elexon data by default. If Elexon cannot be reached and `WINDLINE_ALLOW_DEMO_FALLBACK=true`, the response explicitly reports demo mode and shows a visible warning. Set it to `false` when silent fallback is unacceptable.

### Option B — run services separately

**Backend** (Python 3.12 recommended):

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Front end** (Node 22 recommended), in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. If the front end calls the API directly (instead of via the Docker Nginx proxy), set `VITE_API_BASE_URL=http://localhost:8000` in `frontend/.env.local`, and add `http://localhost:5173` to `WINDLINE_CORS_ORIGINS` for the backend.

## Tests and quality checks

```bash
cd backend
PYTHONPATH=. pytest -q
```

The current backend unit suite covers metric formulas/signs, latest-outturn revision selection, forecast as-of selection, decision-month to next-day-delivery mapping, duplicate versions, and invalid cutoffs. It has been run successfully in the working environment (**11 passed**).

A TypeScript/TSX syntax transpile check passed, but strict front-end typecheck and the Vite production build have not been executed because npm registry/network access was unavailable. Run `npm install && npm run build` before publishing. Docker is not installed in the working environment, so the Compose stack has not been built here.

## Submission and anonymous repository

A suggested anonymous public repository name is `q7m4d2k9`; see [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md) for the exact Git commands, deployment steps, incognito checks and video checklist.

## Deploy

### 1. Backend to Render

1. Push this repository to a public GitHub repo.
2. In Render, create a Blueprint from the repository and use `render.yaml` (or create a Docker web service using `backend/Dockerfile`).
3. Set `WINDLINE_CORS_ORIGINS` to include the exact production Vercel origin, for example `https://your-app.vercel.app`, plus any preview origins you intend to allow.
4. Wait for `/health` to return `{"status":"ok","service":"windline-api"}`.

### 2. Front end to Vercel

1. Import the same GitHub repository in Vercel and set **Root Directory** to `frontend`.
2. Set `VITE_API_BASE_URL` to the deployed Render origin, without a trailing slash (e.g. `https://windline-api.onrender.com`). This value is embedded at build time; redeploy after changing it.
3. Deploy, open the public URL in an incognito window, and verify the dashboard, cutoff selector, error analysis, data explorer, and CSV export. Confirm that the source badge says **Live** only when actual Elexon data is loaded; otherwise it must say **Demonstration data**.

**Deployment URL:** not yet provisioned. A real public deployment requires a GitHub repository and access to the user's Vercel/Render accounts; this environment cannot sign in or create those resources on the user's behalf. Do not submit a placeholder as a live app URL.

## AI assistance disclosure

OpenAI ChatGPT was used to assist with requirements decomposition, research synthesis, architecture, initial code generation, and test design. The implementation should be reviewed by the submitting developer before production use. The UI/UX direction also references Raphael Salaja's User Interface Wiki skill; details and the installation limitation are recorded in `docs/UI_UX_SKILL_NOTES.md`.

## Known limitations / production next steps

- The 12:00 UK decision cut-off is an assumption, not an official market time. Confirm it with the client and use the actual internal decision timestamp before relying on results.
- API history semantics and historical availability should be re-verified against Elexon's current documentation and a live query before formal submission. The UI intentionally surfaces API errors and the demo fallback is labelled.
- Current in-memory caching is per-process only. Production should add durable raw-data snapshots and cache metadata so an analysis can be reproduced after an upstream correction.
- Actual outturn revisions are resolved by latest `publishTime`; validate this policy against the returned FUELHH schema/data.
- National wind generation forecast accuracy is not a complete procurement model. A full procurement quantity would also require demand and non-wind supply, explicitly out of scope here.
- Before production: add integration tests against a recorded API contract, retry/backoff for transient 429/5xx errors, structured logs/metrics, CI for front-end typecheck/build, and contract checks for Elexon schema changes.

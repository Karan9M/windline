# 10-minute demo run-of-show

Use a screen recording with the browser on the deployed/public app and the repository/IDE available for Part 2. Do not publish private tokens, environment files or local account information. Keep the total video below 10 minutes.

## Part 1 — customer pitch (0:00–4:45)

**0:00–0:25 — Frame the decision**

“Wind output is uncertain, but the day-ahead buying decision has to be made before delivery. The key question is not what the latest forecast eventually became; it is what forecast was available at the time the decision was made.”

**0:25–1:00 — Orient the user**

Show Overview. Point out decision month, UK national scope, selected decision date, cutoff and next-day delivery date. Mention that the cutoff is configurable because the original brief did not specify the utility's internal decision timestamp.

**1:00–2:10 — Walk the generation profile**

Use the selected day chart to compare the forecast vintage with actual generation for the next delivery day. Point to the selected forecast publication time and coverage. Explain that forecasts published after the cutoff are excluded to prevent hindsight from contaminating the review.

**2:10–3:20 — Explain decision-useful accuracy**

Show MAE, RMSE, bias, WAPE and matched interval coverage. Explain that MAE measures typical absolute MW miss, RMSE highlights larger misses, and bias identifies a directional tendency. Avoid describing these metrics as a complete procurement recommendation.

**3:20–4:20 — Drill into a day**

Select a date from the daily error chart; show how a user can move from monthly performance to an individual delivery day's profile. Show the error direction breakdown.

**4:20–4:45 — Close on value and limits**

“The pilot gives the team an auditable historical view of the wind forecast vintage and its accuracy. It uses the two approved Elexon data sources only. Demand and other supply are outside this pilot, so it does not claim to recommend a full procurement quantity.”

## Part 2 — technical review / knowledge transfer (5:00–9:50)

**5:00–5:45 — Architecture**

Show README and architecture diagram if using a slide. Explain React + TypeScript + Vite on the front end, FastAPI/Pydantic on the back end, the Elexon adapter, analytic module, caching, Docker Compose and hosting split.

**5:45–6:40 — Data flow**

Open `backend/app/elexon.py` and explain FUELHH and WINDFOR requests, the deliberately wide fetch window, publication vs target timestamps, and why target startTime is filtered after retrieval.

**6:40–7:40 — As-of algorithm**

Open `backend/app/analytics.py`. Walk through timezone-aware timestamp parsing, latest actual revision, matching by startTime, cutoff derived from decision date, and the latest eligible forecast `publishTime`. Explicitly say 12:00 is an assumption and should be replaced by the client's confirmed cutoff.

**7:40–8:25 — Metrics and missing data**

Show `calculate_metrics`: MAE, RMSE, bias, WAPE and coverage. Explain that unmatched pairs are not imputed and that a missingness/coverage measure must accompany accuracy.

**8:25–9:10 — Quality and resilience**

Show `backend/tests/test_analytics.py`, the deterministic synthetic fallback label, API error handling, in-memory cache TTL, typed frontend contract and CSV export. State that live integration and front-end build should be rerun after deployment.

**9:10–9:50 — Run and next steps**

Show Docker Compose commands and environment variables. Close with production next steps: validate actual market cutoff and Elexon query semantics, persist raw snapshots, add API contract tests/retries/structured observability, and obtain user confirmation before representing metrics as operational buying guidance.

## Recording checklist

- Keep it under 10:00 total; unlisted YouTube visibility.
- Use real live data if the deployed integration has been verified. If not, label the session as synthetic demo data.
- Check all URLs in an incognito window, especially Vercel, Render health endpoint, GitHub repository and YouTube video.
- Confirm repository contains no `.env` or tokens and that the README's app URL is real (never a placeholder).
- Turn off desktop notifications and avoid exposing unrelated personal or client information.

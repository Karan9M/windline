# Submission checklist

## Before sharing

- [ ] Confirm the internal decision cutoff with the client; `12:00 Europe/London` is only the pilot default.
- [ ] Query Elexon live and verify actual `from` / `to` filtering semantics, data units, row shapes, timezones and historical forecast-version availability.
- [ ] Run backend tests: `cd backend && PYTHONPATH=. pytest -q`.
- [ ] Run frontend checks: `cd frontend && npm install && npm run build`.
- [ ] Build and run the Docker Compose stack: `docker compose up --build`; verify `http://localhost:8080` and `http://localhost:8000/health`.
- [ ] Verify the source status says **Live** only for actual Elexon observations; synthetic fallback must show its warning.
- [ ] Check that `.env`, API keys, browser data and tokens are not committed.

## Anonymous public repository

Suggested anonymous repo name: `q7m4d2k9` (rename to any unused random string). After creating an empty public repository with that name on GitHub, run from the project root:

```bash
git init -b main
git add .
git commit -m "Build Windline forecast intelligence pilot"
git remote add origin https://github.com/<your-github-username>/q7m4d2k9.git
git push -u origin main
```

Check that the public README opens in an incognito window. Do not commit `.env` or deployment secrets.

## Deployment

1. Deploy `backend/` as a Docker web service using `render.yaml`. Set `WINDLINE_CORS_ORIGINS` to include the exact Vercel origin.
2. Import the repository into Vercel with Root Directory `frontend`. Set `VITE_API_BASE_URL` to the deployed backend origin and redeploy.
3. Open the app and backend `/health` endpoint in incognito mode. Verify all dashboard interactions and the CSV download.
4. Replace any example URLs in `README.md` with verified public URLs. Never submit a placeholder as a deployment.

## Ten-minute recording

Use `docs/TECHNICAL_WALKTHROUGH.md` as the run-of-show. Keep customer pitch to the first five minutes and the technical walkthrough to the second five minutes. Record an unlisted YouTube video only after the deployed app and repository are publicly accessible. Do not show `.env` or account credentials.

## Submit form

Complete the assignment's submission form with the public repository URL, a commit SHA, the deployed app URL and the unlisted demo URL. Test every URL in incognito mode before submitting. This repository does not contain a live URL, video or commit SHA until you create those external resources.

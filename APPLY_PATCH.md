# Applying the Windline hourly-alignment patch

1. Stop the backend and frontend dev servers (`Ctrl+C` in each terminal).
2. Back up the current project folder.
3. Extract this ZIP directly into the project root (the folder that contains `backend`, `frontend`, `docs`, and `README.md`).
4. Allow Windows to replace the listed files.
5. In `backend`, with `.venv` activated, run `python -m pip install -r requirements.txt` and `python -m pytest -q`.
6. Restart the backend with `uvicorn app.main:app --reload --port 8000`.
7. Restart the frontend with `npm run dev` from `frontend`.
8. Keep demo mode on to check the UI first. Then set `WINDLINE_DEMO_MODE=false` and `WINDLINE_ALLOW_DEMO_FALLBACK=false` in `backend/.env`, restart the backend, and re-open the analysis endpoint to verify the real API.

This patch changes the evaluation cadence to hourly, which matches the hourly WINDFOR cadence observed in live data and described on Elexon's Wind Generation page. It aggregates two half-hour FUELHH actuals into one hourly actual (mean); it does not duplicate hourly forecast values into half-hour slots. The full analysis methodology is in `docs/WINDFOR_HOURLY_ALIGNMENT.md`.

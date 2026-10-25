# CLAUDE.md

UK Wind Forecast Monitor: REint Full Stack SWE challenge. A web app for a UK utility's day-ahead trading team that shows the wind forecast available at decision time, compares it with actuals, and measures accuracy, for decisions made in January 2026.

- `README.md`: public-facing run instructions. Keep it in sync when layout or commands change.

## Commands

Windows dev machine; the venv python is `backend/.venv/Scripts/python`.

```bash
# Backend (from backend/)
.venv/Scripts/python -m uvicorn app.main:app --reload   # API on :8000
.venv/Scripts/python -m pytest
.venv/Scripts/python -m ruff check .
.venv/Scripts/python -m ingest.fetch_elexon             # re-fetch data (rarely needed)

# Frontend (from frontend/)
npm run dev      # :5173, proxies /api to :8000
npm run build    # tsc -b && vite build
npm run lint     # oxlint
npm test         # vitest (lib/ unit tests)

# Whole app
docker compose up --build   # http://localhost:8000
```

Run pytest + ruff (and `npm run lint` / `npm test` / `npm run build` for frontend changes) before calling a step done.

## Layout

- `backend/app/domain/`: pure, tested logic. `forecast.py` (decision-time selection), `metrics.py` (accuracy).
- `backend/app/api/`: FastAPI routes (`/api/health`, `/api/meta`, `/api/forecast?day=&cutoff=`, `/api/metrics?cutoff=`) and Pydantic schemas.
- `backend/app/data/store.py`: loads the committed CSVs in `backend/data/`.
- `backend/ingest/fetch_elexon.py`: one-off Elexon BMRS fetch (FUELHH WIND, WINDFOR).
- `frontend/src/`: React + TS (Vite), Recharts. `pages/` views, `components/` charts and timeline, `api/client.ts` typed client, `lib/` formatting and chart helpers.
- `Dockerfile`: one multi-stage image; FastAPI serves the built frontend and honours `$PORT`.

## Domain rules (don't change without a deliberate, documented decision)

- Decision for delivery day D is made on D-1 at a configurable cutoff, default **09:00**. The forecast used is the latest WINDFOR run with `publishTime <= cutoff`; rows with `startTime <= publishTime` are excluded.
- January decisions = delivery days **2026-01-02 .. 2026-02-01**.
- All times **UTC** (= UK time in January); no DST handling.
- WINDFOR is hourly, FUELHH half-hourly: compare **on the hour**.
- **error = actual − forecast**; shortfall = −error. Buffer = P90/P95 of shortfall, floored at 0. Use MAE/RMSE as % of mean actual, not MAPE.
- The app never calls Elexon at runtime; data is static, so responses are cached.

## Conventions

- Python 3.12+, type hints, ruff (line length 100). TypeScript strict.
- Colours are CSS tokens with dark-mode variants (actual = blue, forecast = orange); support light, dark and narrow (~500px) widths.
- Constraints: React + Python, Docker, deploy to Vercel or Heroku, 16-hour time cap. The README must disclose AI tool use.

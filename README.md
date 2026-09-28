# TransGraph Market Dashboard fixes

Apply these files to the matching paths in the Next.js project.

## What is fixed

1. Main market requests use 500 rows instead of 5,000.
   - This reduces the expensive QuestDB query/JSON payload while keeping enough recent ticks for the dashboard.
2. FastAPI server timeout increased from 5s to 12s.
   - Previous browser logs showed repeated 504 responses exactly at 5.0s.
3. API route mode/limit parsing is validated.
4. Historical commodity proxy now uses the same `FASTAPI_BASE_URL` / `FASTAPI_API_KEY` client as the other routes.
5. Front dashboard selects the nearest non-expired future contract first, then spot.
6. Contract keys include exchange/underlying/expiry/strike/right so different contracts do not collapse.
7. Empty/stale live responses no longer erase the last known update time.
8. Previous dashboard rows are retained during a transient missing response.
9. Instrument detail requests are abort-safe.
10. Instrument detail keeps all available expiry contracts but displays only the newest tick per contract.
11. Detail contracts are sorted by nearest expiry.
12. RelatedDataTable uses stable contract keys and has an empty-state row.

## Important

Do NOT change IBKR subscriptions or streamers as part of this frontend patch.

After copying the files, run the normal Next.js type/build check and then test:

- `/api/market/commodity?mode=live&limit=500`
- `/api/market/currency?mode=live&limit=500`
- `/api/historical/commodity?name=COPPER&symbol=HG&mode=live&instrument_type=future&limit=5000`
- click a commodity future and verify all available expiry contracts appear.

Environment variables expected by the server-side FastAPI client:

FASTAPI_BASE_URL=http://127.0.0.1:8000
FASTAPI_API_KEY=<your existing API key>

Do not commit secrets into source control.

## Polling fix

Automatic polling is sequential instead of a fixed one-second interval. The next request starts only after the previous request completes, preventing Chrome from showing repeated `(canceled)` requests when an API response takes longer than one second.

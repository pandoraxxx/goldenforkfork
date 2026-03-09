# Stock Alarm Platform

This is a code bundle for Stock Alarm Platform. The original project is available at https://www.figma.com/design/3hbfNSKsLT4gjbGVpCNtpa/Stock-Alarm-Platform.

## Running the code

Run `npm i` to install dependencies.

Run `npm run api` to start backend API (default: `http://127.0.0.1:4000`).

Run `npm run dev` to start frontend dev server.

## QA / Tests

Run API gate tests:

- `npm run test:api`

Run E2E gate tests:

- `npm run test:e2e`

Run full gate suite:

- `npm test`

Run live smoke checks (real external data source):

- `npm run test:live`

Generated reports and artifacts are stored under `test-results/`.

## Data source

The project now uses real HK market data (Tencent quotes + Yahoo chart/indicator data). Mock/local stock data paths have been removed from runtime.

## Main API

- `GET /api/health`
- `GET /api/meta`
- `GET /api/market-stats`
- `GET /api/stocks?page=1&pageSize=20`
- `GET /api/stocks/:code`
- `GET /api/stocks/:code/price-history?days=90`
- `GET /api/stocks/:code/indicators`
- `GET /api/stocks/:code/golden-cross?pair=5-20`
- `GET /api/live/stocks?codes=00700,00005,00941`

Business endpoints (all backed by backend storage, not localStorage):

- `favorites`
- `subscriptions`
- `notifications`
- `preferences`

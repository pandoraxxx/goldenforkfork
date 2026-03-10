## Stock Alarm Platform

This is a code bundle for Stock Alarm Platform. The original project is available at `https://www.figma.com/design/3hbfNSKsLT4gjbGVpCNtpa/Stock-Alarm-Platform`.

### Local development

- **Install deps**: `npm i`
- **Start backend (single run)**: `npm run api` (default: `http://127.0.0.1:4000`)
- **Start backend (watch mode)**: `npm run api:watch`  
  Uses `nodemon` to reload when files under `backend/` change.
- **Start frontend**: `npm run dev` (default: `http://localhost:5173`)

The frontend talks to the backend via `VITE_API_BASE_URL` (see `frontend/src/app/api/client.ts`).  
For local dev this defaults to `http://127.0.0.1:4000`.

### Sector / industry data

The app shows HK stocks by sector (industry) using a static mapping:

- **Source**: HSICS / BigQuant `hk_stock_basic_info` dataset (level‑3 industry names).
- **Pipeline**:
  - Export a CSV to `backend/data/hsics.csv` with columns:
    - `code`: HK stock code (e.g. `700`, `0700`, `00388`)
    - `sector`: HSICS level‑3 industry name in Chinese (e.g. `银行`, `应用软件`)
  - Run `npm run sectors:import`
  - This generates `backend/data/sectors.json` (code → major sector mapping).
- **Major sectors**: fine‑grained industries are grouped into ~12 buckets:
  - 金融 / 信息科技 / 地产建筑 / 公用事业 / 电信 / 医疗保健 / 原材料 / 能源 / 工业 / 可选消费 / 必选消费 / 综合企业

At runtime the backend loads `backend/data/sectors.json` (or `backend/sectors.json` as a fallback) and:

- Attaches `sector` to each stock in `/api/stocks` and `/api/stocks/:code`
- Exposes available sectors via `/api/meta`
- Applies `sector` filtering for list views

### Golden‑cross logic

Moving‑average golden‑cross detection lives in `backend/market.js`:

- Supported MA pairs: `5-20`, `20-50`, `20-60` (see `MA_PAIRS`)
- Uses simple moving averages (SMA) on close prices
- A golden cross is recorded when:
  - previous bar `shortMA <= longMA`
  - current bar `shortMA > longMA`

The backend precomputes / caches golden‑cross events per stock and pair, and exposes:

- Last golden cross in list responses (for sorting / display)
- Full event list via `GET /api/stocks/:code/golden-cross?pair=5-20`

### Sorting behavior

List sorting is implemented server‑side in `/api/stocks`:

- **sortBy=volume** (default): volume descending
- **sortBy=change**: percentage change descending
- **sortBy=marketCap**: market cap descending
- **sortBy=code**: lexicographic by 5‑digit code
- **sortBy=lastGoldenCross**: most recent golden‑cross date first (for chosen MA pair)

Special tabs:

- `tab=popular`: fixed list of popular codes
- `tab=gainers`: `changePercent > 0`, sorted by `changePercent` descending
- `tab=losers`: `changePercent < 0`, sorted by `changePercent` ascending (跌幅最大在最前)

### QA / tests

- **API gate tests**:
  - `npm run test:api`
- **E2E gate tests**:
  - `npm run test:e2e`
- **Full gate suite**:
  - `npm test`
- **Live smoke checks (real external data source)**:
  - `npm run test:live`

Generated reports and artifacts are stored under `test-results/`.

### Data source

The project uses **real HK market data**:

- Quotes / universe: Tencent quote API
- Charts & indicators: Yahoo Finance (JSON chart + technical indicators)

Mock/local stock data paths have been removed from runtime; only tests may use fixtures.

### Main API surface

- `GET /api/health`
- `GET /api/meta`
- `GET /api/market-stats`
- `GET /api/stocks?page=1&pageSize=20&sortBy=volume&sector=all`
- `GET /api/stocks/:code`
- `GET /api/stocks/:code/price-history?days=90`
- `GET /api/stocks/:code/indicators`
- `GET /api/stocks/:code/golden-cross?pair=5-20`
- `GET /api/live/stocks?codes=00700,00005,00941`

Business endpoints (all backed by backend storage, not `localStorage`):

- `GET/POST/DELETE /api/favorites`
- `GET/POST/PATCH/POST(toggle)/DELETE /api/subscriptions`
- `GET/POST(read)/POST(read-all)/DELETE /api/notifications`
- `GET/PUT /api/preferences/golden-cross-pair`

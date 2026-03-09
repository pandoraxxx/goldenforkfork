
  # Stock Alarm Platform

  This is a code bundle for Stock Alarm Platform. The original project is available at https://www.figma.com/design/3hbfNSKsLT4gjbGVpCNtpa/Stock-Alarm-Platform.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Backend API (with live HK data)

  Run `npm run api` to start the backend server (default: `http://127.0.0.1:4000`).

  Main live endpoints:

  - `GET /api/live/stocks?codes=00700,00005,00941` (real-time quotes)
  - `GET /api/live/stocks/:code` (single quote)
  - `GET /api/live/stocks/:code/price-history?range=3mo&interval=1d`
  - `GET /api/live/stocks/:code/indicators`
  - `GET /api/live/stocks/:code/golden-cross?pair=5-20`

  Existing mock/local business endpoints are still available under `/api/*`:

  - stocks / subscriptions / notifications / favorites / preferences
  

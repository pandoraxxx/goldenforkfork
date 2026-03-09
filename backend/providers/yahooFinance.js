const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const TENCENT_KLINE_URL = 'https://web.ifzq.gtimg.cn/appstock/app/hkfqkline/get?param=';

function toYahooSymbol(code) {
  const normalized = String(parseInt(code, 10) || 0).padStart(4, '0');
  return `${normalized}.HK`;
}

function fromYahooSymbol(symbol) {
  const [digits] = String(symbol).split('.');
  return String(parseInt(digits, 10) || 0).padStart(5, '0');
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'StockAlarmPlatform/1.0',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`UPSTREAM_${res.status}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTencentKline(code, range = '3mo') {
  const daysByRange = {
    '1mo': 30,
    '3mo': 90,
    '6mo': 180,
    '1y': 365,
    '2y': 730,
    '5y': 1825,
  };
  const count = daysByRange[range] || 180;
  const symbol = `hk${String(parseInt(code, 10) || 0).padStart(5, '0')}`;
  const url = `${TENCENT_KLINE_URL}${encodeURIComponent(`${symbol},day,,,${count},qfq`)}`;
  const json = await fetchJson(url);
  const rows = json?.data?.[symbol]?.day;
  if (!Array.isArray(rows)) return [];

  const out = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const date = String(row[0] || '');
    const open = Number(row[1]);
    const close = Number(row[2]);
    const high = Number(row[3]);
    const low = Number(row[4]);
    const volume = Math.round(Number(row[5]));
    if (!date || [open, high, low, close, volume].some((v) => !Number.isFinite(v))) continue;
    out.push({
      date,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
  }

  return out;
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function ema(values, period) {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const result = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);

  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    result.push(prev);
  }

  return result;
}

function rsi(values, period = 14) {
  if (values.length <= period) return 50;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i += 1) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

async function getQuoteByChart(code) {
  const symbol = toYahooSymbol(code);
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
  const data = await fetchJson(url);
  const result = data?.chart?.result?.[0];
  const meta = result?.meta;
  const quote = result?.indicators?.quote?.[0];
  if (!meta || !quote) return null;

  const closes = (quote.close || []).filter((v) => Number.isFinite(v));
  const last = closes.at(-1);
  if (!Number.isFinite(last)) return null;

  const previousClose = safeNum(meta.previousClose, closes.at(-2));
  const change = safeNum(last) - previousClose;
  const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
  const name = meta.shortName || meta.longName || `HK ${fromYahooSymbol(meta.symbol || symbol)}`;

  return {
    code: fromYahooSymbol(meta.symbol || symbol),
    name,
    nameCn: name,
    price: Number(safeNum(last).toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    volume: Math.round(safeNum(meta.regularMarketVolume, quote.volume?.at(-1))),
    marketCap: Math.round(safeNum(meta.marketCap)),
    pe: Number(safeNum(meta.trailingPE).toFixed(2)),
    pb: 0,
    dividendYield: Number((safeNum(meta.trailingAnnualDividendYield) * 100).toFixed(2)),
    high52w: Number(safeNum(meta.fiftyTwoWeekHigh).toFixed(2)),
    low52w: Number(safeNum(meta.fiftyTwoWeekLow).toFixed(2)),
    exchange: meta.fullExchangeName || 'HKEX',
    currency: meta.currency || 'HKD',
    marketTime: safeNum(meta.regularMarketTime),
    source: 'yahoo-finance',
  };
}

export async function getLiveQuotes(codes) {
  const uniqueCodes = [...new Set(codes.map((c) => String(c).trim()).filter(Boolean))];
  if (uniqueCodes.length === 0) return [];
  const settled = await Promise.allSettled(uniqueCodes.map((code) => getQuoteByChart(code)));
  const rows = [];

  for (const item of settled) {
    if (item.status === 'fulfilled' && item.value) {
      rows.push(item.value);
    }
  }

  return rows;
}

export async function getLiveQuoteByCode(code) {
  const list = await getLiveQuotes([code]);
  return list[0] || null;
}

export async function getLivePriceHistory(code, range = '3mo', interval = '1d') {
  const symbol = toYahooSymbol(code);
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
  let data;
  try {
    data = await fetchJson(url);
  } catch {
    try {
      return await fetchTencentKline(code, range);
    } catch {
      return [];
    }
  }

  const result = data?.chart?.result?.[0];
  const ts = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];

  if (!Array.isArray(ts) || !quote) {
    try {
      return await fetchTencentKline(code, range);
    } catch {
      return [];
    }
  }

  const out = [];
  for (let i = 0; i < ts.length; i += 1) {
    const open = safeNum(quote.open?.[i], NaN);
    const high = safeNum(quote.high?.[i], NaN);
    const low = safeNum(quote.low?.[i], NaN);
    const close = safeNum(quote.close?.[i], NaN);
    const volume = Math.round(safeNum(quote.volume?.[i], NaN));

    if ([open, high, low, close, volume].some((v) => Number.isNaN(v))) continue;

    out.push({
      date: new Date(ts[i] * 1000).toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
  }

  if (out.length > 0) return out;
  try {
    return await fetchTencentKline(code, range);
  } catch {
    return [];
  }
}

export async function getLiveIndicators(code, options = {}) {
  const turnoverRateFromQuote = Number(options.turnoverRate);
  const hasTurnoverRateFromQuote = Number.isFinite(turnoverRateFromQuote) && turnoverRateFromQuote >= 0;
  const history = await getLivePriceHistory(code, '6mo', '1d');
  const closes = history.map((d) => d.close);
  const ma = (period) => {
    const window = Math.min(period, closes.length);
    if (window <= 0) return 0;
    const arr = closes.slice(-window);
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  };

  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  let macdDif = 0;
  let macdDea = 0;
  let macdHist = 0;
  if (ema12.length > 0 && ema26.length > 0) {
    // Align EMA12 to EMA26 timeline: ema12 starts at close[11], ema26 starts at close[25].
    const offset = 14;
    const difSeries = [];
    for (let i = 0; i < ema26.length; i += 1) {
      const e12 = ema12[i + offset];
      const e26 = ema26[i];
      if (Number.isFinite(e12) && Number.isFinite(e26)) {
        difSeries.push(e12 - e26);
      }
    }

    macdDif = difSeries.at(-1) || 0;
    const deaSeries = ema(difSeries, 9);
    macdDea = deaSeries.at(-1) || 0;
    // Common CN display convention: MACD histogram = 2 * (DIF - DEA).
    macdHist = 2 * (macdDif - macdDea);
  }

  const rsiPeriod = Math.min(14, Math.max(2, closes.length - 1));
  const rsiValue = closes.length >= 3 ? rsi(closes, rsiPeriod) : 50;

  return {
    rsi: Number(rsiValue.toFixed(2)),
    macd: Number(macdDif.toFixed(2)),
    macdDif: Number(macdDif.toFixed(2)),
    macdDea: Number(macdDea.toFixed(2)),
    macdHist: Number(macdHist.toFixed(2)),
    ma5: Number(ma(5).toFixed(2)),
    ma10: Number(ma(10).toFixed(2)),
    ma20: Number(ma(20).toFixed(2)),
    ma50: Number(ma(50).toFixed(2)),
    volume: history.at(-1)?.volume || 0,
    turnoverRate: hasTurnoverRateFromQuote ? Number(turnoverRateFromQuote.toFixed(2)) : 0,
  };
}

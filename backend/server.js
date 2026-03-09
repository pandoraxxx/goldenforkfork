import http from 'node:http';
import { URL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { initDb, saveDb } from './db.js';
import { detectGoldenCrossEvents, MA_PAIRS, popularStocks } from './market.js';
import {
  getLiveQuoteByCode,
  getLiveQuotes,
  getLivePriceHistory,
  getLiveIndicators,
} from './providers/yahooFinance.js';
import { getTencentQuotes, getTencentUniverseCodes } from './providers/tencentQuote.js';

const HOST = process.env.API_HOST || '127.0.0.1';
const PORT = Number(process.env.API_PORT || 4000);

let db = initDb();
let tencentUniverseSet = null;
let tencentUniverseLoading = null;
let marketStatsCache = { at: 0, stats: null };
let realtimeStocksCache = { at: 0, items: null };
const goldenCrossCache = new Map();

async function ensureTencentUniverseSet() {
  if (tencentUniverseSet) return tencentUniverseSet;
  if (!tencentUniverseLoading) {
    tencentUniverseLoading = getTencentUniverseCodes()
      .then((codes) => {
        tencentUniverseSet = new Set(codes);
        return tencentUniverseSet;
      })
      .catch(() => {
        tencentUniverseSet = new Set();
        return tencentUniverseSet;
      })
      .finally(() => {
        tencentUniverseLoading = null;
      });
  }
  return tencentUniverseLoading;
}

async function getRealtimeMarketStats() {
  const now = Date.now();
  if (marketStatsCache.stats && now - marketStatsCache.at < 60_000) {
    return marketStatsCache.stats;
  }

  const quotes = await getRealtimeUniverseStocks();

  let rising = 0;
  let falling = 0;
  let unchanged = 0;

  for (const q of quotes) {
    const cp = Number(q.changePercent) || 0;
    if (cp > 0) rising += 1;
    else if (cp < 0) falling += 1;
    else unchanged += 1;
  }

  const stats = {
    rising,
    falling,
    unchanged,
    total: quotes.length,
    updatedAt: new Date().toISOString(),
  };
  marketStatsCache = { at: now, stats };
  return stats;
}

async function getRealtimeUniverseStocks() {
  const now = Date.now();
  if (realtimeStocksCache.items && now - realtimeStocksCache.at < 60_000) {
    return realtimeStocksCache.items;
  }

  const universe = await ensureTencentUniverseSet();
  const liveRows = await getTencentQuotes([...universe]);
  const items = liveRows.map((row) => ({
    id: row.code,
    code: row.code,
    name: row.name || `HK ${row.code}`,
    nameCn: row.nameCn || row.name || `HK ${row.code}`,
    price: row.price,
    change: row.change,
    changePercent: row.changePercent,
    volume: row.volume,
    marketCap: row.marketCap,
    pe: row.pe,
    pb: row.pb,
    dividendYield: row.dividendYield,
    high52w: row.high52w,
    low52w: row.low52w,
    sector: '',
    lastGoldenCrossByPair: { '5-20': null, '20-50': null, '20-60': null },
    lastGoldenCross: null,
  }));

  realtimeStocksCache = { at: now, items };
  return items;
}

async function isValidStockCode(code) {
  if (!/^\d{5}$/.test(String(code || ''))) return false;
  const universe = await ensureTencentUniverseSet();
  return universe.has(code);
}

function applySearchSectorFilters(list, searchParams) {
  const search = (searchParams.get('search') || '').toLowerCase().trim();
  const sector = searchParams.get('sector') || 'all';

  let result = list;
  if (search) {
    result = result.filter(
      (s) =>
        s.code.includes(search) ||
        String(s.name || '').toLowerCase().includes(search) ||
        String(s.nameCn || '').includes(search),
    );
  }

  // No real sector source currently; ignore sector filter unless "all".
  if (sector !== 'all') {
    result = [];
  }

  return result;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function sendNoContent(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end();
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function persist() {
  saveDb(db);
}

function normalizeSubscription(input) {
  const indicators = new Set(['price', 'rsi', 'macd', 'volume', 'pe', 'pb']);
  const conditions = new Set(['above', 'below', 'equal']);

  if (!input || typeof input !== 'object') return { ok: false, message: '请求体无效' };
  if (!indicators.has(input.indicator)) return { ok: false, message: 'indicator 无效' };
  if (!conditions.has(input.condition)) return { ok: false, message: 'condition 无效' };
  if (typeof input.stockCode !== 'string' || !/^\d{5}$/.test(input.stockCode)) return { ok: false, message: 'stockCode 无效' };
  if (typeof input.value !== 'number' || Number.isNaN(input.value)) return { ok: false, message: 'value 必须是数字' };

  return {
    ok: true,
    value: {
      stockCode: input.stockCode,
      stockName: input.stockName || input.stockCode,
      indicator: input.indicator,
      condition: input.condition,
      value: input.value,
      isActive: input.isActive !== false,
    },
  };
}

function conditionPassed(current, condition, target) {
  if (condition === 'above') return current > target;
  if (condition === 'below') return current < target;
  return Math.abs(current - target) < 0.01;
}

async function getGoldenCrossByPair(code) {
  const cached = goldenCrossCache.get(code);
  const now = Date.now();
  if (cached && now - cached.at < 10 * 60_000) {
    return cached.value;
  }

  const history = await getLivePriceHistory(code, '6mo', '1d');
  const value = {};
  for (const pair of MA_PAIRS) {
    const events = detectGoldenCrossEvents(history, pair.short, pair.long, pair.key);
    value[pair.key] = events.length > 0 ? events[events.length - 1] : null;
  }
  goldenCrossCache.set(code, { at: now, value });
  return value;
}

async function enrichStocksWithGoldenCross(items) {
  const out = [];
  for (const item of items) {
    try {
      const byPair = await getGoldenCrossByPair(item.code);
      out.push({
        ...item,
        lastGoldenCrossByPair: byPair,
        lastGoldenCross: byPair['5-20'] || null,
      });
    } catch {
      out.push(item);
    }
  }
  return out;
}

async function checkSubscriptions() {
  const now = Date.now();
  const created = [];
  const active = db.subscriptions.filter((sub) => sub.isActive);
  const uniqueCodes = [...new Set(active.map((sub) => sub.stockCode))];
  const quoteRows = await getTencentQuotes(uniqueCodes);
  const quoteMap = new Map(quoteRows.map((q) => [q.code, q]));

  for (const sub of active) {
    const quote = quoteMap.get(sub.stockCode);
    if (!quote) continue;

    let current = null;
    if (sub.indicator === 'price') current = quote.price;
    if (sub.indicator === 'volume') current = quote.volume;
    if (sub.indicator === 'pe') current = quote.pe;
    if (sub.indicator === 'pb') current = quote.pb;
    if (sub.indicator === 'rsi' || sub.indicator === 'macd') {
      try {
        const ind = await getLiveIndicators(sub.stockCode);
        current = sub.indicator === 'rsi' ? ind.rsi : ind.macd;
      } catch {
        current = null;
      }
    }
    if (typeof current !== 'number') continue;

    if (!conditionPassed(current, sub.condition, sub.value)) continue;

    if (sub.triggeredAt) {
      const prev = new Date(sub.triggeredAt).getTime();
      if (Number.isFinite(prev) && now - prev < 60_000) continue;
    }

    const indicatorLabel = {
      price: '价格', rsi: 'RSI', macd: 'MACD', volume: '成交量', pe: '市盈率', pb: '市净率',
    }[sub.indicator];

    const conditionLabel = {
      above: '高于', below: '低于', equal: '等于',
    }[sub.condition];

    const notification = {
      id: randomUUID(),
      subscriptionId: sub.id,
      stockCode: sub.stockCode,
      stockName: sub.stockName,
      message: `${sub.stockName} 的${indicatorLabel}已${conditionLabel} ${sub.value}（当前: ${current.toFixed(2)}）`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    db.notifications.unshift(notification);
    if (db.notifications.length > 100) db.notifications = db.notifications.slice(0, 100);
    sub.triggeredAt = notification.timestamp;
    created.push(notification);
  }

  if (created.length > 0) persist();
  return created;
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendJson(res, 400, { error: 'Bad Request' });
    return;
  }

  if (req.method === 'OPTIONS') {
    sendNoContent(res);
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const { pathname, searchParams } = url;

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, { ok: true, service: 'stock-alarm-api' });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/meta') {
      sendJson(res, 200, { sectors: [], maPairs: MA_PAIRS, popularStocks });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/market-stats') {
      const stats = await getRealtimeMarketStats();
      sendJson(res, 200, stats);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/live/stocks') {
      const codes = (searchParams.get('codes') || popularStocks.join(','))
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const items = await getLiveQuotes(codes);
      sendJson(res, 200, { items, total: items.length });
      return;
    }

    if (req.method === 'GET' && /^\/api\/live\/stocks\/\d{5}$/.test(pathname)) {
      const code = pathname.split('/').pop();
      const item = await getLiveQuoteByCode(code);
      if (!item) {
        sendJson(res, 404, { error: '股票不存在或无实时数据' });
        return;
      }
      sendJson(res, 200, item);
      return;
    }

    if (req.method === 'GET' && /^\/api\/live\/stocks\/\d{5}\/price-history$/.test(pathname)) {
      const code = pathname.split('/')[4];
      const range = searchParams.get('range') || '3mo';
      const interval = searchParams.get('interval') || '1d';
      const items = await getLivePriceHistory(code, range, interval);
      sendJson(res, 200, items);
      return;
    }

    if (req.method === 'GET' && /^\/api\/live\/stocks\/\d{5}\/indicators$/.test(pathname)) {
      const code = pathname.split('/')[4];
      const indicators = await getLiveIndicators(code);
      sendJson(res, 200, indicators);
      return;
    }

    if (req.method === 'GET' && /^\/api\/live\/stocks\/\d{5}\/golden-cross$/.test(pathname)) {
      const code = pathname.split('/')[4];
      const pairKey = searchParams.get('pair') || db.preferences.goldenCrossPair || '5-20';
      const pair = MA_PAIRS.find((p) => p.key === pairKey) || MA_PAIRS[0];
      const history = await getLivePriceHistory(code, '6mo', '1d');
      const events = detectGoldenCrossEvents(history, pair.short, pair.long, pair.key);
      sendJson(res, 200, { pair, events });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/stocks') {
      const page = Math.max(1, Number(searchParams.get('page') || 1));
      const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 20)));
      const sortBy = searchParams.get('sortBy') || 'volume';
      const tab = searchParams.get('tab') || 'all';
      const pair = searchParams.get('pair') || db.preferences.goldenCrossPair || '5-20';
      const start = (page - 1) * pageSize;
      const realtime = applySearchSectorFilters(await getRealtimeUniverseStocks(), searchParams);

      let ranked = realtime;
      if (tab === 'popular') {
        const byCode = new Map(realtime.map((s) => [s.code, s]));
        ranked = popularStocks.map((code) => byCode.get(code)).filter(Boolean);
      } else if (tab === 'gainers') {
        ranked = [...realtime]
          .filter((s) => s.changePercent > 0)
          .sort((a, b) => b.changePercent - a.changePercent);
      } else if (tab === 'losers') {
        ranked = [...realtime]
          .filter((s) => s.changePercent < 0)
          .sort((a, b) => a.changePercent - b.changePercent);
      } else {
        ranked = [...realtime].sort((a, b) => {
          if (sortBy === 'change') return b.changePercent - a.changePercent;
          if (sortBy === 'volume') return b.volume - a.volume;
          if (sortBy === 'marketCap') return b.marketCap - a.marketCap;
          if (sortBy === 'code') return a.code.localeCompare(b.code);
          if (sortBy === 'lastGoldenCross') {
            const aDate = a.lastGoldenCrossByPair[pair]?.date ? new Date(a.lastGoldenCrossByPair[pair].date).getTime() : 0;
            const bDate = b.lastGoldenCrossByPair[pair]?.date ? new Date(b.lastGoldenCrossByPair[pair].date).getTime() : 0;
            return bDate - aDate;
          }
          return b.volume - a.volume;
        });
      }

      const items = ranked.slice(start, start + pageSize);
      const enrichedItems = await enrichStocksWithGoldenCross(items);

      sendJson(res, 200, {
        items: enrichedItems,
        total: ranked.length,
        page,
        pageSize,
      });
      return;
    }

    if (req.method === 'GET' && /^\/api\/stocks\/\d{5}$/.test(pathname)) {
      const code = pathname.split('/').pop();
      const rows = await getTencentQuotes([code]);
      if (!rows[0]) {
        sendJson(res, 404, { error: '股票不存在' });
        return;
      }
      try {
        const base = {
          id: rows[0].code,
          code: rows[0].code,
          name: rows[0].name || `HK ${rows[0].code}`,
          nameCn: rows[0].nameCn || rows[0].name || `HK ${rows[0].code}`,
          price: rows[0].price,
          change: rows[0].change,
          changePercent: rows[0].changePercent,
          volume: rows[0].volume,
          marketCap: rows[0].marketCap,
          pe: rows[0].pe,
          pb: rows[0].pb,
          dividendYield: rows[0].dividendYield,
          high52w: rows[0].high52w,
          low52w: rows[0].low52w,
          sector: '',
          lastGoldenCrossByPair: { '5-20': null, '20-50': null, '20-60': null },
          lastGoldenCross: null,
        };
        const [enriched] = await enrichStocksWithGoldenCross([base]);
        sendJson(res, 200, enriched);
      } catch {
        sendJson(res, 200, rows[0]);
      }
      return;
    }

    if (req.method === 'GET' && /^\/api\/stocks\/\d{5}\/indicators$/.test(pathname)) {
      const code = pathname.split('/')[3];
      const rows = await getTencentQuotes([code]);
      if (!rows[0]) {
        sendJson(res, 404, { error: '股票不存在' });
        return;
      }
      const indicators = await getLiveIndicators(code);
      sendJson(res, 200, indicators);
      return;
    }

    if (req.method === 'GET' && /^\/api\/stocks\/\d{5}\/price-history$/.test(pathname)) {
      const code = pathname.split('/')[3];
      const rows = await getTencentQuotes([code]);
      if (!rows[0]) {
        sendJson(res, 404, { error: '股票不存在' });
        return;
      }
      const days = Math.min(365, Math.max(5, Number(searchParams.get('days') || 90)));
      const range = days <= 30 ? '1mo' : days <= 90 ? '3mo' : days <= 180 ? '6mo' : '1y';
      const history = await getLivePriceHistory(code, range, '1d');
      sendJson(res, 200, history);
      return;
    }

    if (req.method === 'GET' && /^\/api\/stocks\/\d{5}\/golden-cross$/.test(pathname)) {
      const code = pathname.split('/')[3];
      const rows = await getTencentQuotes([code]);
      if (!rows[0]) {
        sendJson(res, 404, { error: '股票不存在' });
        return;
      }
      const pairKey = searchParams.get('pair') || db.preferences.goldenCrossPair || '5-20';
      const pair = MA_PAIRS.find((p) => p.key === pairKey) || MA_PAIRS[0];
      const history = await getLivePriceHistory(code, '6mo', '1d');
      const events = detectGoldenCrossEvents(history, pair.short, pair.long, pair.key);
      sendJson(res, 200, { pair, events });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/favorites') {
      sendJson(res, 200, db.favorites);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/favorites') {
      const body = await parseBody(req);
      const code = typeof body.stockCode === 'string' ? body.stockCode : '';
      if (!(await isValidStockCode(code))) {
        sendJson(res, 400, { error: 'stockCode 无效' });
        return;
      }
      if (!db.favorites.includes(code)) {
        db.favorites.push(code);
        persist();
      }
      sendJson(res, 201, { stockCode: code });
      return;
    }

    if (req.method === 'DELETE' && /^\/api\/favorites\/\d{5}$/.test(pathname)) {
      const code = pathname.split('/').pop();
      db.favorites = db.favorites.filter((item) => item !== code);
      persist();
      sendNoContent(res);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/subscriptions') {
      sendJson(res, 200, db.subscriptions);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/subscriptions') {
      const body = await parseBody(req);
      const normalized = normalizeSubscription(body);
      if (!normalized.ok) {
        sendJson(res, 400, { error: normalized.message });
        return;
      }
      if (!(await isValidStockCode(normalized.value.stockCode))) {
        sendJson(res, 400, { error: 'stockCode 无效' });
        return;
      }
      const subQuote = (await getTencentQuotes([normalized.value.stockCode]))[0];
      const item = {
        id: randomUUID(),
        ...normalized.value,
        stockName: normalized.value.stockName || subQuote?.nameCn || subQuote?.name || normalized.value.stockCode,
        createdAt: new Date().toISOString(),
      };
      db.subscriptions.push(item);
      persist();
      sendJson(res, 201, item);
      return;
    }

    if (req.method === 'PATCH' && /^\/api\/subscriptions\/[\w-]+$/.test(pathname)) {
      const id = pathname.split('/').pop();
      const idx = db.subscriptions.findIndex((s) => s.id === id);
      if (idx === -1) {
        sendJson(res, 404, { error: '订阅不存在' });
        return;
      }
      const body = await parseBody(req);
      const updated = {
        ...db.subscriptions[idx],
        ...body,
        id: db.subscriptions[idx].id,
        createdAt: db.subscriptions[idx].createdAt,
      };
      const normalized = normalizeSubscription(updated);
      if (!normalized.ok) {
        sendJson(res, 400, { error: normalized.message });
        return;
      }
      if (!(await isValidStockCode(normalized.value.stockCode))) {
        sendJson(res, 400, { error: 'stockCode 无效' });
        return;
      }
      const subQuote = (await getTencentQuotes([normalized.value.stockCode]))[0];
      db.subscriptions[idx] = {
        ...db.subscriptions[idx],
        ...normalized.value,
        stockName: normalized.value.stockName || subQuote?.nameCn || subQuote?.name || normalized.value.stockCode,
      };
      persist();
      sendJson(res, 200, db.subscriptions[idx]);
      return;
    }

    if (req.method === 'POST' && /^\/api\/subscriptions\/[\w-]+\/toggle$/.test(pathname)) {
      const id = pathname.split('/')[3];
      const item = db.subscriptions.find((s) => s.id === id);
      if (!item) {
        sendJson(res, 404, { error: '订阅不存在' });
        return;
      }
      item.isActive = !item.isActive;
      persist();
      sendJson(res, 200, item);
      return;
    }

    if (req.method === 'DELETE' && /^\/api\/subscriptions\/[\w-]+$/.test(pathname)) {
      const id = pathname.split('/').pop();
      db.subscriptions = db.subscriptions.filter((s) => s.id !== id);
      persist();
      sendNoContent(res);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/subscriptions/check') {
      const notifications = await checkSubscriptions();
      sendJson(res, 200, { count: notifications.length, notifications });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/notifications') {
      sendJson(res, 200, db.notifications);
      return;
    }

    if (req.method === 'POST' && /^\/api\/notifications\/[\w-]+\/read$/.test(pathname)) {
      const id = pathname.split('/')[3];
      const item = db.notifications.find((n) => n.id === id);
      if (!item) {
        sendJson(res, 404, { error: '通知不存在' });
        return;
      }
      item.read = true;
      persist();
      sendJson(res, 200, item);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/notifications/read-all') {
      db.notifications = db.notifications.map((n) => ({ ...n, read: true }));
      persist();
      sendNoContent(res);
      return;
    }

    if (req.method === 'DELETE' && /^\/api\/notifications\/[\w-]+$/.test(pathname)) {
      const id = pathname.split('/').pop();
      db.notifications = db.notifications.filter((n) => n.id !== id);
      persist();
      sendNoContent(res);
      return;
    }

    if (req.method === 'DELETE' && pathname === '/api/notifications') {
      db.notifications = [];
      persist();
      sendNoContent(res);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/preferences/golden-cross-pair') {
      sendJson(res, 200, { pairKey: db.preferences.goldenCrossPair || '5-20' });
      return;
    }

    if (req.method === 'PUT' && pathname === '/api/preferences/golden-cross-pair') {
      const body = await parseBody(req);
      const pairKey = typeof body.pairKey === 'string' ? body.pairKey : '';
      if (!MA_PAIRS.some((p) => p.key === pairKey)) {
        sendJson(res, 400, { error: 'pairKey 无效' });
        return;
      }
      db.preferences.goldenCrossPair = pairKey;
      persist();
      sendJson(res, 200, { pairKey });
      return;
    }

    sendJson(res, 404, { error: 'Not Found' });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_JSON') {
      sendJson(res, 400, { error: 'JSON 格式错误' });
      return;
    }
    sendJson(res, 500, { error: '服务器错误' });
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Stock Alarm API running at http://${HOST}:${PORT}`);
});

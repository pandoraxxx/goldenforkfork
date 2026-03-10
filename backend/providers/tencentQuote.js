import fs from 'node:fs';
import path from 'node:path';

const TENCENT_QUOTE_URL = 'https://qt.gtimg.cn/q=';
const UNIVERSE_CACHE_PATH = path.resolve(process.cwd(), 'backend/data/live_universe_cache.json');
const UNIVERSE_TTL_MS = 12 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

function normalizeCode(code) {
  return String(parseInt(String(code), 10) || 0).padStart(5, '0');
}

function toSymbol(code) {
  return `hk${normalizeCode(code)}`;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const INVALID_NAME_TOKENS = new Set(['HKD', 'USD', 'CNY', 'RMB', 'GP']);

function isInvalidName(value, code) {
  const v = String(value || '').trim();
  if (!v) return true;
  if (v.includes('�')) return true;
  if (INVALID_NAME_TOKENS.has(v.toUpperCase())) return true;
  if (/^GP(?:-|$)/i.test(v)) return true;
  if (/^\d+$/.test(v)) return true;
  if (/^0*\d{4,5}$/.test(v)) return true;
  if (/^HK\s+\d{4,5}$/i.test(v)) return true;
  if (v === code) return true;
  return false;
}

function pickNames(fields, code) {
  const nameCnRaw = String(fields[1] || '').trim();
  const nameEnRaw = String(fields[46] || '').trim();

  const hasCn = !isInvalidName(nameCnRaw, code);
  const hasEn = !isInvalidName(nameEnRaw, code) && /[A-Za-z]/.test(nameEnRaw);
  if (!hasCn && !hasEn) return null;

  return {
    name: hasEn ? nameEnRaw : nameCnRaw,
    nameCn: hasCn ? nameCnRaw : nameEnRaw,
  };
}

function normalizeCnName(raw, fallbackName) {
  const text = String(raw || '').trim();
  if (!text || text.includes('�') || /^\d+$/.test(text)) {
    return fallbackName;
  }
  return text;
}

function parseQuoteBody(body, options = {}) {
  const includeCodeOnly = options.includeCodeOnly !== false;
  const rows = [];
  const lines = String(body)
    .split(';')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^v_hk(\d{5})="([^"]*)"$/);
    if (!match) continue;

    const code = match[1];
    const payload = match[2];
    if (!payload) continue;

    const fields = payload.split('~');
    const price = toNumber(fields[3], NaN);
    if (!Number.isFinite(price) || price <= 0) continue;
    const names = pickNames(fields, code);
    if (!names && !includeCodeOnly) continue;
    const resolvedNames = names || { name: `HK ${code}`, nameCn: `HK ${code}` };

    const item = {
      code,
      name: resolvedNames.name,
      nameCn: normalizeCnName(resolvedNames.nameCn, resolvedNames.name),
      price: Number(price.toFixed(3)),
      change: Number(toNumber(fields[31]).toFixed(3)),
      changePercent: Number(toNumber(fields[32]).toFixed(2)),
      volume: Math.round(toNumber(fields[6])),
      // Tencent quote fields:
      // 44: total market cap (in 100M HKD), 57: PE(TTM), 58: PB, 47: dividend yield(%), 48/49: 52w high/low
      marketCap: Math.round(toNumber(fields[44]) * 100000000),
      pe: Number(toNumber(fields[57], toNumber(fields[39])).toFixed(2)),
      pb: Number(toNumber(fields[58], toNumber(fields[43])).toFixed(2)),
      dividendYield: Number(toNumber(fields[47]).toFixed(2)),
      high52w: Number(toNumber(fields[48]).toFixed(3)),
      low52w: Number(toNumber(fields[49]).toFixed(3)),
      turnoverRate: Number(toNumber(fields[59]).toFixed(2)),
      exchange: 'HKEX',
      currency: 'HKD',
      marketTime: fields[30] || '',
      source: 'tencent-quote',
    };

    rows.push(item);
  }

  return rows;
}

export async function getTencentQuotes(codes, options = {}) {
  const uniqueCodes = [...new Set(codes.map((code) => normalizeCode(code)).filter(Boolean))];
  if (uniqueCodes.length === 0) return [];

  const batches = [];
  const batchSize = 120;
  for (let i = 0; i < uniqueCodes.length; i += batchSize) {
    batches.push(uniqueCodes.slice(i, i + batchSize));
  }

  const all = [];
  for (const batch of batches) {
    const symbols = batch.map((code) => toSymbol(code));
    const url = `${TENCENT_QUOTE_URL}${symbols.join(',')}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 StockAlarm',
          Referer: 'https://finance.qq.com/',
        },
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timeout);
      continue;
    }
    clearTimeout(timeout);
    if (!res.ok) continue;
    const buffer = Buffer.from(await res.arrayBuffer());
    let text = buffer.toString('utf8');
    try {
      text = new TextDecoder('gbk').decode(buffer);
    } catch {
      // fallback to utf-8 decoding
    }
    all.push(...parseQuoteBody(text, options));
  }

  return all;
}

function readUniverseCache() {
  try {
    if (!fs.existsSync(UNIVERSE_CACHE_PATH)) return null;
    const raw = fs.readFileSync(UNIVERSE_CACHE_PATH, 'utf8');
    const json = JSON.parse(raw);
    if (!Array.isArray(json.codes) || typeof json.updatedAt !== 'string') return null;
    return json;
  } catch {
    return null;
  }
}

function writeUniverseCache(codes) {
  try {
    fs.writeFileSync(
      UNIVERSE_CACHE_PATH,
      JSON.stringify({ updatedAt: new Date().toISOString(), codes }, null, 2),
      'utf8',
    );
  } catch {
    // ignore cache failures
  }
}

export async function getTencentUniverseCodes() {
  const cached = readUniverseCache();
  if (cached) {
    const age = Date.now() - new Date(cached.updatedAt).getTime();
    if (Number.isFinite(age) && age < UNIVERSE_TTL_MS) {
      return cached.codes;
    }
  }

  const found = new Set();
  const scanBatch = 200;

  for (let start = 1; start <= 9999; start += scanBatch) {
    const codes = [];
    for (let i = start; i < start + scanBatch && i <= 9999; i += 1) {
      codes.push(normalizeCode(i));
    }

    const rows = await getTencentQuotes(codes);
    for (const row of rows) {
      found.add(row.code);
    }
  }

  const list = [...found].sort();
  writeUniverseCache(list);
  return list;
}

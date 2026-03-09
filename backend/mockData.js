export const MA_PAIRS = [
  { short: 5, long: 20, key: '5-20', label: 'MA5/20' },
  { short: 20, long: 50, key: '20-50', label: 'MA20/50' },
  { short: 20, long: 60, key: '20-60', label: 'MA20/60' },
];

const sectors = ['科技', '金融', '地产', '能源', '消费', '医疗', '工业', '电信', '公用事业', '材料'];

export const popularStocks = ['00700', '00001', '00005', '00941', '00388', '01299', '02318', '00175', '00883', '03690'];

function seededRandom(seed) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

export function detectGoldenCrossEvents(priceHistory, shortPeriod = 5, longPeriod = 20, pairKey = '5-20') {
  const events = [];
  if (priceHistory.length < longPeriod + 1) return events;

  const closes = priceHistory.map((p) => p.close);
  for (let i = longPeriod; i < closes.length; i += 1) {
    const shortMA = closes.slice(i - shortPeriod + 1, i + 1).reduce((a, b) => a + b, 0) / shortPeriod;
    const longMA = closes.slice(i - longPeriod + 1, i + 1).reduce((a, b) => a + b, 0) / longPeriod;
    const prevShortMA = closes.slice(i - shortPeriod, i).reduce((a, b) => a + b, 0) / shortPeriod;
    const prevLongMA = closes.slice(i - longPeriod, i).reduce((a, b) => a + b, 0) / longPeriod;

    if (prevShortMA <= prevLongMA && shortMA > longMA) {
      events.push({
        date: priceHistory[i].date,
        time: '收盘',
        shortMA: Number(shortMA.toFixed(2)),
        longMA: Number(longMA.toFixed(2)),
        close: priceHistory[i].close,
        type: 'golden',
        shortPeriod,
        longPeriod,
        pairKey,
      });
    }
  }

  return events;
}

export function generatePriceHistoryByCode(code, days = 90) {
  const seed = (parseInt(code, 10) || 1) * 12345;
  const basePrice = seededRandom(seed) * 500 + 10;
  const history = [];
  let currentPrice = basePrice;

  for (let i = days; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const daySeed = seed + i * 1000;

    const open = currentPrice;
    const change = (seededRandom(daySeed) - 0.5) * currentPrice * 0.05;
    const close = open + change;
    const high = Math.max(open, close) * (1 + seededRandom(daySeed + 1) * 0.02);
    const low = Math.min(open, close) * (1 - seededRandom(daySeed + 2) * 0.02);

    history.push({
      date: date.toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.floor(seededRandom(daySeed + 3) * 10000000),
    });

    currentPrice = close;
  }

  return history;
}

function generateStock(index) {
  const code = String(index).padStart(5, '0');
  const seed = index * 12345;
  const basePrice = seededRandom(seed) * 500 + 10;
  const priceHistory = generatePriceHistoryByCode(code, 90);

  const lastGoldenCrossByPair = {};
  for (const pair of MA_PAIRS) {
    const events = detectGoldenCrossEvents(priceHistory, pair.short, pair.long, pair.key);
    lastGoldenCrossByPair[pair.key] = events.length > 0 ? events[events.length - 1] : null;
  }

  const lastClose = priceHistory[priceHistory.length - 1]?.close ?? basePrice;
  const prevClose = priceHistory[priceHistory.length - 2]?.close ?? basePrice;
  const changeVal = lastClose - prevClose;

  return {
    id: code,
    code,
    name: `HK Stock ${code}`,
    nameCn: `港股公司${code}`,
    price: Number(lastClose.toFixed(2)),
    change: Number(changeVal.toFixed(2)),
    changePercent: Number(((changeVal / prevClose) * 100).toFixed(2)),
    volume: Math.floor(seededRandom(seed + 2) * 10000000),
    marketCap: Math.floor(seededRandom(seed + 3) * 100000000000),
    pe: Number((seededRandom(seed + 4) * 50 + 5).toFixed(2)),
    pb: Number((seededRandom(seed + 5) * 10 + 0.5).toFixed(2)),
    dividendYield: Number((seededRandom(seed + 6) * 5).toFixed(2)),
    high52w: Number((basePrice * 1.5).toFixed(2)),
    low52w: Number((basePrice * 0.7).toFixed(2)),
    sector: sectors[index % sectors.length],
    lastGoldenCrossByPair,
    lastGoldenCross: lastGoldenCrossByPair['5-20'],
  };
}

export function generateStocks(count = 3000) {
  return Array.from({ length: count }, (_, i) => generateStock(i + 1));
}

export function generateIndicators(stock) {
  const seed = (parseInt(stock.code, 10) || 1) * 777;
  return {
    rsi: Number((seededRandom(seed + 1) * 100).toFixed(2)),
    macd: Number((seededRandom(seed + 2) * 10 - 5).toFixed(2)),
    ma5: Number((stock.price * (1 + (seededRandom(seed + 3) - 0.5) * 0.1)).toFixed(2)),
    ma10: Number((stock.price * (1 + (seededRandom(seed + 4) - 0.5) * 0.15)).toFixed(2)),
    ma20: Number((stock.price * (1 + (seededRandom(seed + 5) - 0.5) * 0.2)).toFixed(2)),
    ma50: Number((stock.price * (1 + (seededRandom(seed + 6) - 0.5) * 0.25)).toFixed(2)),
    volume: stock.volume,
    turnoverRate: Number((seededRandom(seed + 7) * 10).toFixed(2)),
  };
}

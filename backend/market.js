export const MA_PAIRS = [
  { short: 5, long: 20, key: '5-20', label: 'MA5/20' },
  { short: 20, long: 50, key: '20-50', label: 'MA20/50' },
  { short: 20, long: 60, key: '20-60', label: 'MA20/60' },
];

export const popularStocks = ['00700', '00001', '00005', '00941', '00388', '01299', '02318', '00175', '00883', '03690'];

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

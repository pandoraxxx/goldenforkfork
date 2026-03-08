// 模拟港股数据
export interface Stock {
  id: string;
  code: string;
  name: string;
  nameCn: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  pe: number;
  pb: number;
  dividendYield: number;
  high52w: number;
  low52w: number;
  sector: string;
  lastGoldenCross: GoldenCrossEvent | null; // 最近一次黄金交叉
}

export interface StockIndicator {
  rsi: number; // 相对强弱指标
  macd: number; // MACD
  ma5: number; // 5日均线
  ma10: number; // 10日均线
  ma20: number; // 20日均线
  ma50: number; // 50日均线
  volume: number; // 成交量
  turnoverRate: number; // 换手率
}

export interface PriceHistory {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 黄金交叉事件
export interface GoldenCrossEvent {
  date: string;      // "2025-03-08"
  time: string;      // "16:00"
  shortMA: number;   // MA5 值
  longMA: number;    // MA20 值
  close: number;     // 当日收盘价
  type: 'golden';    // 黄金交叉
}

// 格式化金叉日期时间为 "X月X日 HH:mm"
export function formatGoldenCrossDate(event: GoldenCrossEvent): string {
  const [, m, d] = event.date.split('-');
  return `${parseInt(m, 10)}月${parseInt(d, 10)}日 ${event.time}`;
}

// 基于种子的伪随机数（保证同一股票历史数据可复现）
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

// 检测黄金交叉事件（MA5 上穿 MA20）
export function detectGoldenCrossEvents(
  priceHistory: PriceHistory[],
  shortPeriod: number = 5,
  longPeriod: number = 20
): GoldenCrossEvent[] {
  const events: GoldenCrossEvent[] = [];
  if (priceHistory.length < longPeriod + 1) return events;

  const closes = priceHistory.map((p) => p.close);

  for (let i = longPeriod; i < closes.length; i++) {
    const shortMA =
      closes.slice(i - shortPeriod + 1, i + 1).reduce((a, b) => a + b, 0) / shortPeriod;
    const longMA =
      closes.slice(i - longPeriod + 1, i + 1).reduce((a, b) => a + b, 0) / longPeriod;
    const prevShortMA =
      closes.slice(i - shortPeriod, i).reduce((a, b) => a + b, 0) / shortPeriod;
    const prevLongMA =
      closes.slice(i - longPeriod, i).reduce((a, b) => a + b, 0) / longPeriod;

    if (prevShortMA <= prevLongMA && shortMA > longMA) {
      events.push({
        date: priceHistory[i].date,
        time: '16:00',
        shortMA: parseFloat(shortMA.toFixed(2)),
        longMA: parseFloat(longMA.toFixed(2)),
        close: priceHistory[i].close,
        type: 'golden'
      });
    }
  }
  return events;
}

// 港股板块
const sectors = [
  '科技', '金融', '地产', '能源', '消费', '医疗', '工业', '电信', '公用事业', '材料'
];

// 生成价格历史（带种子，保证同一股票可复现）
function generatePriceHistoryWithSeed(
  seed: number,
  basePrice: number,
  days: number = 90
): PriceHistory[] {
  const history: PriceHistory[] = [];
  let currentPrice = basePrice;

  for (let i = days; i >= 0; i--) {
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
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(seededRandom(daySeed + 3) * 10000000)
    });

    currentPrice = close;
  }
  return history;
}

// 生成随机股票数据
function generateStock(index: number): Stock {
  const code = String(index).padStart(5, '0');
  const sectorIndex = index % sectors.length;
  const seed = index * 12345;
  const basePrice = seededRandom(seed) * 500 + 10;

  const priceHistory = generatePriceHistoryWithSeed(seed, basePrice);
  const goldenCrossEvents = detectGoldenCrossEvents(priceHistory);
  const lastGoldenCross =
    goldenCrossEvents.length > 0 ? goldenCrossEvents[goldenCrossEvents.length - 1] : null;

  const lastClose = priceHistory[priceHistory.length - 1]?.close ?? basePrice;
  const prevClose = priceHistory[priceHistory.length - 2]?.close ?? basePrice;
  const price = parseFloat(lastClose.toFixed(2));
  const changeVal = lastClose - prevClose;
  const changePercent = parseFloat(((changeVal / prevClose) * 100).toFixed(2));

  return {
    id: code,
    code: code,
    name: `HK Stock ${code}`,
    nameCn: `港股公司${code}`,
    price,
    change: parseFloat(changeVal.toFixed(2)),
    changePercent,
    volume: Math.floor(seededRandom(seed + 2) * 10000000),
    marketCap: Math.floor(seededRandom(seed + 3) * 100000000000),
    pe: parseFloat((seededRandom(seed + 4) * 50 + 5).toFixed(2)),
    pb: parseFloat((seededRandom(seed + 5) * 10 + 0.5).toFixed(2)),
    dividendYield: parseFloat((seededRandom(seed + 6) * 5).toFixed(2)),
    high52w: parseFloat((basePrice * 1.5).toFixed(2)),
    low52w: parseFloat((basePrice * 0.7).toFixed(2)),
    sector: sectors[sectorIndex],
    lastGoldenCross
  };
}

// 生成3000+港股数据
export function generateStocks(count: number = 3000): Stock[] {
  return Array.from({ length: count }, (_, i) => generateStock(i + 1));
}

// 生成股票指标
export function generateIndicators(stock: Stock): StockIndicator {
  return {
    rsi: parseFloat((Math.random() * 100).toFixed(2)),
    macd: parseFloat((Math.random() * 10 - 5).toFixed(2)),
    ma5: parseFloat((stock.price * (1 + (Math.random() - 0.5) * 0.1)).toFixed(2)),
    ma10: parseFloat((stock.price * (1 + (Math.random() - 0.5) * 0.15)).toFixed(2)),
    ma20: parseFloat((stock.price * (1 + (Math.random() - 0.5) * 0.2)).toFixed(2)),
    ma50: parseFloat((stock.price * (1 + (Math.random() - 0.5) * 0.25)).toFixed(2)),
    volume: stock.volume,
    turnoverRate: parseFloat((Math.random() * 10).toFixed(2))
  };
}

// 生成价格历史数据（与 generateStock 保持一致的 seeded 逻辑）
export function generatePriceHistory(stock: Stock, days: number = 90): PriceHistory[] {
  const seed = (parseInt(stock.code, 10) || 1) * 12345;
  const basePrice = seededRandom(seed) * 500 + 10;
  return generatePriceHistoryWithSeed(seed, basePrice, days);
}

// 热门股票代码
export const popularStocks = ['00700', '00001', '00005', '00941', '00388', '01299', '02318', '00175', '00883', '03690'];

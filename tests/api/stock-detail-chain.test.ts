import { describe, expect, it } from 'vitest';
import { getJson } from './helpers';

interface StockItem {
  code: string;
}

describe('API gate: stock detail chain', () => {
  it('detail + history + indicators + golden-cross are all available for a listed code', async () => {
    const list = await getJson<{ items: StockItem[] }>('/api/stocks?page=1&pageSize=1');
    const code = list.items[0]?.code;
    expect(code).toMatch(/^\d{5}$/);

    const detail = await getJson<{ code: string; price: number; nameCn: string }>(`/api/stocks/${code}`);
    const history = await getJson<Array<{ date: string; close: number }>>(`/api/stocks/${code}/price-history?days=90`);
    const indicators = await getJson<{
      rsi: number;
      ma5: number;
      ma10: number;
      ma20: number;
      ma50: number;
      turnoverRate: number;
      macd: number;
      macdDif?: number;
      macdDea?: number;
      macdHist?: number;
    }>(`/api/stocks/${code}/indicators`);
    const golden = await getJson<{ pair: { key: string }; events: unknown[] }>(`/api/stocks/${code}/golden-cross?pair=5-20`);

    expect(detail.code).toBe(code);
    expect(detail.price).toBeGreaterThan(0);
    expect(String(detail.nameCn).trim().length).toBeGreaterThan(0);

    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);

    expect(indicators.rsi).toBeGreaterThanOrEqual(0);
    expect(indicators.rsi).toBeLessThanOrEqual(100);
    expect(typeof indicators.ma20).toBe('number');
    expect(typeof indicators.turnoverRate).toBe('number');
    expect(typeof indicators.macdDif).toBe('number');
    expect(typeof indicators.macdDea).toBe('number');
    expect(typeof indicators.macdHist).toBe('number');

    expect(golden.pair.key).toBe('5-20');
    expect(Array.isArray(golden.events)).toBe(true);
  });

  it('error path: invalid code and not-found code return proper status', async () => {
    const invalid = await fetch(`${process.env.TEST_API_BASE_URL}/api/stocks/abcde`);
    expect(invalid.status).toBe(404);

    const notFound = await fetch(`${process.env.TEST_API_BASE_URL}/api/stocks/99999`);
    expect([200, 404]).toContain(notFound.status);
  });

  it('regression: 02977 detail opens and short-history indicators are not all empty', async () => {
    const detailRes = await fetch(`${process.env.TEST_API_BASE_URL}/api/stocks/02977`);
    expect(detailRes.status).toBe(200);

    const indicators = await getJson<{
      ma5: number;
      ma10: number;
      ma20: number;
      ma50: number;
      turnoverRate: number;
      macdDif?: number;
      macdDea?: number;
      macdHist?: number;
    }>('/api/stocks/02977/indicators');

    expect(typeof indicators.turnoverRate).toBe('number');
    expect(typeof indicators.macdDif).toBe('number');
    expect(typeof indicators.macdDea).toBe('number');
    expect(typeof indicators.macdHist).toBe('number');

    const maValues = [indicators.ma5, indicators.ma10, indicators.ma20, indicators.ma50].filter((v) => Number.isFinite(v));
    const hasAnyNonZero = maValues.some((v) => v > 0);
    expect(hasAnyNonZero).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { getJson } from './helpers';

interface Stock {
  code: string;
  nameCn: string;
  price: number;
  changePercent: number;
  volume: number;
  lastGoldenCrossByPair?: Record<string, unknown>;
}

describe('API gate: market/list', () => {
  it('GET /api/market-stats returns valid market breadth', async () => {
    const stats = await getJson<{ rising: number; falling: number; unchanged: number; total: number; updatedAt: string }>('/api/market-stats');

    expect(stats.total).toBeGreaterThan(1000);
    expect(stats.rising).toBeGreaterThanOrEqual(0);
    expect(stats.falling).toBeGreaterThanOrEqual(0);
    expect(stats.unchanged).toBeGreaterThanOrEqual(0);
    expect(stats.rising + stats.falling + stats.unchanged).toBe(stats.total);
    expect(Number.isNaN(Date.parse(stats.updatedAt))).toBe(false);
  });

  it('GET /api/stocks pagination and total are consistent', async () => {
    const page1 = await getJson<{ total: number; page: number; pageSize: number; items: Stock[] }>('/api/stocks?page=1&pageSize=20');
    const page2 = await getJson<{ total: number; page: number; pageSize: number; items: Stock[] }>('/api/stocks?page=2&pageSize=20');

    expect(page1.page).toBe(1);
    expect(page2.page).toBe(2);
    expect(page1.pageSize).toBe(20);
    expect(page1.total).toBeGreaterThan(1000);
    expect(page1.total).toBe(page2.total);
    expect(page1.items.length).toBeLessThanOrEqual(20);
    expect(page2.items.length).toBeLessThanOrEqual(20);

    const page1Codes = new Set(page1.items.map((x) => x.code));
    const overlap = page2.items.filter((x) => page1Codes.has(x.code));
    expect(overlap.length).toBe(0);
  });

  it('GET /api/stocks sortBy=volume sorts descending', async () => {
    const data = await getJson<{ items: Stock[] }>('/api/stocks?sortBy=volume&page=1&pageSize=20');
    const vols = data.items.map((x) => x.volume);
    for (let i = 1; i < vols.length; i += 1) {
      expect(vols[i - 1]).toBeGreaterThanOrEqual(vols[i]);
    }
  });

  it('tab popular/gainers/losers behave correctly', async () => {
    const popular = await getJson<{ items: Stock[]; total: number }>('/api/stocks?tab=popular&page=1&pageSize=20');
    const gainers = await getJson<{ items: Stock[]; total: number }>('/api/stocks?tab=gainers&page=1&pageSize=20');
    const losers = await getJson<{ items: Stock[]; total: number }>('/api/stocks?tab=losers&page=1&pageSize=20');

    expect(popular.items.length).toBeGreaterThan(0);
    expect(popular.total).toBe(popular.items.length);

    expect(gainers.total).toBeGreaterThan(0);
    expect(gainers.items.length).toBeGreaterThan(0);
    expect(gainers.items.every((x) => x.changePercent > 0)).toBe(true);

    expect(losers.total).toBeGreaterThan(0);
    expect(losers.items.length).toBeGreaterThan(0);
    expect(losers.items.every((x) => x.changePercent < 0)).toBe(true);
  });

  it('regression: Chinese name should not be garbled and golden-cross fields exist', async () => {
    const data = await getJson<{ items: Stock[] }>('/api/stocks?page=1&pageSize=20');
    const first = data.items[0];

    expect(first).toBeTruthy();
    expect(first.code).toMatch(/^\d{5}$/);
    expect(String(first.nameCn).trim().length).toBeGreaterThan(0);
    expect(String(first.nameCn)).not.toMatch(/[�]/);
    expect(typeof first.lastGoldenCrossByPair).toBe('object');
  });
});

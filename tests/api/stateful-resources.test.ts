import { beforeEach, describe, expect, it } from 'vitest';
import { del, getJson, patchJson, postJson, putJson } from './helpers';

interface Subscription {
  id: string;
  stockCode: string;
  indicator: 'price' | 'rsi' | 'macd' | 'volume' | 'pe' | 'pb';
  condition: 'above' | 'below' | 'equal';
  value: number;
  isActive: boolean;
}

interface Notification {
  id: string;
  read: boolean;
}

describe('API gate: favorites/subscriptions/notifications/preferences', () => {
  let code = '00700';

  beforeEach(async () => {
    const list = await getJson<{ items: Array<{ code: string }> }>('/api/stocks?page=1&pageSize=1');
    if (list.items[0]?.code) code = list.items[0].code;
  });

  it('favorites add/list/delete + invalid code check', async () => {
    const badAdd = await postJson<{ error: string }>('/api/favorites', { stockCode: 'abcde' });
    expect(badAdd.status).toBe(400);

    const add = await postJson<{ stockCode: string }>('/api/favorites', { stockCode: code });
    expect(add.status).toBe(201);
    expect(add.data.stockCode).toBe(code);

    const list = await getJson<string[]>('/api/favorites');
    expect(list.includes(code)).toBe(true);

    const removed = await del(`/api/favorites/${code}`);
    expect(removed).toBe(204);

    const listAfter = await getJson<string[]>('/api/favorites');
    expect(listAfter.includes(code)).toBe(false);
  });

  it('preferences get/put validates golden-cross pair', async () => {
    const pref = await getJson<{ pairKey: string }>('/api/preferences/golden-cross-pair');
    expect(['5-20', '20-50', '20-60']).toContain(pref.pairKey);

    const update = await putJson<{ pairKey: string }>('/api/preferences/golden-cross-pair', { pairKey: '20-50' });
    expect(update.status).toBe(200);
    expect(update.data.pairKey).toBe('20-50');

    const invalid = await putJson<{ error: string }>('/api/preferences/golden-cross-pair', { pairKey: '1-2' });
    expect(invalid.status).toBe(400);
  });

  it('subscriptions lifecycle and notifications workflow', async () => {
    const create = await postJson<Subscription>('/api/subscriptions', {
      stockCode: code,
      stockName: code,
      indicator: 'price',
      condition: 'above',
      value: -1,
      isActive: true,
    });
    expect(create.status).toBe(201);

    const sub = create.data;
    expect(sub.id).toBeTruthy();
    expect(sub.stockCode).toBe(code);

    const patch = await patchJson<Subscription>(`/api/subscriptions/${sub.id}`, { value: -2 });
    expect(patch.status).toBe(200);
    expect(patch.data.value).toBe(-2);

    const toggled = await postJson<Subscription>(`/api/subscriptions/${sub.id}/toggle`);
    expect(toggled.status).toBe(200);
    expect(toggled.data.isActive).toBe(false);

    const toggledBack = await postJson<Subscription>(`/api/subscriptions/${sub.id}/toggle`);
    expect(toggledBack.status).toBe(200);
    expect(toggledBack.data.isActive).toBe(true);

    const check = await postJson<{ count: number; notifications: Notification[] }>('/api/subscriptions/check');
    expect(check.status).toBe(200);
    expect(check.data.count).toBeGreaterThanOrEqual(0);

    const notifications = await getJson<Notification[]>('/api/notifications');
    if (notifications.length > 0) {
      const first = notifications[0];
      const markOne = await postJson<Notification>(`/api/notifications/${first.id}/read`);
      expect(markOne.status).toBe(200);
      expect(markOne.data.read).toBe(true);
    }

    const markAll = await postJson<void>('/api/notifications/read-all');
    expect(markAll.status).toBe(204);

    const allRead = await getJson<Notification[]>('/api/notifications');
    expect(allRead.every((n) => n.read)).toBe(true);

    const clearAll = await del('/api/notifications');
    expect(clearAll).toBe(204);

    const afterClear = await getJson<Notification[]>('/api/notifications');
    expect(afterClear.length).toBe(0);

    const delSub = await del(`/api/subscriptions/${sub.id}`);
    expect(delSub).toBe(204);
  });
});

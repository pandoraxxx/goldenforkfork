export type Indicator = 'price' | 'rsi' | 'macd' | 'volume' | 'pe' | 'pb';
export type Condition = 'above' | 'below' | 'equal';

export interface GoldenCrossEvent {
  date: string;
  time: string;
  shortMA: number;
  longMA: number;
  close: number;
  type: 'golden';
  shortPeriod: number;
  longPeriod: number;
  pairKey: string;
}

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
  lastGoldenCrossByPair: Record<string, GoldenCrossEvent | null>;
  lastGoldenCross: GoldenCrossEvent | null;
}

export interface StockIndicator {
  rsi: number;
  // Backward-compatible MACD main value (DIF).
  macd: number;
  macdDif?: number;
  macdDea?: number;
  macdHist?: number;
  ma5: number;
  ma10: number;
  ma20: number;
  ma50: number;
  volume: number;
  turnoverRate: number;
}

export interface PriceHistory {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Subscription {
  id: string;
  stockCode: string;
  stockName: string;
  indicator: Indicator;
  condition: Condition;
  value: number;
  isActive: boolean;
  createdAt: string;
  triggeredAt?: string;
}

export interface Notification {
  id: string;
  subscriptionId: string;
  stockCode: string;
  stockName: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface StocksParams {
  search?: string;
  sector?: string;
  tab?: 'all' | 'popular' | 'gainers' | 'losers';
  sortBy?: 'code' | 'change' | 'volume' | 'marketCap' | 'lastGoldenCross';
  pair?: string;
  page?: number;
  pageSize?: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP_${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export async function getMeta() {
  return request<{ sectors: string[]; maPairs: { short: number; long: number; key: string; label: string }[]; popularStocks: string[] }>('/api/meta');
}

export async function getMarketStats() {
  return request<{ rising: number; falling: number; unchanged: number; total: number; updatedAt: string }>('/api/market-stats');
}

export async function getStocks(params: StocksParams) {
  const search = new URLSearchParams();
  if (params.search) search.set('search', params.search);
  if (params.sector) search.set('sector', params.sector);
  if (params.tab) search.set('tab', params.tab);
  if (params.sortBy) search.set('sortBy', params.sortBy);
  if (params.pair) search.set('pair', params.pair);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));

  return request<{ items: Stock[]; total: number; page: number; pageSize: number }>(`/api/stocks?${search.toString()}`);
}

export async function getStock(code: string) {
  return request<Stock>(`/api/stocks/${code}`);
}

export async function getLiveStock(code: string) {
  return request<Partial<Stock>>(`/api/live/stocks/${code}`);
}

export async function getStockIndicators(code: string, live = false) {
  return request<StockIndicator>(`${live ? '/api/live' : '/api'}/stocks/${code}/indicators`);
}

export async function getStockPriceHistory(code: string, options?: { live?: boolean; days?: number; range?: string; interval?: string }) {
  if (options?.live) {
    const search = new URLSearchParams();
    if (options.range) search.set('range', options.range);
    if (options.interval) search.set('interval', options.interval);
    const q = search.toString();
    return request<PriceHistory[]>(`/api/live/stocks/${code}/price-history${q ? `?${q}` : ''}`);
  }

  const days = options?.days ?? 90;
  return request<PriceHistory[]>(`/api/stocks/${code}/price-history?days=${days}`);
}

export async function getStockGoldenCross(code: string, pair: string, live = false) {
  return request<{ pair: { short: number; long: number; key: string; label: string }; events: GoldenCrossEvent[] }>(
    `${live ? '/api/live' : '/api'}/stocks/${code}/golden-cross?pair=${encodeURIComponent(pair)}`,
  );
}

export async function getFavorites() {
  return request<string[]>('/api/favorites');
}

export async function addFavorite(stockCode: string) {
  return request<{ stockCode: string }>('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ stockCode }),
  });
}

export async function removeFavorite(stockCode: string) {
  return request<void>(`/api/favorites/${stockCode}`, { method: 'DELETE' });
}

export async function getSubscriptions() {
  return request<Subscription[]>('/api/subscriptions');
}

export async function getSubscription(id: string) {
  const subscriptions = await getSubscriptions();
  return subscriptions.find((item) => item.id === id);
}

export async function createSubscription(payload: Omit<Subscription, 'id' | 'createdAt'>) {
  return request<Subscription>('/api/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function patchSubscription(id: string, updates: Partial<Omit<Subscription, 'id' | 'createdAt'>>) {
  return request<Subscription>(`/api/subscriptions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function toggleSubscription(id: string) {
  return request<Subscription>(`/api/subscriptions/${id}/toggle`, { method: 'POST' });
}

export async function deleteSubscription(id: string) {
  return request<void>(`/api/subscriptions/${id}`, { method: 'DELETE' });
}

export async function checkSubscriptions() {
  return request<{ count: number; notifications: Notification[] }>('/api/subscriptions/check', { method: 'POST' });
}

export async function getNotifications() {
  return request<Notification[]>('/api/notifications');
}

export async function markNotificationAsRead(id: string) {
  return request<Notification>(`/api/notifications/${id}/read`, { method: 'POST' });
}

export async function markAllNotificationsAsRead() {
  return request<void>('/api/notifications/read-all', { method: 'POST' });
}

export async function deleteNotification(id: string) {
  return request<void>(`/api/notifications/${id}`, { method: 'DELETE' });
}

export async function clearAllNotifications() {
  return request<void>('/api/notifications', { method: 'DELETE' });
}

export async function getGoldenCrossPairPreference() {
  return request<{ pairKey: string }>('/api/preferences/golden-cross-pair');
}

export async function setGoldenCrossPairPreference(pairKey: string) {
  return request<{ pairKey: string }>('/api/preferences/golden-cross-pair', {
    method: 'PUT',
    body: JSON.stringify({ pairKey }),
  });
}

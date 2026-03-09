// 本地存储管理
export interface Subscription {
  id: string;
  stockCode: string;
  stockName: string;
  indicator: 'price' | 'rsi' | 'macd' | 'volume' | 'pe' | 'pb';
  condition: 'above' | 'below' | 'equal';
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

const SUBSCRIPTIONS_KEY = 'hk_stock_subscriptions';
const NOTIFICATIONS_KEY = 'hk_stock_notifications';
const FAVORITES_KEY = 'hk_stock_favorites';
const GOLDEN_CROSS_PAIR_KEY = 'hk_golden_cross_pair';

// 订阅管理
export function getSubscriptions(): Subscription[] {
  const data = localStorage.getItem(SUBSCRIPTIONS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveSubscription(subscription: Omit<Subscription, 'id' | 'createdAt'>): Subscription {
  const subscriptions = getSubscriptions();
  const newSubscription: Subscription = {
    ...subscription,
    id: Date.now().toString(),
    createdAt: new Date().toISOString()
  };
  subscriptions.push(newSubscription);
  localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions));
  return newSubscription;
}

export function updateSubscription(id: string, updates: Partial<Omit<Subscription, 'id' | 'createdAt'>>): void {
  const subscriptions = getSubscriptions();
  const index = subscriptions.findIndex(s => s.id === id);
  if (index !== -1) {
    subscriptions[index] = { ...subscriptions[index], ...updates };
    localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions));
  }
}

export function getSubscription(id: string): Subscription | undefined {
  const subscriptions = getSubscriptions();
  return subscriptions.find(s => s.id === id);
}

export function deleteSubscription(id: string): void {
  const subscriptions = getSubscriptions();
  const filtered = subscriptions.filter(s => s.id !== id);
  localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(filtered));
}

export function toggleSubscription(id: string): void {
  const subscriptions = getSubscriptions();
  const subscription = subscriptions.find(s => s.id === id);
  if (subscription) {
    subscription.isActive = !subscription.isActive;
    localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions));
  }
}

export function updateSubscriptionTrigger(id: string): void {
  const subscriptions = getSubscriptions();
  const subscription = subscriptions.find(s => s.id === id);
  if (subscription) {
    subscription.triggeredAt = new Date().toISOString();
    localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions));
  }
}

// 通知管理
export function getNotifications(): Notification[] {
  const data = localStorage.getItem(NOTIFICATIONS_KEY);
  return data ? JSON.parse(data) : [];
}

export function addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Notification {
  const notifications = getNotifications();
  const newNotification: Notification = {
    ...notification,
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    read: false
  };
  notifications.unshift(newNotification);
  // 只保留最近100条通知
  if (notifications.length > 100) {
    notifications.splice(100);
  }
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  return newNotification;
}

export function markNotificationAsRead(id: string): void {
  const notifications = getNotifications();
  const notification = notifications.find(n => n.id === id);
  if (notification) {
    notification.read = true;
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  }
}

export function markAllNotificationsAsRead(): void {
  const notifications = getNotifications();
  notifications.forEach(n => n.read = true);
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

export function deleteNotification(id: string): void {
  const notifications = getNotifications();
  const filtered = notifications.filter(n => n.id !== id);
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(filtered));
}

export function clearAllNotifications(): void {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([]));
}

// 自选股管理
export function getFavorites(): string[] {
  const data = localStorage.getItem(FAVORITES_KEY);
  return data ? JSON.parse(data) : [];
}

export function addFavorite(stockCode: string): void {
  const favorites = getFavorites();
  if (!favorites.includes(stockCode)) {
    favorites.push(stockCode);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }
}

export function removeFavorite(stockCode: string): void {
  const favorites = getFavorites();
  const filtered = favorites.filter(code => code !== stockCode);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
}

export function isFavorite(stockCode: string): boolean {
  const favorites = getFavorites();
  return favorites.includes(stockCode);
}

// 金叉均线组合偏好（用于列表排序与「最近金叉」列）
export function getGoldenCrossPair(): string {
  const v = localStorage.getItem(GOLDEN_CROSS_PAIR_KEY);
  return v ?? '5-20';
}

export function setGoldenCrossPair(pairKey: string): void {
  localStorage.setItem(GOLDEN_CROSS_PAIR_KEY, pairKey);
}
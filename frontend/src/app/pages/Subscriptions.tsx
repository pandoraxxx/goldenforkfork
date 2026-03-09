import { useState, useEffect, useMemo } from 'react';
import {
  checkSubscriptions,
  clearAllNotifications,
  deleteNotification,
  deleteSubscription,
  getNotifications,
  getSubscriptions,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  Notification,
  Subscription,
  toggleSubscription,
} from '../api/client';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Bell, Trash2, BellOff, CheckCheck, X, Edit, Search, TrendingUp, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router';
import { EditSubscriptionDialog } from '../components/EditSubscriptionDialog';

export function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [indicatorFilter, setIndicatorFilter] = useState<'all' | 'price' | 'rsi' | 'macd' | 'volume' | 'pe' | 'pb'>('all');

  const loadData = async () => {
    try {
      const [subs, notes] = await Promise.all([getSubscriptions(), getNotifications()]);
      setSubscriptions(subs);
      setNotifications(notes);
    } catch {
      setSubscriptions([]);
      setNotifications([]);
    }
  };

  useEffect(() => {
    loadData();

    const interval = setInterval(loadData, 15000);
    const checkInterval = setInterval(async () => {
      try {
        const result = await checkSubscriptions();
        if (result.count > 0 && result.notifications[0]) {
          toast.info('订阅提醒', {
            description: result.notifications[0].message,
          });
          await loadData();
        }
      } catch {
        // ignore
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      clearInterval(checkInterval);
    };
  }, []);

  const filteredSubscriptions = useMemo(() => {
    let result = subscriptions;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) =>
        s.stockCode.toLowerCase().includes(query) ||
        s.stockName.toLowerCase().includes(query),
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((s) =>
        statusFilter === 'active' ? s.isActive : !s.isActive,
      );
    }

    if (indicatorFilter !== 'all') {
      result = result.filter((s) => s.indicator === indicatorFilter);
    }

    return result;
  }, [subscriptions, searchQuery, statusFilter, indicatorFilter]);

  const handleToggleSubscription = async (id: string) => {
    await toggleSubscription(id);
    await loadData();
    toast.success('订阅状态已更新');
  };

  const handleDeleteSubscription = async (id: string) => {
    await deleteSubscription(id);
    await loadData();
    toast.success('订阅已删除');
  };

  const handleMarkAsRead = async (id: string) => {
    await markNotificationAsRead(id);
    await loadData();
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead();
    await loadData();
    toast.success('所有通知已标记为已读');
  };

  const handleDeleteNotification = async (id: string) => {
    await deleteNotification(id);
    await loadData();
  };

  const handleClearAll = async () => {
    await clearAllNotifications();
    await loadData();
    toast.success('所有通知已清除');
  };

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const stats = useMemo(() => {
    return {
      total: subscriptions.length,
      active: subscriptions.filter((s) => s.isActive).length,
      triggered: subscriptions.filter((s) => s.triggeredAt).length,
    };
  }, [subscriptions]);

  const indicatorLabels: Record<string, string> = {
    price: '价格',
    rsi: 'RSI',
    macd: 'MACD',
    volume: '成交量',
    pe: '市盈率',
    pb: '市净率',
  };

  const conditionLabels: Record<string, string> = {
    above: '大于',
    below: '小于',
    equal: '等于',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-3xl font-bold">订阅监控</h2>
            <p className="text-sm text-muted-foreground mt-1">管理您的股票监控订阅和通知</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">总订阅数</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">监控中</div>
              <div className="text-2xl font-bold text-green-500">{stats.active}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <AlertCircle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">已触发</div>
              <div className="text-2xl font-bold text-amber-500">{stats.triggered}</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="subscriptions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="subscriptions">
            我的订阅 ({filteredSubscriptions.length})
          </TabsTrigger>
          <TabsTrigger value="notifications">
            通知 {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">
          {subscriptions.length > 0 && (
            <Card className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="搜索股票代码或名称..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="active">监控中</SelectItem>
                    <SelectItem value="inactive">已暂停</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={indicatorFilter} onValueChange={(value: 'all' | 'price' | 'rsi' | 'macd' | 'volume' | 'pe' | 'pb') => setIndicatorFilter(value)}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="指标" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部指标</SelectItem>
                    {Object.entries(indicatorLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>
          )}

          {filteredSubscriptions.length === 0 ? (
            <Card className="p-12 text-center">
              <BellOff className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {subscriptions.length === 0 ? '暂无订阅' : '无匹配结果'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {subscriptions.length === 0
                  ? '在股票详情页创建监控订阅，当指标触发时将收到通知'
                  : '尝试调整筛选条件或搜索关键词'}
              </p>
              <Link to="/">
                <Button>前往市场</Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredSubscriptions.map((sub) => (
                <Card key={sub.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Link
                          to={`/stock/${sub.stockCode}`}
                          className="font-semibold hover:underline"
                        >
                          {sub.stockName}
                        </Link>
                        <Badge variant="outline">{sub.stockCode}</Badge>
                        {sub.isActive ? (
                          <Badge variant="default" className="gap-1">
                            <Bell className="h-3 w-3" />
                            监控中
                          </Badge>
                        ) : (
                          <Badge variant="secondary">已暂停</Badge>
                        )}
                        {sub.triggeredAt && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            已触发
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="font-medium">
                          监控条件: {indicatorLabels[sub.indicator]} {conditionLabels[sub.condition]} {sub.value}
                        </div>
                        <div className="text-xs text-muted-foreground/80">
                          创建时间: {new Date(sub.createdAt).toLocaleString('zh-CN')}
                        </div>
                        {sub.triggeredAt && (
                          <div className="text-xs text-amber-500">
                            最近触发: {new Date(sub.triggeredAt).toLocaleString('zh-CN')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={sub.isActive}
                        onCheckedChange={() => handleToggleSubscription(sub.id)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingId(sub.id)}
                        title="编辑"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteSubscription(sub.id)}
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          {notifications.length === 0 ? (
            <Card className="p-12 text-center">
              <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">暂无通知</h3>
              <p className="text-muted-foreground">
                当您的订阅条件触发时，通知将显示在这里
              </p>
            </Card>
          ) : (
            <>
              <div className="flex justify-end gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    className="gap-2"
                  >
                    <CheckCheck className="h-4 w-4" />
                    全部已读
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  清空通知
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {notifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className={`p-4 transition-all ${notification.read ? 'bg-muted/50' : 'bg-primary/10 border-primary/30 shadow-sm'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Link
                            to={`/stock/${notification.stockCode}`}
                            className="font-semibold hover:underline"
                          >
                            {notification.stockName}
                          </Link>
                          <Badge variant="outline">{notification.stockCode}</Badge>
                          {!notification.read && (
                            <Badge variant="destructive">新</Badge>
                          )}
                        </div>

                        <p className="text-sm text-foreground mb-2">
                          {notification.message}
                        </p>

                        <div className="text-xs text-muted-foreground">
                          {new Date(notification.timestamp).toLocaleString('zh-CN')}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMarkAsRead(notification.id)}
                            title="标记为已读"
                          >
                            <CheckCheck className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteNotification(notification.id)}
                          title="删除"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {editingId && (
        <EditSubscriptionDialog
          subscriptionId={editingId}
          open={true}
          onOpenChange={(open) => !open && setEditingId(null)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}

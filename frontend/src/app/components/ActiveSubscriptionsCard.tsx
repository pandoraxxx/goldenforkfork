import { useState, useEffect } from 'react';
import { deleteSubscription, getSubscriptions, toggleSubscription, Subscription } from '../api/client';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { BellRing, Trash2, Edit, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { EditSubscriptionDialog } from './EditSubscriptionDialog';
import { Link } from 'react-router';

interface ActiveSubscriptionsCardProps {
  stockCode: string;
}

export function ActiveSubscriptionsCard({ stockCode }: ActiveSubscriptionsCardProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const list = await getSubscriptions();
      setSubscriptions(list.filter((s) => s.stockCode === stockCode));
    } catch {
      setSubscriptions([]);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [stockCode]);

  const handleToggle = async (id: string) => {
    await toggleSubscription(id);
    await refresh();
    toast.success('订阅状态已更新');
  };

  const handleDelete = async (id: string) => {
    await deleteSubscription(id);
    await refresh();
    toast.success('订阅已删除');
  };

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

  if (subscriptions.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <BellRing className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">当前监控订阅</h3>
          <Badge variant="secondary">{subscriptions.length}</Badge>
        </div>

        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <Card key={sub.id} className="p-4 bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {sub.isActive ? (
                      <Badge variant="default" className="gap-1">
                        <BellRing className="h-3 w-3" />
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

                  <div className="text-sm space-y-1">
                    <div className="font-medium">
                      {indicatorLabels[sub.indicator]} {conditionLabels[sub.condition]} {sub.value}
                    </div>
                    <div className="text-xs text-gray-500">
                      创建于 {new Date(sub.createdAt).toLocaleString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    {sub.triggeredAt && (
                      <div className="text-xs text-orange-600">
                        最近触发: {new Date(sub.triggeredAt).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={sub.isActive}
                    onCheckedChange={() => handleToggle(sub.id)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditingId(sub.id)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDelete(sub.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t">
          <Link to="/subscriptions">
            <Button variant="outline" className="w-full">
              查看所有订阅
            </Button>
          </Link>
        </div>
      </Card>

      {editingId && (
        <EditSubscriptionDialog
          subscriptionId={editingId}
          open={true}
          onOpenChange={(open) => !open && setEditingId(null)}
          onSuccess={refresh}
        />
      )}
    </>
  );
}

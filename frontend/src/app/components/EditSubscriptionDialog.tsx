import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getSubscription, patchSubscription } from '../api/client';
import { toast } from 'sonner';

interface EditSubscriptionDialogProps {
  subscriptionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditSubscriptionDialog({ subscriptionId, open, onOpenChange, onSuccess }: EditSubscriptionDialogProps) {
  const [loaded, setLoaded] = useState<{ stockName: string; stockCode: string } | null>(null);
  const [indicator, setIndicator] = useState('price');
  const [condition, setCondition] = useState('above');
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) return;
    let alive = true;

    getSubscription(subscriptionId)
      .then((subscription) => {
        if (!alive || !subscription) return;
        setLoaded({ stockName: subscription.stockName, stockCode: subscription.stockCode });
        setIndicator(subscription.indicator);
        setCondition(subscription.condition);
        setValue(String(subscription.value));
      })
      .catch(() => {
        if (alive) setLoaded(null);
      });

    return () => {
      alive = false;
    };
  }, [open, subscriptionId]);

  const indicatorLabels: Record<string, string> = {
    price: '价格',
    rsi: 'RSI指标',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!value || Number.isNaN(Number(value))) {
      toast.error('请输入有效的数值');
      return;
    }

    try {
      await patchSubscription(subscriptionId, {
        indicator: indicator as 'price' | 'rsi' | 'macd' | 'volume' | 'pe' | 'pb',
        condition: condition as 'above' | 'below' | 'equal',
        value: Number(value),
      });

      toast.success('订阅已更新');
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error('订阅更新失败，请稍后重试');
    }
  };

  if (!loaded) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑订阅</DialogTitle>
          <DialogDescription>
            修改 {loaded.stockName} ({loaded.stockCode}) 的监控订阅
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-indicator">监控指标</Label>
            <Select value={indicator} onValueChange={setIndicator}>
              <SelectTrigger id="edit-indicator">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(indicatorLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-condition">触发条件</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger id="edit-condition">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(conditionLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-value">目标值</Label>
            <Input
              id="edit-value"
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="请输入目标值"
              required
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">
              保存修改
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

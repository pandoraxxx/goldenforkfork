import { useEffect, useState } from 'react';
import { createSubscription, getStockIndicators, Stock, StockIndicator } from '../api/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Sparkles, Settings } from 'lucide-react';
import { SubscriptionTemplates } from './SubscriptionTemplates';

interface SubscriptionFormProps {
  stock: Stock;
  onSuccess?: () => void;
}

const fallbackIndicators: StockIndicator = {
  rsi: 50,
  macd: 0,
  macdDif: 0,
  macdDea: 0,
  macdHist: 0,
  ma5: 0,
  ma10: 0,
  ma20: 0,
  ma50: 0,
  volume: 0,
  turnoverRate: 0,
};

export function SubscriptionForm({ stock, onSuccess }: SubscriptionFormProps) {
  const [indicator, setIndicator] = useState<'price' | 'rsi' | 'macd' | 'volume' | 'pe' | 'pb'>('price');
  const [condition, setCondition] = useState<'above' | 'below' | 'equal'>('above');
  const [value, setValue] = useState('');
  const [indicators, setIndicators] = useState<StockIndicator>(fallbackIndicators);

  useEffect(() => {
    let alive = true;
    getStockIndicators(stock.code, true)
      .then((data) => {
        if (alive) setIndicators(data);
      })
      .catch(() => {
        if (alive) setIndicators(fallbackIndicators);
      });

    return () => {
      alive = false;
    };
  }, [stock.code]);

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

  const getCurrentValue = () => {
    switch (indicator) {
      case 'price':
        return stock.price;
      case 'rsi':
        return indicators.rsi;
      case 'macd':
        return indicators.macd;
      case 'volume':
        return stock.volume;
      case 'pe':
        return stock.pe;
      case 'pb':
        return stock.pb;
      default:
        return 0;
    }
  };

  const currentValue = getCurrentValue();

  const suggestedValues = () => {
    switch (indicator) {
      case 'price':
        return [
          { label: '+5%', value: (stock.price * 1.05).toFixed(2) },
          { label: '+10%', value: (stock.price * 1.1).toFixed(2) },
          { label: '-5%', value: (stock.price * 0.95).toFixed(2) },
          { label: '-10%', value: (stock.price * 0.9).toFixed(2) },
        ];
      case 'pe':
        return [
          { label: '10', value: '10' },
          { label: '15', value: '15' },
          { label: '20', value: '20' },
          { label: '30', value: '30' },
        ];
      case 'pb':
        return [
          { label: '1.0', value: '1' },
          { label: '1.5', value: '1.5' },
          { label: '2.0', value: '2' },
          { label: '3.0', value: '3' },
        ];
      case 'volume':
        return [
          { label: '+50%', value: Math.floor(stock.volume * 1.5).toString() },
          { label: '+100%', value: Math.floor(stock.volume * 2).toString() },
          { label: '+200%', value: Math.floor(stock.volume * 3).toString() },
        ];
      default:
        return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!value || Number.isNaN(Number(value))) {
      toast.error('请输入有效的数值');
      return;
    }

    try {
      await createSubscription({
        stockCode: stock.code,
        stockName: stock.nameCn,
        indicator,
        condition,
        value: Number(value),
        isActive: true,
      });

      toast.success('订阅创建成功！', {
        description: `当 ${stock.nameCn} 的${indicatorLabels[indicator]}${conditionLabels[condition]} ${value} 时将通知您`,
      });

      setValue('');
      onSuccess?.();
    } catch {
      toast.error('订阅创建失败，请稍后重试');
    }
  };

  return (
    <Card className="p-6">
      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates" className="gap-2">
            <Sparkles className="h-4 w-4" />
            快速模板
          </TabsTrigger>
          <TabsTrigger value="custom" className="gap-2">
            <Settings className="h-4 w-4" />
            自定义
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <SubscriptionTemplates stock={stock} onSubscribe={onSuccess} />
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">自定义监控订阅</h3>
            <p className="text-sm text-gray-600">设置自定义指标和目标值，当条件触发时将通知您</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="indicator">监控指标</Label>
              <Select value={indicator} onValueChange={(value: 'price' | 'rsi' | 'macd' | 'volume' | 'pe' | 'pb') => setIndicator(value)}>
                <SelectTrigger id="indicator">
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
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>当前值:</span>
                <Badge variant="secondary">
                  {currentValue.toFixed(2)}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="condition">触发条件</Label>
              <Select value={condition} onValueChange={(value: 'above' | 'below' | 'equal') => setCondition(value)}>
                <SelectTrigger id="condition">
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

            <div className="space-y-2">
              <Label htmlFor="value">目标值</Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="请输入目标值"
                required
              />

              {suggestedValues().length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">快速选择:</div>
                  <div className="flex flex-wrap gap-2">
                    {suggestedValues().map((suggested) => (
                      <Button
                        key={suggested.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setValue(suggested.value)}
                      >
                        {suggested.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {value && !Number.isNaN(Number(value)) && (
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="text-sm">
                  <div className="font-semibold mb-1">订阅预览</div>
                  <div className="text-gray-700">
                    当 <span className="font-semibold">{stock.nameCn}</span> 的
                    <span className="font-semibold">{indicatorLabels[indicator]}</span>
                    <span className="font-semibold">{conditionLabels[condition]}</span>
                    <span className="font-semibold"> {value}</span> 时，
                    系统将发送通知提醒您
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    当前值: {currentValue.toFixed(2)}
                  </div>
                </div>
              </Card>
            )}

            <Button type="submit" className="w-full" size="lg">
              创建订阅
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

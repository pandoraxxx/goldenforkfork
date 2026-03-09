import { Stock, createSubscription } from '../api/client';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Activity, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

interface SubscriptionTemplate {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  indicator: 'price' | 'rsi' | 'macd' | 'volume' | 'pe' | 'pb';
  condition: 'above' | 'below' | 'equal';
  getValue: (stock: Stock) => number;
}

const templates: SubscriptionTemplate[] = [
  {
    id: 'price-breakout',
    name: '突破新高',
    description: '当股价突破52周最高价时提醒',
    icon: TrendingUp,
    color: 'text-green-600',
    indicator: 'price',
    condition: 'above',
    getValue: (stock) => stock.high52w,
  },
  {
    id: 'price-support',
    name: '跌破支撑',
    description: '当股价跌破52周最低价时提醒',
    icon: TrendingDown,
    color: 'text-red-600',
    indicator: 'price',
    condition: 'below',
    getValue: (stock) => stock.low52w,
  },
  {
    id: 'price-target-high',
    name: '价格上涨10%',
    description: '当股价上涨10%时提醒',
    icon: TrendingUp,
    color: 'text-blue-600',
    indicator: 'price',
    condition: 'above',
    getValue: (stock) => stock.price * 1.1,
  },
  {
    id: 'price-target-low',
    name: '价格下跌10%',
    description: '当股价下跌10%时提醒',
    icon: TrendingDown,
    color: 'text-orange-600',
    indicator: 'price',
    condition: 'below',
    getValue: (stock) => stock.price * 0.9,
  },
  {
    id: 'pe-low',
    name: '低估值机会',
    description: '当市盈率低于15时提醒（可能被低估）',
    icon: DollarSign,
    color: 'text-purple-600',
    indicator: 'pe',
    condition: 'below',
    getValue: () => 15,
  },
  {
    id: 'pe-high',
    name: '高估值预警',
    description: '当市盈率高于30时提醒（可能被高估）',
    icon: AlertTriangle,
    color: 'text-yellow-600',
    indicator: 'pe',
    condition: 'above',
    getValue: () => 30,
  },
  {
    id: 'volume-surge',
    name: '成交量激增',
    description: '当成交量超过当前2倍时提醒',
    icon: BarChart3,
    color: 'text-cyan-600',
    indicator: 'volume',
    condition: 'above',
    getValue: (stock) => stock.volume * 2,
  },
  {
    id: 'pb-low',
    name: '低市净率',
    description: '当市净率低于1.5时提醒',
    icon: Activity,
    color: 'text-indigo-600',
    indicator: 'pb',
    condition: 'below',
    getValue: () => 1.5,
  },
];

interface SubscriptionTemplatesProps {
  stock: Stock;
  onSubscribe?: () => void;
}

export function SubscriptionTemplates({ stock, onSubscribe }: SubscriptionTemplatesProps) {
  const handleApplyTemplate = async (template: SubscriptionTemplate) => {
    const value = template.getValue(stock);

    try {
      await createSubscription({
        stockCode: stock.code,
        stockName: stock.nameCn,
        indicator: template.indicator,
        condition: template.condition,
        value,
        isActive: true,
      });

      const indicatorLabels: Record<string, string> = {
        price: '价格',
        rsi: 'RSI',
        macd: 'MACD',
        volume: '成交量',
        pe: '市盈率',
        pb: '市净率',
      };

      const conditionLabels: Record<string, string> = {
        above: '高于',
        below: '低于',
        equal: '等于',
      };

      toast.success('订阅创建成功！', {
        description: `${template.name}: ${indicatorLabels[template.indicator]}${conditionLabels[template.condition]} ${value.toFixed(2)}`,
      });

      onSubscribe?.();
    } catch {
      toast.error('订阅创建失败，请稍后重试');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">快速订阅模板</h3>
        <p className="text-sm text-gray-600">选择预设模板快速创建订阅，当条件触发时将通知您</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {templates.map((template) => {
          const Icon = template.icon;
          const value = template.getValue(stock);

          const indicatorLabels: Record<string, string> = {
            price: '价格',
            rsi: 'RSI',
            macd: 'MACD',
            volume: '成交量',
            pe: '市盈率',
            pb: '市净率',
          };

          const conditionLabels: Record<string, string> = {
            above: '>',
            below: '<',
            equal: '=',
          };

          return (
            <Card key={template.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg bg-gray-50 ${template.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold mb-1">{template.name}</h4>
                  <p className="text-xs text-gray-600 mb-2">{template.description}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="text-xs">
                      {indicatorLabels[template.indicator]} {conditionLabels[template.condition]} {value.toFixed(2)}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleApplyTemplate(template)}
                  >
                    订阅
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

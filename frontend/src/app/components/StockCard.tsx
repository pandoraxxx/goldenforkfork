import { formatGoldenCrossDate, isGoldenCrossBuySignal, type GoldenCrossPairKey } from '../utils/market';
import { formatMarketCap } from '../utils/format';
import { TrendingUp, TrendingDown, Star } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useNavigate } from 'react-router';
import { Stock } from '../api/client';
import { toast } from 'sonner';

interface StockCardProps {
  stock: Stock;
  goldenCrossPair?: GoldenCrossPairKey;
  isFavorite?: boolean;
  onToggleFavorite?: (code: string) => void;
}

export function StockCard({ stock, goldenCrossPair = '5-20', isFavorite = false, onToggleFavorite }: StockCardProps) {
  const navigate = useNavigate();
  const selectedPairEvent = stock.lastGoldenCrossByPair[goldenCrossPair];
  const hasBuySignal = isGoldenCrossBuySignal(selectedPairEvent);
  const isPositive = stock.change >= 0;

  const handleCardClick = () => {
    navigate(`/stock/${stock.code}`);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(stock.code);
  };

  return (
    <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={handleCardClick}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold truncate">{stock.code}</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleToggleFavorite}
              aria-label={isFavorite ? '取消收藏' : '添加收藏'}
            >
              <Star
                className={`h-4 w-4 ${isFavorite ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
              />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground truncate">{stock.nameCn}</p>
          <span className="text-xs text-muted-foreground/80">{stock.sector || '未分类'}</span>
        </div>
        <div className={`text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          <div className="flex items-center justify-end gap-1">
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span className="font-semibold">{isPositive ? '+' : ''}{stock.changePercent}%</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-2xl font-bold">HK${stock.price.toFixed(2)}</span>
          <span className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{stock.change.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t">
          <div>
            <div>成交量: {(stock.volume / 1000000).toFixed(2)}M</div>
            <div>市值: {formatMarketCap(stock.marketCap)}</div>
            <div className="flex items-center gap-2">
              <span>最近金叉: <span className="font-medium text-primary">{selectedPairEvent ? formatGoldenCrossDate(selectedPairEvent) : '暂无'}</span></span>
              {hasBuySignal ? <Badge className="bg-green-600 hover:bg-green-600">买入信号</Badge> : null}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

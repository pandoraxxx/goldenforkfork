import { Stock, formatGoldenCrossDate } from '../utils/mockData';
import { TrendingUp, TrendingDown, Star } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Link } from 'react-router';
import { isFavorite, addFavorite, removeFavorite } from '../utils/storage';
import { useState } from 'react';

interface StockCardProps {
  stock: Stock;
}

export function StockCard({ stock }: StockCardProps) {
  const [favorite, setFavorite] = useState(isFavorite(stock.code));
  
  const isPositive = stock.change >= 0;
  
  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (favorite) {
      removeFavorite(stock.code);
      setFavorite(false);
    } else {
      addFavorite(stock.code);
      setFavorite(true);
    }
  };
  
  return (
    <Link to={`/stock/${stock.code}`}>
      <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{stock.code}</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleToggleFavorite}
              >
                <Star 
                  className={`h-4 w-4 ${favorite ? 'fill-primary text-primary' : 'text-muted-foreground'}`} 
                />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground truncate">{stock.nameCn}</p>
            <span className="text-xs text-muted-foreground/80">{stock.sector}</span>
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
              <div>最近金叉: <span className="font-medium text-primary">{stock.lastGoldenCross ? formatGoldenCrossDate(stock.lastGoldenCross) : '暂无'}</span></div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

import { formatGoldenCrossDate, MA_PAIRS, type GoldenCrossPairKey } from '../utils/market';
import { TrendingUp, TrendingDown, Star } from 'lucide-react';
import { Link } from 'react-router';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { addFavorite, getFavorites, removeFavorite, Stock } from '../api/client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface StockTableProps {
  stocks: Stock[];
  goldenCrossPair?: GoldenCrossPairKey;
}

export function StockTable({ stocks, goldenCrossPair = '5-20' }: StockTableProps) {
  const pairLabel = MA_PAIRS.find(p => p.key === goldenCrossPair)?.label ?? 'MA5/20';
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const formatMarketCap = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '-';
    const trillion = 1_000_000_000_000;
    const billion = 1_000_000_000;
    const million = 1_000_000;
    if (value >= trillion) return `${(value / trillion).toFixed(2)}T`;
    if (value >= billion) return `${(value / billion).toFixed(2)}B`;
    return `${(value / million).toFixed(2)}M`;
  };

  useEffect(() => {
    let alive = true;
    getFavorites()
      .then((codes) => {
        if (alive) setFavorites(new Set(codes));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  
  const handleToggleFavorite = async (stockCode: string) => {
    const newFavorites = new Set(favorites);
    try {
      if (favorites.has(stockCode)) {
        await removeFavorite(stockCode);
        newFavorites.delete(stockCode);
      } else {
        await addFavorite(stockCode);
        newFavorites.add(stockCode);
      }
      setFavorites(newFavorites);
    } catch {
      toast.error('收藏操作失败，请稍后重试');
    }
  };
  
  return (
    <div className="rounded-md border overflow-hidden" data-testid="stock-table">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 shrink-0"></TableHead>
            <TableHead className="w-20">代码</TableHead>
            <TableHead className="w-32">名称</TableHead>
            <TableHead className="w-24 text-right tabular-nums">价格</TableHead>
            <TableHead className="w-20 text-right tabular-nums">涨跌</TableHead>
            <TableHead className="w-20 text-right tabular-nums">涨跌幅</TableHead>
            <TableHead className="w-24 text-right tabular-nums hidden md:table-cell">成交量</TableHead>
            <TableHead className="w-24 text-right tabular-nums hidden lg:table-cell">市值</TableHead>
            <TableHead className="w-28 text-right">最近金叉 ({pairLabel})</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stocks.map((stock) => {
            const isPositive = stock.change >= 0;
            const isFav = favorites.has(stock.code);
            
            return (
              <TableRow key={stock.id} className="cursor-pointer hover:bg-muted/50" data-testid={`stock-row-${stock.code}`}>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggleFavorite(stock.code);
                    }}
                  >
                    <Star 
                      className={`h-4 w-4 ${isFav ? 'fill-primary text-primary' : 'text-muted-foreground'}`} 
                    />
                  </Button>
                </TableCell>
                <TableCell>
                  <Link to={`/stock/${stock.code}`} className="font-medium hover:underline" data-testid={`stock-link-${stock.code}`}>
                    {stock.code}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link to={`/stock/${stock.code}`} className="hover:underline">
                    <div className="max-w-[120px] truncate">{stock.nameCn}</div>
                    <div className="text-xs text-muted-foreground/80">{stock.sector}</div>
                  </Link>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  <Link to={`/stock/${stock.code}`}>
                    HK${stock.price.toFixed(2)}
                  </Link>
                </TableCell>
                <TableCell className={`text-right tabular-nums ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  <Link to={`/stock/${stock.code}`} className="flex items-center justify-end gap-1">
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isPositive ? '+' : ''}{stock.change.toFixed(2)}
                  </Link>
                </TableCell>
                <TableCell className={`text-right font-semibold tabular-nums ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  <Link to={`/stock/${stock.code}`}>
                    {isPositive ? '+' : ''}{stock.changePercent}%
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums hidden md:table-cell">
                  <Link to={`/stock/${stock.code}`}>
                    {(stock.volume / 1000000).toFixed(2)}M
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums hidden lg:table-cell">
                  <Link to={`/stock/${stock.code}`}>
                    {formatMarketCap(stock.marketCap)}
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Link to={`/stock/${stock.code}`} className="font-medium text-primary">
                    {stock.lastGoldenCrossByPair[goldenCrossPair] ? formatGoldenCrossDate(stock.lastGoldenCrossByPair[goldenCrossPair]!) : '-'}
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

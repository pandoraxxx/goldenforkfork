import { formatGoldenCrossDate, isGoldenCrossBuySignal, getPairLabel, type GoldenCrossPairKey } from '../utils/market';
import { formatMarketCap } from '../utils/format';
import { TrendingUp, TrendingDown, Star } from 'lucide-react';
import { Link } from 'react-router';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Stock } from '../api/client';

interface StockTableProps {
  stocks: Stock[];
  goldenCrossPair?: GoldenCrossPairKey;
  favorites?: Set<string>;
  onToggleFavorite?: (code: string) => void;
}

export function StockTable({ stocks, goldenCrossPair = '5-20', favorites = new Set(), onToggleFavorite }: StockTableProps) {
  const pairLabel = getPairLabel(goldenCrossPair);
  
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
            const selectedPairEvent = stock.lastGoldenCrossByPair[goldenCrossPair];
            const hasBuySignal = isGoldenCrossBuySignal(selectedPairEvent);
            
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
                      onToggleFavorite?.(stock.code);
                    }}
                    aria-label={isFav ? '取消收藏' : '添加收藏'}
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
                    <div className="text-xs text-muted-foreground/80">{stock.sector || '未分类'}</div>
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
                <TableCell className="text-right align-middle">
                  <Link to={`/stock/${stock.code}`} className="inline-flex flex-col items-end justify-center gap-0.5 font-medium text-primary">
                    <span>{selectedPairEvent ? formatGoldenCrossDate(selectedPairEvent) : '-'}</span>
                    {hasBuySignal ? <Badge className="bg-green-600 hover:bg-green-600 text-[10px] px-1.5 py-0">买入</Badge> : null}
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

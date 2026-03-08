import { Stock, formatGoldenCrossDate } from '../utils/mockData';
import { TrendingUp, TrendingDown, Star } from 'lucide-react';
import { Link } from 'react-router';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { isFavorite, addFavorite, removeFavorite } from '../utils/storage';
import { useState } from 'react';

interface StockTableProps {
  stocks: Stock[];
}

export function StockTable({ stocks }: StockTableProps) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set(stocks.map(s => s.code).filter(isFavorite)));
  
  const handleToggleFavorite = (stockCode: string) => {
    const newFavorites = new Set(favorites);
    if (favorites.has(stockCode)) {
      removeFavorite(stockCode);
      newFavorites.delete(stockCode);
    } else {
      addFavorite(stockCode);
      newFavorites.add(stockCode);
    }
    setFavorites(newFavorites);
  };
  
  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>代码</TableHead>
            <TableHead>名称</TableHead>
            <TableHead className="text-right">价格</TableHead>
            <TableHead className="text-right">涨跌</TableHead>
            <TableHead className="text-right">涨跌幅</TableHead>
            <TableHead className="text-right hidden md:table-cell">成交量</TableHead>
            <TableHead className="text-right">最近金叉</TableHead>
            <TableHead className="text-right hidden lg:table-cell">市盈率</TableHead>
            <TableHead className="text-right hidden lg:table-cell">市净率</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stocks.map((stock) => {
            const isPositive = stock.change >= 0;
            const isFav = favorites.has(stock.code);
            
            return (
              <TableRow key={stock.id} className="cursor-pointer hover:bg-muted/50">
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
                  <Link to={`/stock/${stock.code}`} className="font-medium hover:underline">
                    {stock.code}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link to={`/stock/${stock.code}`} className="hover:underline">
                    <div className="max-w-[200px] truncate">{stock.nameCn}</div>
                    <div className="text-xs text-muted-foreground/80">{stock.sector}</div>
                  </Link>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  <Link to={`/stock/${stock.code}`}>
                    HK${stock.price.toFixed(2)}
                  </Link>
                </TableCell>
                <TableCell className={`text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  <Link to={`/stock/${stock.code}`} className="flex items-center justify-end gap-1">
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isPositive ? '+' : ''}{stock.change.toFixed(2)}
                  </Link>
                </TableCell>
                <TableCell className={`text-right font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  <Link to={`/stock/${stock.code}`}>
                    {isPositive ? '+' : ''}{stock.changePercent}%
                  </Link>
                </TableCell>
                <TableCell className="text-right hidden md:table-cell">
                  <Link to={`/stock/${stock.code}`}>
                    {(stock.volume / 1000000).toFixed(2)}M
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Link to={`/stock/${stock.code}`} className="font-medium text-primary">
                    {stock.lastGoldenCross ? formatGoldenCrossDate(stock.lastGoldenCross) : '-'}
                  </Link>
                </TableCell>
                <TableCell className="text-right hidden lg:table-cell">
                  <Link to={`/stock/${stock.code}`}>
                    {stock.pe}
                  </Link>
                </TableCell>
                <TableCell className="text-right hidden lg:table-cell">
                  <Link to={`/stock/${stock.code}`}>
                    {stock.pb}
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

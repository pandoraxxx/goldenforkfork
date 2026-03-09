import { useEffect, useState } from 'react';
import { type GoldenCrossPairKey } from '../utils/market';
import { getFavorites, getGoldenCrossPairPreference, getStock, Stock } from '../api/client';
import { StockCard } from '../components/StockCard';
import { StockTable } from '../components/StockTable';
import { Button } from '../components/ui/button';
import { Star, Grid, List } from 'lucide-react';
import { Card } from '../components/ui/card';

export function Favorites() {
  const [favoriteStocks, setFavoriteStocks] = useState<Stock[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [goldenCrossPair, setGoldenCrossPair] = useState<GoldenCrossPairKey>('5-20');

  useEffect(() => {
    let alive = true;

    async function loadFavorites() {
      try {
        const codes = await getFavorites();
        const items = await Promise.all(codes.map((code) => getStock(code).catch(() => null)));
        if (alive) {
          setFavoriteStocks(items.filter((item): item is Stock => item !== null));
        }
      } catch {
        if (alive) setFavoriteStocks([]);
      }
    }

    async function loadPreference() {
      try {
        const pref = await getGoldenCrossPairPreference();
        if (alive) setGoldenCrossPair((pref.pairKey || '5-20') as GoldenCrossPairKey);
      } catch {
        if (alive) setGoldenCrossPair('5-20');
      }
    }

    loadFavorites();
    loadPreference();
    const interval = setInterval(loadFavorites, 3000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  if (favoriteStocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Card className="p-12 text-center max-w-md">
          <Star className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">暂无自选股</h3>
          <p className="text-muted-foreground mb-6">
            在股票列表中点击星标图标添加自选股
          </p>
          <Button onClick={() => window.location.href = '/'}>
            前往市场
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Star className="h-8 w-8 text-primary fill-primary" />
          <div>
            <h2 className="text-3xl font-bold">我的自选</h2>
            <p className="text-sm text-muted-foreground mt-1">共 {favoriteStocks.length} 只股票</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('table')}
          >
            <List className="h-5 w-5" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {favoriteStocks.map((stock) => (
            <StockCard key={stock.id} stock={stock} goldenCrossPair={goldenCrossPair} />
          ))}
        </div>
      ) : (
        <StockTable stocks={favoriteStocks} goldenCrossPair={goldenCrossPair} />
      )}
    </div>
  );
}

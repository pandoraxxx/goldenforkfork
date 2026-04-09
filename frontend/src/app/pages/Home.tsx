import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MA_PAIRS, type GoldenCrossPairKey } from '../utils/market';
import {
  getGoldenCrossPairPreference,
  getMarketStats,
  getMeta,
  getStocks,
  setGoldenCrossPairPreference,
  Stock,
} from '../api/client';
import { StockCard } from '../components/StockCard';
import { StockTable } from '../components/StockTable';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, Grid, List, TrendingUp, TrendingDown, AlertCircle, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card } from '../components/ui/card';

const STOCKS_PER_PAGE = 20;

export function Home() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [totalStocks, setTotalStocks] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'code' | 'change' | 'volume' | 'marketCap' | 'lastGoldenCross'>('volume');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');
  const [goldenCrossPair, setGoldenCrossPairState] = useState<GoldenCrossPairKey>('5-20');
  const [sectors, setSectors] = useState<string[]>([]);
  const [marketStats, setMarketStats] = useState({ rising: 0, falling: 0, unchanged: 0 });
  const [isGoldenCrossLoading, setIsGoldenCrossLoading] = useState(false);
  const [isGoldenCrossHydrating, setIsGoldenCrossHydrating] = useState(false);
  const loadingStartRef = useRef(0);
  const loadingDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MIN_LOADING_VISIBLE_MS = 350;
  const goldenCrossDateMillis = (stock: Stock, pairKey: GoldenCrossPairKey) => {
    const event = stock.lastGoldenCrossByPair?.[pairKey];
    if (!event?.date) return 0;
    const ts = new Date(event.date).getTime();
    return Number.isFinite(ts) ? ts : 0;
  };

  useEffect(() => {
    if (sortBy === 'lastGoldenCross') return;
    let alive = true;

    async function loadMeta() {
      try {
        const [meta, pref] = await Promise.all([
          getMeta(),
          getGoldenCrossPairPreference(),
        ]);
        if (!alive) return;
        setSectors(meta.sectors || []);
        if (MA_PAIRS.some((pair) => pair.key === pref.pairKey)) {
          setGoldenCrossPairState(pref.pairKey as GoldenCrossPairKey);
        }
      } catch {
        if (alive) setSectors([]);
      }
    }

    loadMeta();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const loadStats = async () => {
      try {
        const s = await getMarketStats();
        if (alive) {
          setMarketStats({ rising: s.rising, falling: s.falling, unchanged: s.unchanged });
        }
      } catch {
        // ignore
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 60_000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const beginGoldenCrossLoading = () => {
      if (loadingDelayTimerRef.current) {
        clearTimeout(loadingDelayTimerRef.current);
        loadingDelayTimerRef.current = null;
      }
      loadingStartRef.current = Date.now();
      setIsGoldenCrossLoading(true);
    };
    const endGoldenCrossLoading = () => {
      const elapsed = Date.now() - loadingStartRef.current;
      const remaining = Math.max(0, MIN_LOADING_VISIBLE_MS - elapsed);
      if (loadingDelayTimerRef.current) clearTimeout(loadingDelayTimerRef.current);
      loadingDelayTimerRef.current = setTimeout(() => {
        if (alive) setIsGoldenCrossLoading(false);
      }, remaining);
    };
    const hasGoldenCrossPayload = (items: Stock[]) =>
      items.every((item) => typeof item.lastGoldenCrossByPair === 'object' && item.lastGoldenCrossByPair !== null);
    const hydrateGoldenCrossIfNeeded = async (initialItems: Stock[]) => {
      if (hasGoldenCrossPayload(initialItems)) return;
      setIsGoldenCrossHydrating(true);
      for (let attempt = 0; attempt < 8 && alive; attempt += 1) {
        await new Promise((resolve) => {
          setTimeout(resolve, 450);
        });
        try {
          const data = await getStocks({
            search: searchQuery,
            sector: sectorFilter,
            tab: activeTab as 'all' | 'popular' | 'gainers' | 'losers',
            sortBy,
            page: currentPage,
            pageSize: STOCKS_PER_PAGE,
          });
          if (!alive) return;
          setStocks(data.items);
          setTotalStocks(data.total);
          if (hasGoldenCrossPayload(data.items)) break;
        } catch {
          // keep retrying while alive
        }
      }
      if (alive) setIsGoldenCrossHydrating(false);
    };

    async function loadList() {
      if (sortBy === 'lastGoldenCross') beginGoldenCrossLoading();
      try {
        const data = await getStocks({
          search: searchQuery,
          sector: sectorFilter,
          tab: activeTab as 'all' | 'popular' | 'gainers' | 'losers',
          sortBy,
          pair: sortBy === 'lastGoldenCross' ? goldenCrossPair : undefined,
          page: currentPage,
          pageSize: STOCKS_PER_PAGE,
        });
        if (!alive) return;
        setStocks(data.items);
        setTotalStocks(data.total);
        hydrateGoldenCrossIfNeeded(data.items).catch(() => {});
      } catch {
        if (alive) {
          setStocks([]);
          setTotalStocks(0);
          setIsGoldenCrossHydrating(false);
        }
      } finally {
        if (alive && sortBy === 'lastGoldenCross') endGoldenCrossLoading();
      }
    }

    loadList();
    const interval = setInterval(loadList, 30_000);
    return () => {
      alive = false;
      if (loadingDelayTimerRef.current) {
        clearTimeout(loadingDelayTimerRef.current);
        loadingDelayTimerRef.current = null;
      }
      setIsGoldenCrossHydrating(false);
      clearInterval(interval);
    };
  }, [searchQuery, sectorFilter, sortBy, currentPage, activeTab, goldenCrossPair]);

  useEffect(() => {
    if (sortBy !== 'lastGoldenCross') return;
    let alive = true;
    const beginGoldenCrossLoading = () => {
      if (loadingDelayTimerRef.current) {
        clearTimeout(loadingDelayTimerRef.current);
        loadingDelayTimerRef.current = null;
      }
      loadingStartRef.current = Date.now();
      setIsGoldenCrossLoading(true);
    };
    const endGoldenCrossLoading = () => {
      const elapsed = Date.now() - loadingStartRef.current;
      const remaining = Math.max(0, MIN_LOADING_VISIBLE_MS - elapsed);
      if (loadingDelayTimerRef.current) clearTimeout(loadingDelayTimerRef.current);
      loadingDelayTimerRef.current = setTimeout(() => {
        if (alive) setIsGoldenCrossLoading(false);
      }, remaining);
    };
    const loadForPair = async () => {
      beginGoldenCrossLoading();
      try {
        const data = await getStocks({
          search: searchQuery,
          sector: sectorFilter,
          tab: activeTab as 'all' | 'popular' | 'gainers' | 'losers',
          sortBy,
          pair: goldenCrossPair,
          page: currentPage,
          pageSize: STOCKS_PER_PAGE,
        });
        if (!alive) return;
        setStocks(data.items);
        setTotalStocks(data.total);
      } catch {
        // keep current list on transient error
      } finally {
        if (alive) endGoldenCrossLoading();
      }
    };

    loadForPair();
    const catchUp = setTimeout(loadForPair, 1200);
    const interval = setInterval(loadForPair, 30_000);
    return () => {
      alive = false;
      if (loadingDelayTimerRef.current) {
        clearTimeout(loadingDelayTimerRef.current);
        loadingDelayTimerRef.current = null;
      }
      clearTimeout(catchUp);
      clearInterval(interval);
    };
  }, [goldenCrossPair, sortBy, searchQuery, sectorFilter, activeTab, currentPage]);

  const handleGoldenCrossPairChange = async (key: string) => {
    const nextKey = key as GoldenCrossPairKey;
    setGoldenCrossPairState(nextKey);
    if (sortBy === 'lastGoldenCross') {
      setStocks((prev) => {
        const next = [...prev];
        next.sort((a, b) => goldenCrossDateMillis(b, nextKey) - goldenCrossDateMillis(a, nextKey));
        return next;
      });
    }
    try {
      await setGoldenCrossPairPreference(key);
    } catch {
      // ignore
    }
  };

  const totalPages = Math.ceil(totalStocks / STOCKS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sectorFilter, sortBy, activeTab]);

  const stats = useMemo(() => marketStats, [marketStats]);

  type TabKey = 'all' | 'popular' | 'gainers' | 'losers';
  const renderTabPanel = (title: string, tabKey: TabKey) => {
    const TabIcon = tabKey === 'all' ? List : tabKey === 'popular' ? TrendingUp : tabKey === 'gainers' ? TrendingUp : TrendingDown;
    const iconClass = tabKey === 'all' ? 'text-muted-foreground' : tabKey === 'popular' ? 'text-primary' : tabKey === 'gainers' ? 'text-green-600' : 'text-red-600';
    return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              type="text"
              placeholder="搜索股票代码或名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
          </div>

          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="w-full md:w-[180px]" data-testid="sector-select-trigger">
              <SelectValue placeholder="选择板块" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部板块</SelectItem>
              {sectors.map((sector) => (
                <SelectItem key={sector} value={sector}>{sector}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sortBy}
            onValueChange={(value: 'code' | 'change' | 'volume' | 'marketCap' | 'lastGoldenCross') => setSortBy(value)}
          >
            <SelectTrigger className="w-full md:w-[180px]" data-testid="sort-select-trigger">
              <SelectValue placeholder="排序方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="code">按代码</SelectItem>
              <SelectItem value="change">按涨跌幅</SelectItem>
              <SelectItem value="volume">按成交量</SelectItem>
              <SelectItem value="marketCap">按市值</SelectItem>
              <SelectItem value="lastGoldenCross">按最近金叉</SelectItem>
            </SelectContent>
          </Select>

          <Select value={goldenCrossPair} onValueChange={handleGoldenCrossPairChange}>
            <SelectTrigger className="w-full md:w-[140px]" data-testid="pair-select-trigger">
              <SelectValue placeholder="金叉均线" />
            </SelectTrigger>
            <SelectContent>
              {MA_PAIRS.map((p) => (
                <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('table')}
              data-testid="view-table"
            >
              <List className="h-5 w-5" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
              data-testid="view-grid"
            >
              <Grid className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2" data-testid="tab-label">
            <TabIcon className={`h-5 w-5 shrink-0 ${iconClass}`} />
            <span className="text-[20px] font-semibold text-foreground">{title}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="total-count">
            <AlertCircle className="h-4 w-4" />
            <span>共找到 {totalStocks} 只股票</span>
          </div>
          {isGoldenCrossLoading && sortBy === 'lastGoldenCross' ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="golden-cross-loading">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>金叉数据加载中...</span>
            </div>
          ) : null}
          {isGoldenCrossHydrating && sortBy !== 'lastGoldenCross' ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="golden-cross-hydrating">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>金叉数据补拉中...</span>
            </div>
          ) : null}
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {stocks.map((stock) => (
            <StockCard key={stock.id} stock={stock} goldenCrossPair={goldenCrossPair} />
          ))}
        </div>
      ) : (
        <StockTable stocks={stocks} goldenCrossPair={goldenCrossPair} />
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            data-testid="pagination-prev"
          >
            上一页
          </Button>
          <div className="flex items-center gap-2 px-4">
            <span className="text-sm text-muted-foreground">
              第 {currentPage} / {totalPages} 页
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            data-testid="pagination-next"
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
  };

  return (
    <div className="space-y-6" data-testid="home-page">
      <div>
        <h2 className="text-3xl font-bold mb-4">港股市场</h2>
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4" data-testid="stat-rising">
            <div className="text-sm text-muted-foreground mb-1">上涨</div>
            <div className="text-2xl font-bold text-green-600">{stats.rising}</div>
          </Card>
          <Card className="p-4" data-testid="stat-falling">
            <div className="text-sm text-muted-foreground mb-1">下跌</div>
            <div className="text-2xl font-bold text-red-600">{stats.falling}</div>
          </Card>
          <Card className="p-4" data-testid="stat-unchanged">
            <div className="text-sm text-muted-foreground mb-1">平盘</div>
            <div className="text-2xl font-bold text-muted-foreground">{stats.unchanged}</div>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" data-testid="tab-all">全部股票</TabsTrigger>
          <TabsTrigger value="popular" data-testid="tab-popular">热门</TabsTrigger>
          <TabsTrigger value="gainers" data-testid="tab-gainers">涨幅榜</TabsTrigger>
          <TabsTrigger value="losers" data-testid="tab-losers">跌幅榜</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {renderTabPanel('全部股票', 'all')}
        </TabsContent>

        <TabsContent value="popular" className="space-y-4">
          {renderTabPanel('热门股票', 'popular')}
        </TabsContent>

        <TabsContent value="gainers" className="space-y-4">
          {renderTabPanel('涨幅榜', 'gainers')}
        </TabsContent>

        <TabsContent value="losers" className="space-y-4">
          {renderTabPanel('跌幅榜', 'losers')}
        </TabsContent>
      </Tabs>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MA_PAIRS, type GoldenCrossPairKey } from '../utils/market';
import {
  getGoldenCrossPairPreference,
  getMarketStats,
  getMeta,
  getStocks,
  setGoldenCrossPairPreference,
  Stock,
  NetworkError,
} from '../api/client';
import { StockCard } from '../components/StockCard';
import { StockTable } from '../components/StockTable';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, Grid, List, TrendingUp, TrendingDown, AlertCircle, Loader2, WifiOff } from 'lucide-react';
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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const loadingStartRef = useRef(0);
  const loadingDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stocksRequestRef = useRef<AbortController | null>(null);
  const stockListRef = useRef<HTMLDivElement>(null);
  const MIN_LOADING_VISIBLE_MS = 350;
  const PAIR_SWITCH_DEBOUNCE_MS = 180;
  const LOAD_RETRY_DELAY_MS = 3_000;
  const MAX_LOAD_RETRIES = 2;
  const isAbortError = (error: unknown) => error instanceof Error && error.name === 'AbortError';
  const isNetworkError = (error: unknown) => error instanceof NetworkError || (error instanceof TypeError && (error as TypeError).message === 'Failed to fetch');
  const isPairSwitchLocked = isGoldenCrossHydrating || isGoldenCrossLoading || stocks.length === 0;
  const lockListHeight = () => {
    if (stockListRef.current) {
      stockListRef.current.style.minHeight = `${stockListRef.current.offsetHeight}px`;
    }
  };
  useEffect(() => {
    if (stockListRef.current) stockListRef.current.style.minHeight = '';
  }, [stocks]);
  const goldenCrossDateMillis = (stock: Stock, pairKey: GoldenCrossPairKey) => {
    const event = stock.lastGoldenCrossByPair?.[pairKey];
    if (!event?.date) return 0;
    const ts = new Date(event.date).getTime();
    return Number.isFinite(ts) ? ts : 0;
  };

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
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
    if (sortBy === 'lastGoldenCross') return;
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
    const hasGoldenCrossPayload = (items: Stock[]) => items.every((item) => item.goldenCrossHydrated === true);
    const hydrateGoldenCrossIfNeeded = async (initialItems: Stock[]) => {
      if (hasGoldenCrossPayload(initialItems)) return;
      setIsGoldenCrossHydrating(true);
      let consecutiveNetworkErrors = 0;
      for (let attempt = 0; attempt < 8 && alive; attempt += 1) {
        const delay = consecutiveNetworkErrors > 0
          ? Math.min(1000 * 2 ** consecutiveNetworkErrors, 8000)
          : 450;
        await new Promise((resolve) => { setTimeout(resolve, delay); });
        let controller: AbortController | null = null;
        try {
          if (stocksRequestRef.current) stocksRequestRef.current.abort();
          controller = new AbortController();
          stocksRequestRef.current = controller;
          const data = await getStocks({
            search: searchQuery,
            sector: sectorFilter,
            tab: activeTab as 'all' | 'popular' | 'gainers' | 'losers',
            sortBy,
            page: currentPage,
            pageSize: STOCKS_PER_PAGE,
            signal: controller.signal,
            bypassCache: true,
          });
          if (!alive) return;
          consecutiveNetworkErrors = 0;
          setStocks(data.items);
          setTotalStocks(data.total);
          if (hasGoldenCrossPayload(data.items)) break;
        } catch (error) {
          if (isAbortError(error)) return;
          if (isNetworkError(error)) {
            consecutiveNetworkErrors += 1;
            if (consecutiveNetworkErrors >= 3) break;
          }
        } finally {
          if (controller && stocksRequestRef.current === controller) stocksRequestRef.current = null;
        }
      }
      if (alive) setIsGoldenCrossHydrating(false);
    };

    let loadRetryTimer: ReturnType<typeof setTimeout> | null = null;
    async function loadList(retryCount = 0) {
      if (sortBy === 'lastGoldenCross') beginGoldenCrossLoading();
      let controller: AbortController | null = null;
      try {
        if (stocksRequestRef.current) stocksRequestRef.current.abort();
        controller = new AbortController();
        stocksRequestRef.current = controller;
        const data = await getStocks({
          search: searchQuery,
          sector: sectorFilter,
          tab: activeTab as 'all' | 'popular' | 'gainers' | 'losers',
          sortBy,
          pair: sortBy === 'lastGoldenCross' ? goldenCrossPair : undefined,
          page: currentPage,
          pageSize: STOCKS_PER_PAGE,
          signal: controller.signal,
        });
        if (!alive) return;
        setStocks(data.items);
        setTotalStocks(data.total);
        hydrateGoldenCrossIfNeeded(data.items).catch(() => {});
      } catch (error) {
        if (isAbortError(error)) return;
        if (alive) {
          setIsGoldenCrossHydrating(false);
          if (retryCount < MAX_LOAD_RETRIES && isNetworkError(error)) {
            loadRetryTimer = setTimeout(() => { if (alive) loadList(retryCount + 1); }, LOAD_RETRY_DELAY_MS);
            return;
          }
        }
      } finally {
        if (controller && stocksRequestRef.current === controller) stocksRequestRef.current = null;
        if (alive && sortBy === 'lastGoldenCross') endGoldenCrossLoading();
      }
    }

    loadList();
    const interval = setInterval(loadList, 30_000);
    return () => {
      alive = false;
      if (loadRetryTimer) clearTimeout(loadRetryTimer);
      if (stocksRequestRef.current) {
        stocksRequestRef.current.abort();
        stocksRequestRef.current = null;
      }
      if (loadingDelayTimerRef.current) {
        clearTimeout(loadingDelayTimerRef.current);
        loadingDelayTimerRef.current = null;
      }
      setIsGoldenCrossHydrating(false);
      clearInterval(interval);
    };
  }, [searchQuery, sectorFilter, sortBy, currentPage, activeTab]);

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
    let pairRetryTimer: ReturnType<typeof setTimeout> | null = null;
    const loadForPair = async (retryCount = 0) => {
      beginGoldenCrossLoading();
      let controller: AbortController | null = null;
      try {
        if (stocksRequestRef.current) stocksRequestRef.current.abort();
        controller = new AbortController();
        stocksRequestRef.current = controller;
        const data = await getStocks({
          search: searchQuery,
          sector: sectorFilter,
          tab: activeTab as 'all' | 'popular' | 'gainers' | 'losers',
          sortBy,
          pair: goldenCrossPair,
          page: currentPage,
          pageSize: STOCKS_PER_PAGE,
          signal: controller.signal,
        });
        if (!alive) return;
        setStocks(data.items);
        setTotalStocks(data.total);
      } catch (error) {
        if (isAbortError(error)) return;
        if (alive && retryCount < MAX_LOAD_RETRIES && isNetworkError(error)) {
          pairRetryTimer = setTimeout(() => { if (alive) loadForPair(retryCount + 1); }, LOAD_RETRY_DELAY_MS);
          return;
        }
      } finally {
        if (controller && stocksRequestRef.current === controller) stocksRequestRef.current = null;
        if (alive) endGoldenCrossLoading();
      }
    };

    const debouncedFirstLoad = setTimeout(loadForPair, PAIR_SWITCH_DEBOUNCE_MS);
    const interval = setInterval(loadForPair, 30_000);
    return () => {
      alive = false;
      if (pairRetryTimer) clearTimeout(pairRetryTimer);
      if (stocksRequestRef.current) {
        stocksRequestRef.current.abort();
        stocksRequestRef.current = null;
      }
      if (loadingDelayTimerRef.current) {
        clearTimeout(loadingDelayTimerRef.current);
        loadingDelayTimerRef.current = null;
      }
      clearTimeout(debouncedFirstLoad);
      clearInterval(interval);
    };
  }, [goldenCrossPair, sortBy, searchQuery, sectorFilter, activeTab, currentPage]);

  const handleGoldenCrossPairChange = async (key: string) => {
    const nextKey = key as GoldenCrossPairKey;
    if (isPairSwitchLocked) {
      return;
    }
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

  const handleSortByChange = (value: 'code' | 'change' | 'volume' | 'marketCap' | 'lastGoldenCross') => {
    setSortBy(value);
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
            onValueChange={handleSortByChange}
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

          <Select value={goldenCrossPair} onValueChange={handleGoldenCrossPairChange} disabled={isPairSwitchLocked}>
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
          <div className="flex items-center gap-3 text-sm text-muted-foreground" data-testid="total-count">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              共找到 {totalStocks} 只股票
            </span>
            {isGoldenCrossLoading && sortBy === 'lastGoldenCross' ? (
              <span className="flex items-center gap-1.5" data-testid="golden-cross-loading">
                <Loader2 className="h-4 w-4 animate-spin" />
                金叉数据加载中...
              </span>
            ) : isGoldenCrossHydrating && sortBy !== 'lastGoldenCross' ? (
              <span className="flex items-center gap-1.5" data-testid="golden-cross-hydrating">
                <Loader2 className="h-4 w-4 animate-spin" />
                金叉数据补拉中...
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div ref={stockListRef}>
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {stocks.map((stock) => (
              <StockCard key={stock.id} stock={stock} goldenCrossPair={goldenCrossPair} />
            ))}
          </div>
        ) : (
          <StockTable stocks={stocks} goldenCrossPair={goldenCrossPair} />
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => { lockListHeight(); setCurrentPage((p) => Math.max(1, p - 1)); }}
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
            onClick={() => { lockListHeight(); setCurrentPage((p) => Math.min(totalPages, p + 1)); }}
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

      {isOffline && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-600/50 bg-yellow-950/30 px-4 py-2 text-sm text-yellow-500">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>网络连接已断开，数据可能不是最新的。恢复连接后将自动刷新。</span>
        </div>
      )}

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

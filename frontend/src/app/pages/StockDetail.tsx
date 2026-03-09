import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { MA_PAIRS } from '../utils/market';
import {
  addFavorite,
  getFavorites,
  getStock,
  getStockGoldenCross,
  getStockIndicators,
  getStockPriceHistory,
  removeFavorite,
  Stock,
  StockIndicator,
  PriceHistory,
  GoldenCrossEvent,
} from '../api/client';
import { SubscriptionForm } from '../components/SubscriptionForm';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Star, TrendingUp, TrendingDown, Bell } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ActiveSubscriptionsCard } from '../components/ActiveSubscriptionsCard';
import { toast } from 'sonner';

export function StockDetail() {
  const { code } = useParams<{ code: string }>();
  const [stock, setStock] = useState<Stock | null>(null);
  const [indicators, setIndicators] = useState<StockIndicator | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [goldenCrossEventsByPair, setGoldenCrossEventsByPair] = useState<Record<string, GoldenCrossEvent[]>>({});
  const [favorite, setFavorite] = useState(false);
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    setLoading(true);
    setNotFound(false);

    async function load() {
      try {
        const baseStock = await getStock(code);
        if (!alive) return;

        const [indicatorsResult, historyResult, favoritesResult, ...goldenListResults] = await Promise.allSettled([
          getStockIndicators(code),
          getStockPriceHistory(code, { days: 90 }),
          getFavorites(),
          ...MA_PAIRS.map((pair) => getStockGoldenCross(code, pair.key)),
        ]);

        if (!alive) return;

        const indicatorsData: StockIndicator =
          indicatorsResult.status === 'fulfilled'
            ? indicatorsResult.value
            : {
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

        const history = historyResult.status === 'fulfilled' ? historyResult.value : [];
        const favorites = favoritesResult.status === 'fulfilled' ? favoritesResult.value : [];

        const byPair: Record<string, GoldenCrossEvent[]> = {};
        MA_PAIRS.forEach((pair, idx) => {
          const r = goldenListResults[idx];
          byPair[pair.key] = r && r.status === 'fulfilled' ? r.value.events || [] : [];
        });

        setStock(baseStock);
        setIndicators(indicatorsData);
        setPriceHistory(history);
        setGoldenCrossEventsByPair(byPair);
        setFavorite(favorites.includes(code));
        setLoading(false);
      } catch {
        if (!alive) return;
        setNotFound(true);
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [code]);

  const xTickInterval = useMemo(() => {
    if (priceHistory.length <= 10) return 0;
    return Math.max(1, Math.ceil(priceHistory.length / 8) - 1);
  }, [priceHistory]);

  const yDomain = useMemo<[number, number]>(() => {
    if (priceHistory.length === 0) return [0, 1];
    const prices = priceHistory
      .map((p) => Number(p.close))
      .filter((v) => Number.isFinite(v));
    if (prices.length === 0) return [0, 1];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = Math.max(max - min, max * 0.01, 0.01);
    const pad = span * 0.12;
    return [Math.max(0, min - pad), max + pad];
  }, [priceHistory]);

  if (loading) {
    return (
      <div className="space-y-4" data-testid="stock-detail-loading">
        <div className="h-10 w-28 rounded-md bg-muted animate-pulse" />
        <Card className="p-6">
          <div className="space-y-4">
            <div className="h-8 w-56 rounded bg-muted animate-pulse" />
            <div className="h-6 w-36 rounded bg-muted animate-pulse" />
            <div className="h-12 w-48 rounded bg-muted animate-pulse" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="h-72 w-full rounded bg-muted animate-pulse" />
        </Card>
      </div>
    );
  }

  if (notFound || !stock || !indicators) {
    return (
      <div className="text-center py-20" data-testid="stock-not-found">
        <h2 className="text-2xl font-bold mb-4">股票不存在</h2>
        <Link to="/">
          <Button>返回首页</Button>
        </Link>
      </div>
    );
  }

  const isPositive = stock.change >= 0;

  const formatPriceTick = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 100) return value.toFixed(1);
    if (abs >= 10) return value.toFixed(2);
    if (abs >= 1) return value.toFixed(2);
    if (abs >= 0.1) return value.toFixed(3);
    return value.toFixed(4);
  };

  const formatValuationNumber = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '--';
    return value.toFixed(2);
  };

  const formatDividendYield = (value: number) => {
    if (!Number.isFinite(value) || value < 0) return '--';
    return `${value.toFixed(2)}%`;
  };

  const handleToggleFavorite = async () => {
    try {
      if (favorite) {
        await removeFavorite(stock.code);
        setFavorite(false);
      } else {
        await addFavorite(stock.code);
        setFavorite(true);
      }
    } catch {
      toast.error('收藏操作失败，请稍后重试');
    }
  };

  return (
    <div className="space-y-6" data-testid="stock-detail-page">
      <Link to="/">
        <Button variant="ghost" className="gap-2" data-testid="back-to-home">
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
      </Link>

      <Card className="p-6" data-testid="stock-summary-card">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold" data-testid="stock-name">{stock.nameCn}</h1>
              <Badge variant="outline">{stock.sector}</Badge>
            </div>
            <p className="text-muted-foreground mb-4">{stock.code}</p>

            <div className="flex items-baseline gap-4">
              <span className="text-4xl font-bold" data-testid="stock-price">HK${stock.price.toFixed(2)}</span>
              <div className={`flex items-center gap-2 text-xl ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                <span>{isPositive ? '+' : ''}{stock.change.toFixed(2)}</span>
                <span>({isPositive ? '+' : ''}{stock.changePercent}%)</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant={favorite ? 'default' : 'outline'}
              className="gap-2"
              onClick={handleToggleFavorite}
            >
              <Star className={`h-5 w-5 ${favorite ? 'fill-current' : ''}`} />
              {favorite ? '已自选' : '加自选'}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setShowSubscriptionForm(!showSubscriptionForm)}
            >
              <Bell className="h-5 w-5" />
              监控
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
          <div>
            <div className="text-sm text-muted-foreground">成交量</div>
            <div className="text-lg font-semibold">{(stock.volume / 1000000).toFixed(2)}M</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">市值</div>
            <div className="text-lg font-semibold">{(stock.marketCap / 1000000000).toFixed(2)}B</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">52周最高</div>
            <div className="text-lg font-semibold">HK${stock.high52w.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">52周最低</div>
            <div className="text-lg font-semibold">HK${stock.low52w.toFixed(2)}</div>
          </div>
        </div>
      </Card>

      {showSubscriptionForm && (
        <SubscriptionForm
          stock={stock}
          onSuccess={() => {
            setShowSubscriptionForm(false);
          }}
        />
      )}

      <ActiveSubscriptionsCard stockCode={stock.code} />

      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chart" data-testid="detail-tab-chart">价格走势</TabsTrigger>
          <TabsTrigger value="indicators" data-testid="detail-tab-indicators">技术指标</TabsTrigger>
          <TabsTrigger value="fundamentals" data-testid="detail-tab-fundamentals">基本面</TabsTrigger>
        </TabsList>

        <TabsContent value="chart">
          <Card className="p-6" data-testid="chart-card">
            <h3 className="text-lg font-semibold mb-4">90日价格走势</h3>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={priceHistory}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  interval={xTickInterval}
                  minTickGap={24}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                />
                <YAxis domain={yDomain} tickCount={6} tickFormatter={(value: number) => formatPriceTick(value)} />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                  formatter={(value: number) => [`HK$${value.toFixed(2)}`, '收盘价']}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="#D4AF37"
                  fillOpacity={1}
                  fill="url(#colorPrice)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="indicators">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6" data-testid="indicators-card">
              <h3 className="text-lg font-semibold mb-4">技术指标</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">RSI (相对强弱指标)</span>
                  <span className="font-semibold">{indicators.rsi.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">MACD DIF</span>
                  <span className="font-semibold">{(indicators.macdDif ?? indicators.macd).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">MACD DEA</span>
                  <span className="font-semibold">{(indicators.macdDea ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">MACD Histogram</span>
                  <span className="font-semibold">{(indicators.macdHist ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">换手率</span>
                  <span className="font-semibold">{indicators.turnoverRate.toFixed(2)}%</span>
                </div>
              </div>
            </Card>

            <Card className="p-6" data-testid="moving-average-card">
              <h3 className="text-lg font-semibold mb-4">移动平均线</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">MA5 (5日均线)</span>
                  <span className="font-semibold">HK${indicators.ma5.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">MA10 (10日均线)</span>
                  <span className="font-semibold">HK${indicators.ma10.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">MA20 (20日均线)</span>
                  <span className="font-semibold">HK${indicators.ma20.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">MA50 (50日均线)</span>
                  <span className="font-semibold">HK${indicators.ma50.toFixed(2)}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6 md:col-span-2" data-testid="golden-cross-card">
              <h3 className="text-lg font-semibold mb-4">黄金交叉记录</h3>
              <Tabs defaultValue={MA_PAIRS[0].key} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  {MA_PAIRS.map((p) => (
                    <TabsTrigger key={p.key} value={p.key}>{p.label}</TabsTrigger>
                  ))}
                </TabsList>
                {MA_PAIRS.map((pair) => {
                  const events = goldenCrossEventsByPair[pair.key] ?? [];
                  return (
                    <TabsContent key={pair.key} value={pair.key} className="mt-4">
                      {events.length > 0 ? (
                        <div className="rounded-md border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-left p-3 font-medium">日期</th>
                                <th className="text-left p-3 font-medium">时间</th>
                                <th className="text-right p-3 font-medium">MA{pair.short}</th>
                                <th className="text-right p-3 font-medium">MA{pair.long}</th>
                                <th className="text-right p-3 font-medium">收盘价</th>
                              </tr>
                            </thead>
                            <tbody>
                              {events.map((event, i) => {
                                const [, m, d] = event.date.split('-');
                                const dateStr = `${parseInt(m, 10)}月${parseInt(d, 10)}日`;
                                return (
                                  <tr key={i} className="border-b last:border-0">
                                    <td className="p-3">{dateStr}</td>
                                    <td className="p-3">{event.time}</td>
                                    <td className="p-3 text-right font-medium text-primary">{event.shortMA}</td>
                                    <td className="p-3 text-right">{event.longMA}</td>
                                    <td className="p-3 text-right">HK${event.close.toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-muted-foreground py-4">近90日内暂无{pair.label}黄金交叉</p>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </Card>

            <Card className="p-6 md:col-span-2">
              <h3 className="text-lg font-semibold mb-4">移动平均线对比</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={priceHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    interval={xTickInterval}
                    minTickGap={24}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                  />
                  <YAxis domain={yDomain} tickCount={6} tickFormatter={(value: number) => formatPriceTick(value)} />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                    formatter={(value: number) => `HK$${value.toFixed(2)}`}
                  />
                  <Line type="monotone" dataKey="close" stroke="#D4AF37" name="收盘价" strokeWidth={2} />
                  <Line type="monotone" dataKey="high" stroke="#10b981" name="最高价" strokeWidth={1} strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="low" stroke="#ef4444" name="最低价" strokeWidth={1} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fundamentals">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">估值指标</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">市盈率 (PE, TTM)</span>
                  <span className="font-semibold">{formatValuationNumber(stock.pe)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">市净率 (PB)</span>
                  <span className="font-semibold">{formatValuationNumber(stock.pb)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">股息率</span>
                  <span className="font-semibold">{formatDividendYield(stock.dividendYield)}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">市场数据</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">总市值</span>
                  <span className="font-semibold">HK${(stock.marketCap / 1000000000).toFixed(2)}B</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">今日成交量</span>
                  <span className="font-semibold">{(stock.volume / 1000000).toFixed(2)}M</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">52周波动</span>
                  <span className="font-semibold">
                    HK${stock.low52w.toFixed(2)} - HK${stock.high52w.toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

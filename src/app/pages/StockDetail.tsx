import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { generateStocks, generateIndicators, generatePriceHistory, detectGoldenCrossEvents } from '../utils/mockData';
import { SubscriptionForm } from '../components/SubscriptionForm';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Star, TrendingUp, TrendingDown, Bell, BellRing } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { isFavorite, addFavorite, removeFavorite, getSubscriptions } from '../utils/storage';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { ActiveSubscriptionsCard } from '../components/ActiveSubscriptionsCard';

export function StockDetail() {
  const { code } = useParams<{ code: string }>();
  const [stocks] = useState(() => generateStocks(3000));
  const [favorite, setFavorite] = useState(() => isFavorite(code || ''));
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  
  const stock = useMemo(() => {
    return stocks.find(s => s.code === code);
  }, [stocks, code]);
  
  const indicators = useMemo(() => {
    return stock ? generateIndicators(stock) : null;
  }, [stock]);
  
  const priceHistory = useMemo(() => {
    return stock ? generatePriceHistory(stock) : [];
  }, [stock]);

  const goldenCrossEvents = useMemo(() => {
    return detectGoldenCrossEvents(priceHistory);
  }, [priceHistory]);
  
  if (!stock || !indicators) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-4">股票不存在</h2>
        <Link to="/">
          <Button>返回首页</Button>
        </Link>
      </div>
    );
  }
  
  const isPositive = stock.change >= 0;
  
  const handleToggleFavorite = () => {
    if (favorite) {
      removeFavorite(stock.code);
      setFavorite(false);
    } else {
      addFavorite(stock.code);
      setFavorite(true);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <Link to="/">
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
      </Link>
      
      {/* 股票头部信息 */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{stock.nameCn}</h1>
              <Badge variant="outline">{stock.sector}</Badge>
            </div>
            <p className="text-muted-foreground mb-4">{stock.code}</p>
            
            <div className="flex items-baseline gap-4">
              <span className="text-4xl font-bold">HK${stock.price.toFixed(2)}</span>
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
              监��
            </Button>
          </div>
        </div>
        
        {/* 关键指标 */}
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
      
      {/* 订阅表单 */}
      {showSubscriptionForm && (
        <SubscriptionForm 
          stock={stock} 
          onSuccess={() => {
            setShowSubscriptionForm(false);
          }}
        />
      )}
      
      {/* 当前订阅状态 */}
      <ActiveSubscriptionsCard stockCode={stock.code} />
      
      {/* 图表和指标 */}
      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chart">价格走势</TabsTrigger>
          <TabsTrigger value="indicators">技术指标</TabsTrigger>
          <TabsTrigger value="fundamentals">基本面</TabsTrigger>
        </TabsList>
        
        <TabsContent value="chart">
          <Card className="p-6">
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
                  tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                />
                <YAxis domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                  formatter={(value: any) => [`HK$${value.toFixed(2)}`, '收盘价']}
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
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">技术指标</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">RSI (相对强弱指标)</span>
                  <span className="font-semibold">{indicators.rsi.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">MACD</span>
                  <span className="font-semibold">{indicators.macd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">换手率</span>
                  <span className="font-semibold">{indicators.turnoverRate.toFixed(2)}%</span>
                </div>
              </div>
            </Card>
            
            <Card className="p-6">
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
            
            <Card className="p-6 md:col-span-2">
              <h3 className="text-lg font-semibold mb-4">黄金交叉记录</h3>
              {goldenCrossEvents.length > 0 ? (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">日期</th>
                        <th className="text-left p-3 font-medium">时间</th>
                        <th className="text-right p-3 font-medium">MA5</th>
                        <th className="text-right p-3 font-medium">MA20</th>
                        <th className="text-right p-3 font-medium">收盘价</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goldenCrossEvents.map((event, i) => {
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
                <p className="text-muted-foreground py-4">近90日内暂无黄金交叉</p>
              )}
            </Card>

            <Card className="p-6 md:col-span-2">
              <h3 className="text-lg font-semibold mb-4">移动平均线对比</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={priceHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                    formatter={(value: any) => `HK$${value.toFixed(2)}`}
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
                  <span className="text-muted-foreground">股息率</span>
                  <span className="font-semibold">{stock.dividendYield}%</span>
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
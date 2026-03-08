import { useState, useMemo, useEffect } from 'react';
import { generateStocks, Stock, popularStocks } from '../utils/mockData';
import { StockCard } from '../components/StockCard';
import { StockTable } from '../components/StockTable';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, Grid, List, TrendingUp, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card } from '../components/ui/card';

const STOCKS_PER_PAGE = 20;

export function Home() {
  const [stocks] = useState<Stock[]>(() => generateStocks(3000));
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'code' | 'change' | 'volume' | 'marketCap' | 'lastGoldenCross'>('volume');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');
  
  // 获取所有板块
  const sectors = useMemo(() => {
    const sectorSet = new Set(stocks.map(s => s.sector));
    return Array.from(sectorSet).sort();
  }, [stocks]);
  
  // 热门股票
  const popularStocksList = useMemo(() => {
    return stocks.filter(s => popularStocks.includes(s.code));
  }, [stocks]);
  
  // 涨幅榜
  const topGainers = useMemo(() => {
    return [...stocks]
      .filter(s => s.change > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 10);
  }, [stocks]);
  
  // 跌幅榜
  const topLosers = useMemo(() => {
    return [...stocks]
      .filter(s => s.change < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 10);
  }, [stocks]);
  
  // 筛选和排序股票
  const filteredStocks = useMemo(() => {
    let result = stocks;
    
    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        s => s.code.includes(query) || 
             s.name.toLowerCase().includes(query) || 
             s.nameCn.includes(query)
      );
    }
    
    // 板块过滤
    if (sectorFilter !== 'all') {
      result = result.filter(s => s.sector === sectorFilter);
    }
    
    // 排序
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'change':
          return b.changePercent - a.changePercent;
        case 'volume':
          return b.volume - a.volume;
        case 'marketCap':
          return b.marketCap - a.marketCap;
        case 'lastGoldenCross': {
          // 有金叉的排前面，按金叉日期从近到远；无金叉的排最后
          const aDate = a.lastGoldenCross ? new Date(a.lastGoldenCross.date).getTime() : 0;
          const bDate = b.lastGoldenCross ? new Date(b.lastGoldenCross.date).getTime() : 0;
          return bDate - aDate;
        }
        default:
          return a.code.localeCompare(b.code);
      }
    });
    
    return result;
  }, [stocks, searchQuery, sectorFilter, sortBy]);
  
  // 分页
  const totalPages = Math.ceil(filteredStocks.length / STOCKS_PER_PAGE);
  const paginatedStocks = filteredStocks.slice(
    (currentPage - 1) * STOCKS_PER_PAGE,
    currentPage * STOCKS_PER_PAGE
  );
  
  // 切换标签时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sectorFilter, sortBy, activeTab]);
  
  // 统计数据
  const stats = useMemo(() => {
    const rising = stocks.filter(s => s.change > 0).length;
    const falling = stocks.filter(s => s.change < 0).length;
    const unchanged = stocks.length - rising - falling;
    
    return { rising, falling, unchanged };
  }, [stocks]);
  
  return (
    <div className="space-y-6">
      {/* 标题和统计 */}
      <div>
        <h2 className="text-3xl font-bold mb-4">港股市场</h2>
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">上涨</div>
            <div className="text-2xl font-bold text-green-600">{stats.rising}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">下跌</div>
            <div className="text-2xl font-bold text-red-600">{stats.falling}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">平盘</div>
            <div className="text-2xl font-bold text-muted-foreground">{stats.unchanged}</div>
          </Card>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">全部股票</TabsTrigger>
          <TabsTrigger value="popular">热门</TabsTrigger>
          <TabsTrigger value="gainers">涨幅榜</TabsTrigger>
          <TabsTrigger value="losers">跌幅榜</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4">
          {/* 搜索和筛选 */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                type="text"
                placeholder="搜索股票代码或名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="选择板块" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部板块</SelectItem>
                {sectors.map(sector => (
                  <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-full md:w-[180px]">
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
          
          {/* 结果统计 */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>共找到 {filteredStocks.length} 只股票</span>
          </div>
          
          {/* 股票列表 */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedStocks.map(stock => (
                <StockCard key={stock.id} stock={stock} />
              ))}
            </div>
          ) : (
            <StockTable stocks={paginatedStocks} />
          )}
          
          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
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
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                下一页
              </Button>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="popular" className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">热门股票</h3>
          </div>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {popularStocksList.map(stock => (
                <StockCard key={stock.id} stock={stock} />
              ))}
            </div>
          ) : (
            <StockTable stocks={popularStocksList} />
          )}
        </TabsContent>
        
        <TabsContent value="gainers" className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold">涨幅榜</h3>
          </div>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {topGainers.map(stock => (
                <StockCard key={stock.id} stock={stock} />
              ))}
            </div>
          ) : (
            <StockTable stocks={topGainers} />
          )}
        </TabsContent>
        
        <TabsContent value="losers" className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-red-600 rotate-180" />
            <h3 className="text-lg font-semibold">跌幅榜</h3>
          </div>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {topLosers.map(stock => (
                <StockCard key={stock.id} stock={stock} />
              ))}
            </div>
          ) : (
            <StockTable stocks={topLosers} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

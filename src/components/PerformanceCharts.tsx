import React, { useState, useMemo } from 'react';
import {
  BarChart2,
  TrendingUp,
  Activity,
  PieChart,
  Layers,
  ChevronRight,
  Info,
  Smile,
  Target,
  Dices,
  AlertTriangle,
  TrendingDown,
  Shield,
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { runMonteCarloSimulation, MonteCarloResult } from '../utils/monteCarlo';
import { Trade, DayPerformance, OverallMetrics, RiskSettings } from '../types';
import {
  formatCurrency,
  formatPercent,
  formatShortDate,
  formatDate,
  getStatsByAsset,
  getStatsByStrategy,
  getStatsByEmotion,
  getLocalDateStr,
} from '../utils/calculations';

interface PerformanceChartsProps {
  dailyData: DayPerformance[];
  trades: Trade[];
  metrics: OverallMetrics;
  settings?: RiskSettings;
  onSelectDay: (date: string) => void;
}

const RADAR_COLORS = ['#10b981', '#a855f7', '#3b82f6', '#f59e0b', '#06b6d4', '#f43f5e'];

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  dailyData,
  trades,
  metrics,
  settings,
  onSelectDay,
}) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'equity' | 'drawdown' | 'breakdown' | 'radar' | 'emotion' | 'montecarlo'>('daily');
  const [hoveredDay, setHoveredDay] = useState<DayPerformance | null>(null);
  const [selectedRadarStrategies, setSelectedRadarStrategies] = useState<string[]>([]);

  // States for Daily P&L Trade Candlestick chart
  const [dailyViewMode, setDailyViewMode] = useState<'candles' | 'bars'>('candles');
  const [selectedCandleDate, setSelectedCandleDate] = useState<string>('latest');
  const [hoveredCandle, setHoveredCandle] = useState<any | null>(null);

  const dailyProfitTarget = settings?.dailyProfitTarget ?? 500;
  const dailyLossLimit = settings?.dailyLossLimit ?? 300;

  // Available unique dates with trades sorted descending
  const availableDates = useMemo(() => {
    const datesSet = new Set<string>();
    trades.forEach((t) => {
      if (t.date) datesSet.add(t.date);
    });
    return Array.from(datesSet).sort((a, b) => b.localeCompare(a));
  }, [trades]);

  // Active date for Trade Candlestick view
  const activeCandleDate = useMemo(() => {
    if (selectedCandleDate === 'all') return 'all';
    if (selectedCandleDate !== 'latest' && availableDates.includes(selectedCandleDate)) {
      return selectedCandleDate;
    }
    if (availableDates.length > 0) return availableDates[0];
    return getLocalDateStr();
  }, [selectedCandleDate, availableDates]);

  // Filter and sort trades chronologically
  const candleTrades = useMemo(() => {
    let filtered = trades;
    if (activeCandleDate !== 'all') {
      filtered = trades.filter((t) => t.date === activeCandleDate);
    }
    return [...filtered].sort((a, b) => {
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      const dateTimeA = `${a.date || ''} ${timeA}`;
      const dateTimeB = `${b.date || ''} ${timeB}`;
      return dateTimeA.localeCompare(dateTimeB);
    });
  }, [trades, activeCandleDate]);

  // Determine the starting balance for the active view
  const startOfDayBalance = useMemo(() => {
    let bal = metrics.initialCapital || 0;
    if (activeCandleDate !== 'all') {
      const priorTrades = trades.filter((t) => t.date && t.date < activeCandleDate);
      bal += priorTrades.reduce((sum, t) => sum + t.pnl, 0);
    }
    return bal;
  }, [trades, metrics.initialCapital, activeCandleDate]);

  // Generate Trade Candlesticks (Open, Close, High, Low per trade)
  const tradeCandles = useMemo(() => {
    let runningBalance = startOfDayBalance;
    return candleTrades.map((t, idx) => {
      const open = runningBalance;
      const close = open + t.pnl;
      const high = Math.max(open, close);
      const low = Math.min(open, close);
      runningBalance = close;
      
      const sessionPnl = close - startOfDayBalance;

      return {
        index: idx + 1,
        trade: t,
        open,
        close,
        high,
        low,
        pnl: t.pnl,
        sessionPnl,
        isWin: t.pnl >= 0,
        time: t.time || '--:--',
        date: t.date,
        asset: t.asset || 'N/A',
        strategy: t.strategy || 'N/A',
        type: t.type || 'BUY',
      };
    });
  }, [candleTrades, startOfDayBalance]);

  // Dynamic scale limits for Trade Candlesticks
  const { candleMinVal, candleMaxVal } = useMemo(() => {
    if (tradeCandles.length === 0) {
      return { 
        candleMinVal: startOfDayBalance - dailyLossLimit * 1.1, 
        candleMaxVal: startOfDayBalance + dailyProfitTarget * 1.1 
      };
    }
    let min = startOfDayBalance;
    let max = startOfDayBalance;
    tradeCandles.forEach((c) => {
      if (c.close < min) min = c.close;
      if (c.close > max) max = c.close;
    });

    if (activeCandleDate !== 'all') {
      if (startOfDayBalance - dailyLossLimit < min) min = startOfDayBalance - dailyLossLimit;
      if (startOfDayBalance + dailyProfitTarget > max) max = startOfDayBalance + dailyProfitTarget;
    }

    const currentCap = metrics.currentCapital || startOfDayBalance;
    if (currentCap < min) min = currentCap;
    if (currentCap > max) max = currentCap;

    const absMaxRange = Math.max(Math.abs(max - startOfDayBalance), Math.abs(min - startOfDayBalance), 10);
    const padding = Math.max(10, absMaxRange * 0.15);
    return {
      candleMinVal: min - padding,
      candleMaxVal: max + padding,
    };
  }, [tradeCandles, dailyLossLimit, dailyProfitTarget, activeCandleDate, startOfDayBalance, metrics.currentCapital]);

  const candleChartHeight = 320;
  const candlePaddingX = 50;
  const candlePaddingY = 35;
  const candleRangeY = (candleMaxVal - candleMinVal) || 1;

  const getCandleY = (val: number) => {
    return (
      candleChartHeight -
      candlePaddingY -
      ((val - candleMinVal) / candleRangeY) * (candleChartHeight - candlePaddingY * 2)
    );
  };

  // Asset and Strategy stats
  const assetStats = getStatsByAsset(trades);
  const strategyStats = getStatsByStrategy(trades);
  const emotionStats = getStatsByEmotion(trades);

  // Prepare Strategy Radar Data
  const activeStrategies = strategyStats.filter((s) => s.tradesCount > 0);
  const displayedRadarStrategies =
    selectedRadarStrategies.length > 0
      ? activeStrategies.filter((s) => selectedRadarStrategies.includes(s.strategy))
      : activeStrategies.slice(0, 5);

  const maxPnl = Math.max(...activeStrategies.map((s) => s.pnl), 1);
  const maxAvgWin = Math.max(...activeStrategies.map((s) => s.avgWin), 1);

  const radarMetrics = [
    { key: 'winRate', label: 'Taxa de Acerto (%)' },
    { key: 'profitFactor', label: 'Fator de Lucro' },
    { key: 'payoff', label: 'Payoff (R:R)' },
    { key: 'pnl', label: 'Retorno (P&L)' },
    { key: 'avgWin', label: 'Média de Gain' },
  ];

  const radarChartData = radarMetrics.map((metric) => {
    const row: Record<string, any> = { subject: metric.label };
    displayedRadarStrategies.forEach((s) => {
      let val = 0;
      if (metric.key === 'winRate') {
        val = s.winRate;
      } else if (metric.key === 'profitFactor') {
        val = Math.min(100, Math.max(0, (s.profitFactor / 3) * 100));
      } else if (metric.key === 'payoff') {
        val = Math.min(100, Math.max(0, (s.payoff / 2.5) * 100));
      } else if (metric.key === 'pnl') {
        val = maxPnl > 0 ? Math.max(0, (s.pnl / maxPnl) * 100) : 0;
      } else if (metric.key === 'avgWin') {
        val = maxAvgWin > 0 ? Math.max(0, (s.avgWin / maxAvgWin) * 100) : 0;
      }
      row[s.strategy] = Math.round(val);
    });
    return row;
  });

  const toggleRadarStrategy = (stratName: string) => {
    if (selectedRadarStrategies.includes(stratName)) {
      if (selectedRadarStrategies.length > 1) {
        setSelectedRadarStrategies(selectedRadarStrategies.filter((s) => s !== stratName));
      }
    } else {
      setSelectedRadarStrategies([...selectedRadarStrategies, stratName]);
    }
  };

  // Helper for Daily Chart dimensions
  const chartHeight = 260;
  const paddingX = 40;
  const paddingY = 30;

  // Compute scale for Daily Chart
  const maxAbsDaily = dailyData.reduce(
    (max, d) => Math.max(max, Math.abs(d.pnl)),
    dailyProfitTarget
  );
  const maxVal = maxAbsDaily * 1.15; // 15% head room

  // Equity & Drawdown View mode state
  const [equityViewMode, setEquityViewMode] = useState<'trade' | 'daily'>('trade');
  const [hoveredEquityPoint, setHoveredEquityPoint] = useState<any | null>(null);
  const [hoveredDrawdownPoint, setHoveredDrawdownPoint] = useState<any | null>(null);

  // Calculate Equity Curve Points (starting from Initial Capital)
  const equityCurvePoints = useMemo(() => {
    const startCap = metrics.initialCapital || 0;
    const points: Array<{
      id: string;
      label: string;
      date: string;
      time?: string;
      equity: number;
      peak: number;
      ddPercent: number;
      pnl?: number;
      asset?: string;
    }> = [];

    // Base point: Initial Capital before trades
    points.push({
      id: 'start',
      label: 'Capital Inicial',
      date: 'Início',
      equity: startCap,
      peak: startCap,
      ddPercent: 0,
    });

    if (!trades || trades.length === 0) return points;

    if (equityViewMode === 'trade') {
      const sorted = [...trades].sort((a, b) => {
        const dtA = `${a.date || ''}T${a.time || '00:00'}`;
        const dtB = `${b.date || ''}T${b.time || '00:00'}`;
        return dtA.localeCompare(dtB);
      });

      let currentEq = startCap;
      let peakEq = startCap;

      sorted.forEach((t, idx) => {
        const val = Number(t.pnl) || 0;
        currentEq += val;
        if (currentEq > peakEq) peakEq = currentEq;

        const ddAmt = Math.max(0, peakEq - currentEq);
        const ddPct = peakEq > 0 ? (ddAmt / peakEq) * 100 : 0;

        points.push({
          id: t.id || `t-${idx}`,
          label: `#${idx + 1} (${t.time || t.date})`,
          date: t.date,
          time: t.time,
          equity: currentEq,
          peak: peakEq,
          ddPercent: ddPct,
          pnl: val,
          asset: t.asset,
        });
      });
    } else {
      let currentEq = startCap;
      let peakEq = startCap;

      dailyData.forEach((d) => {
        currentEq = d.equityAtEndOfDay;
        if (currentEq > peakEq) peakEq = currentEq;

        const ddAmt = Math.max(0, peakEq - currentEq);
        const ddPct = peakEq > 0 ? (ddAmt / peakEq) * 100 : 0;

        points.push({
          id: d.date,
          label: formatShortDate(d.date),
          date: d.date,
          equity: currentEq,
          peak: peakEq,
          ddPercent: ddPct,
          pnl: d.pnl,
        });
      });
    }

    return points;
  }, [trades, dailyData, metrics.initialCapital, equityViewMode]);

  // Equity Curve Y Range
  const { minEquity, maxEquity } = useMemo(() => {
    if (equityCurvePoints.length === 0) {
      return { minEquity: 0, maxEquity: 100 };
    }
    const values = equityCurvePoints.map((p) => p.equity);
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (min === max) {
      min = min - 100;
      max = max + 100;
    } else {
      const diff = max - min;
      min = min - diff * 0.12;
      max = max + diff * 0.12;
    }

    return { minEquity: min, maxEquity: max };
  }, [equityCurvePoints]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-black p-5 shadow-xl">
      {/* Background Image: Charging Bull Watermark (opacidade baixa para não poluir os candles) */}
      <div
        className="absolute inset-0 pointer-events-none bg-center bg-cover bg-no-repeat opacity-[0.12] transition-opacity duration-300"
        style={{ backgroundImage: 'url("/bull-bg.jpg")' }}
      />

      {/* Content wrapper above background layer */}
      <div className="relative z-10 space-y-4">
        {/* Header with Chart Selectors */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            Gráficos de Desempenho & Risco
          </h3>
          <p className="text-xs text-slate-400">
            Acompanhe o P&L diário, a evolução da curva de capital e métricas de drawdown
          </p>
        </div>

        {/* Tab Buttons (Horizontally scrollable on mobile) */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 rounded-xl bg-black/80 p-1 border border-slate-800 max-w-full">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 sm:py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition ${
              activeTab === 'daily'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            <span>P&L Diário</span>
          </button>

          <button
            onClick={() => setActiveTab('equity')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 sm:py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition ${
              activeTab === 'equity'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Curva de Capital</span>
          </button>

          <button
            onClick={() => setActiveTab('drawdown')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 sm:py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition ${
              activeTab === 'drawdown'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Drawdown</span>
          </button>

          <button
            onClick={() => setActiveTab('breakdown')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 sm:py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition ${
              activeTab === 'breakdown'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="h-3.5 w-3.5" />
            <span>Ativos & Setups</span>
          </button>

          <button
            onClick={() => {
              if (selectedRadarStrategies.length === 0 && activeStrategies.length > 0) {
                setSelectedRadarStrategies(activeStrategies.slice(0, 4).map((s) => s.strategy));
              }
              setActiveTab('radar');
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 sm:py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition ${
              activeTab === 'radar'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            <span>Radar Risco x Retorno</span>
          </button>

          <button
            onClick={() => setActiveTab('emotion')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 sm:py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition ${
              activeTab === 'emotion'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smile className="h-3.5 w-3.5" />
            <span>Emocional</span>
          </button>

          <button
            onClick={() => setActiveTab('montecarlo')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 sm:py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition ${
              activeTab === 'montecarlo'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Dices className="h-3.5 w-3.5" />
            <span>Monte Carlo</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="mt-4">
        {/* 1. DAILY P&L CHART / TRADE CANDLESTICKS */}
        {activeTab === 'daily' && (
          <div>
            {/* View Mode & Date Selection Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
              {/* Toggle Buttons */}
              <div className="flex items-center gap-1.5 bg-black/80 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setDailyViewMode('candles')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    dailyViewMode === 'candles'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Activity className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Candles por Operação (Corretora)</span>
                </button>
                <button
                  onClick={() => setDailyViewMode('bars')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    dailyViewMode === 'bars'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  <span>Resumo Diário</span>
                </button>
              </div>

              {/* Controls for Candles Mode */}
              {dailyViewMode === 'candles' && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Data:</span>
                  <select
                    value={selectedCandleDate}
                    onChange={(e) => setSelectedCandleDate(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-black px-3 py-1.5 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="latest">
                      {availableDates.length > 0
                        ? `Mais Recente (${formatShortDate(availableDates[0])})`
                        : 'Hoje'}
                    </option>
                    {availableDates.map((d) => (
                      <option key={d} value={d}>
                        {formatDate(d)}
                      </option>
                    ))}
                    <option value="all">Todos os Trades (Histórico)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Content depending on dailyViewMode */}
            {dailyViewMode === 'candles' ? (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 mb-2">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                      Vela Gain (+Lucro)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                      Vela Loss (-Prejuízo)
                    </span>

                  </div>
                  <span className="text-[11px] text-slate-500">
                    Cada candle mostra a abertura e o fechamento do saldo no trade
                  </span>
                </div>

                {tradeCandles.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-400 bg-black rounded-xl border border-slate-800">
                    <p className="font-semibold text-slate-300">Nenhuma operação encontrada para esta data.</p>
                    <p className="text-xs text-slate-500 mt-1">Selecione outra data ou registre trades para visualizar os candles de P&L.</p>
                  </div>
                ) : (
                  <div className="relative w-full overflow-x-auto">
                    <svg
                      className="w-full min-w-[650px]"
                      viewBox={`0 0 800 ${candleChartHeight}`}
                      preserveAspectRatio="none"
                    >


                      {/* Render Candlesticks per Trade */}
                      {tradeCandles.map((c, idx) => {
                        const totalCandles = tradeCandles.length;
                        const availableWidth = 800 - candlePaddingX - 60;
                        const stepX = availableWidth / totalCandles;
                        const candleWidth = Math.max(12, Math.min(42, stepX * 0.7));
                        const cx = candlePaddingX + idx * stepX + stepX / 2;
                        const xLeft = cx - candleWidth / 2;

                        const yOpen = getCandleY(c.open);
                        const yClose = getCandleY(c.close);

                        const topBody = Math.min(yOpen, yClose);
                        const bodyHeight = Math.max(4, Math.abs(yOpen - yClose));
                        
                        const isWin = c.isWin;
                        const color = isWin ? '#10b981' : '#f43f5e';
                        const isHovered = hoveredCandle?.index === c.index;

                        // Only show floating text above/below candle if hovered or very few candles (<= 5)
                        const showFloatingLabel = isHovered || totalCandles <= 5;

                        return (
                          <g
                            key={c.trade.id || idx}
                            className="cursor-pointer transition-all duration-150"
                            onMouseEnter={() => setHoveredCandle(c)}
                            onMouseLeave={() => setHoveredCandle(null)}
                            onTouchStart={() => setHoveredCandle(c)}
                          >
                            {/* Candle Body */}
                            <rect
                              x={xLeft}
                              y={topBody}
                              width={candleWidth}
                              height={bodyHeight}
                              rx={3}
                              fill={color}
                              fillOpacity={1}
                              stroke={isHovered ? '#ffffff' : color}
                              strokeWidth={isHovered ? 2 : 1}
                            />

                            {/* Trade Value label on candle only when hovered or very few candles to avoid overlap */}
                            {showFloatingLabel && (
                              <g>
                                <text
                                  x={cx}
                                  y={isWin ? topBody - 13 : topBody + bodyHeight + 13}
                                  textAnchor="middle"
                                  fontSize="9"
                                  fontWeight="bold"
                                  fill="#ffffff"
                                  stroke="#000000"
                                  strokeWidth="3"
                                  paintOrder="stroke"
                                  className="font-mono select-none"
                                >
                                  {formatCurrency(c.close)}
                                </text>
                                <text
                                  x={cx}
                                  y={isWin ? topBody - 4 : topBody + bodyHeight + 22}
                                  textAnchor="middle"
                                  fontSize="8"
                                  fontWeight="bold"
                                  fill={color}
                                  stroke="#000000"
                                  strokeWidth="3"
                                  paintOrder="stroke"
                                  className="font-mono select-none"
                                >
                                  ({c.pnl >= 0 ? '+' : ''}{formatCurrency(c.pnl)})
                                </text>
                              </g>
                            )}

                            {/* X Axis Trade Index & Time (Cleaner view when many candles) */}
                            <text
                              x={cx}
                              y={candleChartHeight - 6}
                              textAnchor="middle"
                              fontSize="9"
                              fontWeight={isHovered ? 'bold' : 'normal'}
                              fill={isHovered ? '#ffffff' : '#94a3b8'}
                              className="font-mono select-none"
                            >
                              {totalCandles <= 7 || isHovered
                                ? `#${c.index} (${c.time})`
                                : `#${c.index}`}
                            </text>
                          </g>
                        );
                      })}

                      {/* Guide Lines & Labels */}
                      {/* Zero axis line (Starting Balance) */}
                      <line
                        x1={candlePaddingX}
                        y1={getCandleY(startOfDayBalance)}
                        x2={800 - candlePaddingX}
                        y2={getCandleY(startOfDayBalance)}
                        stroke="#475569"
                        strokeWidth="1.5"
                      />
                    </svg>

                    {/* Hovered Candle Tooltip Detail Card */}
                    {hoveredCandle && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-black p-3 shadow-xl text-xs backdrop-blur-md">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Ordem:</span>
                            <strong className="text-white font-mono">#{hoveredCandle.index}</strong>
                            <span className="text-slate-500 font-mono">({hoveredCandle.time})</span>
                          </div>
                          <div className="h-4 w-px bg-slate-800" />
                          <div>
                            <span className="text-slate-400">Ativo: </span>
                            <strong className="text-emerald-400 font-mono">{hoveredCandle.asset}</strong>
                          </div>
                          <div className="h-4 w-px bg-slate-800" />
                          <div>
                            <span className="text-slate-400">Tipo: </span>
                            <span className={`font-semibold ${hoveredCandle.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {hoveredCandle.type === 'BUY' ? 'COMPRA (CALL)' : 'VENDA (PUT)'}
                            </span>
                          </div>
                          <div className="h-4 w-px bg-slate-800" />
                          <div>
                            <span className="text-slate-400">Resultado Trade: </span>
                            <strong
                              className={`font-mono font-bold ${
                                hoveredCandle.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {hoveredCandle.pnl >= 0 ? '+' : ''}
                              {formatCurrency(hoveredCandle.pnl)}
                            </strong>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="rounded-lg bg-black border border-slate-800 px-2.5 py-1.5 flex items-center gap-2">
                            <span className="text-slate-400">Saldo Anterior:</span>
                            <span className="font-mono text-slate-300">
                              {formatCurrency(hoveredCandle.open)}
                            </span>
                            <span className="text-slate-600 font-bold">|</span>
                            <span className="text-slate-400">Saldo Após:</span>
                            <strong
                              className={`font-mono ${
                                hoveredCandle.close >= hoveredCandle.open ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {formatCurrency(hoveredCandle.close)}
                            </strong>
                          </div>

                          {hoveredCandle.strategy && (
                            <span className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300">
                              Setup: <strong>{hoveredCandle.strategy}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* --- DAILY BARS MODE (Resumo Diário) --- */
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 mb-2">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                      Dia Positivo (Gain)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                      Dia Negativo (Loss)
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <span className="h-0.5 w-3 border-t border-dashed border-emerald-500" />
                      Meta (+{formatCurrency(dailyProfitTarget)})
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <span className="h-0.5 w-3 border-t border-dashed border-rose-500" />
                      Stop (-{formatCurrency(dailyLossLimit)})
                    </span>
                  </div>
                </div>

                {dailyData.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-400">
                    Nenhum dado diário registrado ainda.
                  </div>
                ) : (
                  <div className="relative w-full overflow-x-auto">
                    <svg
                      className="w-full min-w-[600px]"
                      viewBox={`0 0 800 ${chartHeight}`}
                      preserveAspectRatio="none"
                    >
                      {/* Zero axis */}
                      <line
                        x1={paddingX}
                        y1={chartHeight / 2}
                        x2={800 - paddingX}
                        y2={chartHeight / 2}
                        stroke="#475569"
                        strokeWidth="1.5"
                      />

                      {/* Daily Target guide line */}
                      {dailyProfitTarget <= maxVal && (
                        <line
                          x1={paddingX}
                          y1={chartHeight / 2 - (dailyProfitTarget / maxVal) * (chartHeight / 2 - paddingY)}
                          x2={800 - paddingX}
                          y2={chartHeight / 2 - (dailyProfitTarget / maxVal) * (chartHeight / 2 - paddingY)}
                          stroke="#10b981"
                          strokeDasharray="4 4"
                          strokeOpacity="0.4"
                          strokeWidth="1"
                        />
                      )}

                      {/* Daily Stop guide line */}
                      {dailyLossLimit <= maxVal && (
                        <line
                          x1={paddingX}
                          y1={chartHeight / 2 + (dailyLossLimit / maxVal) * (chartHeight / 2 - paddingY)}
                          x2={800 - paddingX}
                          y2={chartHeight / 2 + (dailyLossLimit / maxVal) * (chartHeight / 2 - paddingY)}
                          stroke="#f43f5e"
                          strokeDasharray="4 4"
                          strokeOpacity="0.4"
                          strokeWidth="1"
                        />
                      )}

                      {/* Render Daily Bars */}
                      {dailyData.map((day, idx) => {
                        const totalBars = dailyData.length;
                        const availableWidth = 800 - paddingX * 2;
                        const barSpacing = availableWidth / totalBars;
                        const barWidth = Math.max(10, Math.min(32, barSpacing * 0.7));
                        const x = paddingX + idx * barSpacing + (barSpacing - barWidth) / 2;

                        const isPositive = day.pnl >= 0;
                        const barH = (Math.abs(day.pnl) / maxVal) * (chartHeight / 2 - paddingY);
                        const y = isPositive ? chartHeight / 2 - barH : chartHeight / 2;

                        const isHovered = hoveredDay?.date === day.date;

                        return (
                          <g
                            key={day.date}
                            className="cursor-pointer transition-transform duration-200"
                            onMouseEnter={() => setHoveredDay(day)}
                            onMouseLeave={() => setHoveredDay(null)}
                            onTouchStart={() => setHoveredDay(day)}
                            onClick={() => onSelectDay(day.date)}
                          >
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={Math.max(3, barH)}
                              rx={3}
                              fill={isPositive ? '#10b981' : '#f43f5e'}
                              fillOpacity={isHovered ? 1 : 0.85}
                              stroke={isHovered ? '#ffffff' : 'none'}
                              strokeWidth={isHovered ? 1.5 : 0}
                            />
                            <text
                              x={x + barWidth / 2}
                              y={chartHeight - 6}
                              textAnchor="middle"
                              fontSize="10"
                              fill="#94a3b8"
                              className="font-mono select-none"
                            >
                              {formatShortDate(day.date)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    {hoveredDay && (
                      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-700 bg-black p-3 shadow-lg text-xs">
                        <div className="flex items-center gap-3">
                          <div>
                            <span className="text-slate-400">Data: </span>
                            <strong className="text-white font-mono">{formatDate(hoveredDay.date)}</strong>
                          </div>
                          <div className="h-4 w-px bg-slate-800" />
                          <div>
                            <span className="text-slate-400">Resultado: </span>
                            <strong
                              className={`font-mono font-bold ${
                                hoveredDay.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {hoveredDay.pnl >= 0 ? '+' : ''}
                              {formatCurrency(hoveredDay.pnl)}
                            </strong>
                          </div>
                          <div className="h-4 w-px bg-slate-800" />
                          <div>
                            <span className="text-slate-400">Operações: </span>
                            <strong className="text-slate-200">
                              {hoveredDay.tradesCount} ({hoveredDay.wins}W / {hoveredDay.losses}L)
                            </strong>
                          </div>
                        </div>

                        <button
                          onClick={() => onSelectDay(hoveredDay.date)}
                          className="flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-slate-200 hover:bg-slate-700"
                        >
                          Ver Trades <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. EQUITY CURVE (CURVA DE CAPITAL) */}
        {activeTab === 'equity' && (
          <div>
            {/* Toolbar for Equity View Mode */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 mb-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-1.5 bg-black/80 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setEquityViewMode('trade')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    equityViewMode === 'trade'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Por Operação (Trade a Trade)</span>
                </button>
                <button
                  onClick={() => setEquityViewMode('daily')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    equityViewMode === 'daily'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  <span>Por Dia</span>
                </button>
              </div>

              <div className="flex items-center gap-3 font-mono">
                <span className="text-slate-400">Capital Inicial: <strong>{formatCurrency(metrics.initialCapital)}</strong></span>
                <span className="text-slate-600">|</span>
                <span className="text-emerald-400 font-bold">Saldo Atual: {formatCurrency(metrics.currentCapital)}</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 bg-emerald-500 rounded" />
                  Evolução do Saldo (R$)
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="h-0.5 w-4 border-t border-dashed border-amber-400" />
                  Pico Histórico (High Watermark)
                </span>
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="h-0.5 w-4 border-t border-slate-600" />
                  Capital Inicial ({formatCurrency(metrics.initialCapital)})
                </span>
              </div>
            </div>

            {equityCurvePoints.length <= 1 ? (
              <div className="py-16 text-center text-sm text-slate-400 bg-black rounded-xl border border-slate-800">
                <p className="font-semibold text-slate-300">Nenhuma operação registrada para traçar a curva de capital.</p>
                <p className="text-xs text-slate-500 mt-1">Insira trades ou sincronize sua corretora para visualizar a evolução do capital.</p>
              </div>
            ) : (
              <div className="relative w-full">
                <svg
                  className="w-full"
                  viewBox={`0 0 800 ${chartHeight}`}
                  preserveAspectRatio="none"
                >
                  {/* Grid Lines */}
                  <line
                    x1={paddingX}
                    y1={paddingY}
                    x2={800 - paddingX}
                    y2={paddingY}
                    stroke="#334155"
                    strokeDasharray="2 2"
                    strokeOpacity="0.5"
                  />
                  <line
                    x1={paddingX}
                    y1={chartHeight - paddingY}
                    x2={800 - paddingX}
                    y2={chartHeight - paddingY}
                    stroke="#334155"
                    strokeDasharray="2 2"
                    strokeOpacity="0.5"
                  />

                  {/* Initial capital line */}
                  {(() => {
                    const yInit =
                      chartHeight -
                      paddingY -
                      ((metrics.initialCapital - minEquity) / (maxEquity - minEquity || 1)) *
                        (chartHeight - paddingY * 2);
                    return (
                      <g>
                        <line
                          x1={paddingX}
                          y1={yInit}
                          x2={800 - paddingX}
                          y2={yInit}
                          stroke="#64748b"
                          strokeDasharray="4 4"
                          strokeWidth="1.2"
                        />
                        <text
                          x={paddingX + 4}
                          y={yInit - 4}
                          fill="#64748b"
                          fontSize="9"
                          fontFamily="monospace"
                        >
                          Base: {formatCurrency(metrics.initialCapital)}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Generate path for Equity Curve */}
                  {(() => {
                    const count = equityCurvePoints.length;
                    const stepX = (800 - paddingX * 2) / Math.max(1, count - 1);
                    const rangeY = maxEquity - minEquity || 1;

                    const coords = equityCurvePoints.map((p, i) => {
                      const x = paddingX + i * stepX;
                      const y =
                        chartHeight -
                        paddingY -
                        ((p.equity - minEquity) / rangeY) * (chartHeight - paddingY * 2);
                      return { x, y, ...p };
                    });

                    // Build area and line path
                    const pathD = coords
                      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
                      .join(' ');
                    const areaD = `${pathD} L ${coords[coords.length - 1].x} ${
                      chartHeight - paddingY
                    } L ${coords[0].x} ${chartHeight - paddingY} Z`;

                    return (
                      <>
                        <defs>
                          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <path d={areaD} fill="url(#equityGrad)" />
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {coords.map((c) => {
                          const isHovered = hoveredEquityPoint?.id === c.id;
                          return (
                            <circle
                              key={c.id}
                              cx={c.x}
                              cy={c.y}
                              r={isHovered ? 6 : 3.5}
                              fill={isHovered ? '#ffffff' : '#10b981'}
                              stroke="#0f172a"
                              strokeWidth={isHovered ? 2.5 : 1.5}
                              className="cursor-pointer transition-all"
                              onMouseEnter={() => setHoveredEquityPoint(c)}
                              onMouseLeave={() => setHoveredEquityPoint(null)}
                            />
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>

                {/* Hovered Equity Point Tooltip Card */}
                {hoveredEquityPoint && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-black p-3 shadow-xl text-xs backdrop-blur-md">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-slate-400">Ponto: </span>
                        <strong className="text-white font-mono">{hoveredEquityPoint.label}</strong>
                      </div>
                      <div className="h-4 w-px bg-slate-800" />
                      <div>
                        <span className="text-slate-400">Saldo no Momento: </span>
                        <strong className="text-emerald-400 font-mono font-bold">
                          {formatCurrency(hoveredEquityPoint.equity)}
                        </strong>
                      </div>
                      {hoveredEquityPoint.pnl !== undefined && (
                        <>
                          <div className="h-4 w-px bg-slate-800" />
                          <div>
                            <span className="text-slate-400">P&L: </span>
                            <strong
                              className={`font-mono font-bold ${
                                hoveredEquityPoint.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {hoveredEquityPoint.pnl >= 0 ? '+' : ''}
                              {formatCurrency(hoveredEquityPoint.pnl)}
                            </strong>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-slate-400 font-mono">
                      <span>Pico Histórico: <strong className="text-amber-400">{formatCurrency(hoveredEquityPoint.peak)}</strong></span>
                      <span className="text-slate-600">|</span>
                      <span>Drawdown: <strong className="text-rose-400">-{hoveredEquityPoint.ddPercent.toFixed(2)}%</strong></span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. DRAWDOWN CHART (UNDER-WATER CHART) */}
        {activeTab === 'drawdown' && (
          <div className="space-y-4">
            {/* Drawdown Summary Cards Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: Drawdown Máximo (%) */}
              <div className="rounded-xl border border-rose-600 bg-black p-3.5">
                <div className="flex items-center justify-between text-xs text-rose-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                    Drawdown Máximo (%)
                  </span>
                  <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-mono text-white shadow-sm">
                    Pico Histórico
                  </span>
                </div>
                <div className="mt-2 text-xl font-bold font-mono text-rose-400">
                  -{metrics.maxDrawdownPercent.toFixed(2)}%
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Maior queda percentual sofrida pela conta
                </p>
              </div>

              {/* Card 2: Drawdown Máximo (R$) */}
              <div className="rounded-xl border border-rose-600 bg-black p-3.5">
                <div className="flex items-center justify-between text-xs text-rose-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
                    Drawdown Máximo (R$)
                  </span>
                  <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-mono text-white shadow-sm">
                    Perda Máx.
                  </span>
                </div>
                <div className="mt-2 text-xl font-bold font-mono text-rose-400">
                  -{formatCurrency(metrics.maxDrawdownAmount)}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Maior valor financeiro acumulado em perda do topo
                </p>
              </div>

              {/* Card 3: Drawdown Atual (%) */}
              <div className="rounded-xl border border-slate-800 bg-black p-3.5 backdrop-blur-sm">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-emerald-400" />
                    Drawdown Atual (%)
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold ${
                      metrics.currentDrawdownPercent === 0
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-amber-600 text-white shadow-sm'
                    }`}
                  >
                    {metrics.currentDrawdownPercent === 0 ? 'No Topo (0%)' : 'Submerso'}
                  </span>
                </div>
                <div
                  className={`mt-2 text-xl font-bold font-mono ${
                    metrics.currentDrawdownPercent === 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {metrics.currentDrawdownPercent === 0
                    ? '0.00%'
                    : `-${metrics.currentDrawdownPercent.toFixed(2)}%`}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {metrics.currentDrawdownPercent === 0
                    ? 'Você está no pico histórico de saldo!'
                    : 'Rebaixamento atual da conta no momento'}
                </p>
              </div>

              {/* Card 4: Distância do Topo (R$) */}
              <div className="rounded-xl border border-slate-800 bg-black p-3.5 backdrop-blur-sm">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-blue-400" />
                    Recuperação de Capital
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Topo vs Atual</span>
                </div>
                {(() => {
                  const peakVal = Math.max(
                    metrics.initialCapital,
                    ...equityCurvePoints.map((p) => p.peak)
                  );
                  const dist = Math.max(0, peakVal - metrics.currentCapital);
                  return (
                    <>
                      <div
                        className={`mt-2 text-xl font-bold font-mono ${
                          dist === 0 ? 'text-emerald-400' : 'text-slate-200'
                        }`}
                      >
                        {dist === 0 ? '0,00 (Recorde)' : `-${formatCurrency(dist)}`}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {dist === 0
                          ? 'Sua conta está na melhor marca!'
                          : `Falta ${formatCurrency(dist)} para renovar topo histórico`}
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                  <span className="h-2.5 w-4 bg-rose-500/80 rounded-sm" />
                  Curva Submersa de Drawdown (%)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
                  <span className="h-0.5 w-4 border-t border-emerald-500" />
                  0% = Novo Topo Histórico
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Passe o mouse nos pontos para inspecionar cada rebaixamento
              </span>
            </div>

            {/* Underwater Chart SVG */}
            {equityCurvePoints.length <= 1 ? (
              <div className="py-16 text-center text-sm text-slate-400 bg-black rounded-xl border border-slate-800">
                <p className="font-semibold text-slate-300">Nenhum dado registrado para calcular drawdown.</p>
                <p className="text-xs text-slate-500 mt-1">Registre trades para acompanhar a curva de risco submerso.</p>
              </div>
            ) : (
              <div className="relative w-full overflow-x-auto">
                <svg
                  className="w-full min-w-[650px]"
                  viewBox={`0 0 800 ${chartHeight}`}
                  preserveAspectRatio="none"
                >
                  {/* Grid Lines */}
                  <line
                    x1={paddingX}
                    y1={paddingY}
                    x2={800 - paddingX}
                    y2={paddingY}
                    stroke="#10b981"
                    strokeWidth="1.5"
                  />
                  <text
                    x={paddingX}
                    y={paddingY - 8}
                    fill="#10b981"
                    fontSize="10"
                    fontFamily="monospace"
                    className="font-bold"
                  >
                    0% (Topo Histórico de Capital)
                  </text>

                  {/* Drawdown Area & Nodes */}
                  {(() => {
                    const count = equityCurvePoints.length;
                    const stepX = (800 - paddingX * 2) / Math.max(1, count - 1);
                    const maxDdVal = Math.max(10, metrics.maxDrawdownPercent * 1.3);

                    const coords = equityCurvePoints.map((p, i) => {
                      const x = paddingX + i * stepX;
                      const y = paddingY + (p.ddPercent / maxDdVal) * (chartHeight - paddingY * 2);
                      return { x, y, ...p };
                    });

                    const pathD = coords
                      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
                      .join(' ');
                    const areaD = `M ${coords[0].x} ${paddingY} ${pathD} L ${
                      coords[coords.length - 1].x
                    } ${paddingY} Z`;

                    return (
                      <>
                        <defs>
                          <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.05" />
                          </linearGradient>
                        </defs>
                        <path d={areaD} fill="url(#ddGrad)" />
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#f43f5e"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {coords.map((c) => {
                          const isHovered = hoveredDrawdownPoint?.id === c.id;
                          return (
                            <circle
                              key={c.id}
                              cx={c.x}
                              cy={c.y}
                              r={isHovered ? 6 : 3.5}
                              fill={isHovered ? '#ffffff' : '#f43f5e'}
                              stroke="#0f172a"
                              strokeWidth={isHovered ? 2.5 : 1.5}
                              className="cursor-pointer transition-all"
                              onMouseEnter={() => setHoveredDrawdownPoint(c)}
                              onMouseLeave={() => setHoveredDrawdownPoint(null)}
                            />
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>

                {/* Hovered Drawdown Tooltip Inspection Card */}
                {hoveredDrawdownPoint && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-900/50 bg-black p-3 shadow-xl text-xs backdrop-blur-md">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-slate-400">Ponto: </span>
                        <strong className="text-white font-mono">{hoveredDrawdownPoint.label}</strong>
                      </div>
                      <div className="h-4 w-px bg-slate-800" />
                      <div>
                        <span className="text-slate-400">Rebaixamento: </span>
                        <strong
                          className={`font-mono font-bold ${
                            hoveredDrawdownPoint.ddPercent === 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {hoveredDrawdownPoint.ddPercent === 0
                            ? '0.00% (No Topo)'
                            : `-${hoveredDrawdownPoint.ddPercent.toFixed(2)}%`}
                        </strong>
                      </div>
                      {hoveredDrawdownPoint.pnl !== undefined && (
                        <>
                          <div className="h-4 w-px bg-slate-800" />
                          <div>
                            <span className="text-slate-400">P&L no Ponto: </span>
                            <strong
                              className={`font-mono font-bold ${
                                hoveredDrawdownPoint.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {hoveredDrawdownPoint.pnl >= 0 ? '+' : ''}
                              {formatCurrency(hoveredDrawdownPoint.pnl)}
                            </strong>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-slate-400 font-mono">
                      <span>
                        Saldo no Ponto:{' '}
                        <strong className="text-slate-200">
                          {formatCurrency(hoveredDrawdownPoint.equity)}
                        </strong>
                      </span>
                      <span className="text-slate-600">|</span>
                      <span>
                        Pico de Referência:{' '}
                        <strong className="text-amber-400">
                          {formatCurrency(hoveredDrawdownPoint.peak)}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Educational Info Box */}
            <div className="rounded-xl border border-slate-800 bg-black p-4 text-xs text-slate-300">
              <h5 className="font-bold text-white flex items-center gap-2 mb-1.5">
                <Info className="h-4 w-4 text-blue-400" />
                Como interpretar o Gráfico Submerso de Drawdown (Underwater Chart)
              </h5>
              <p className="text-slate-400 leading-relaxed">
                O gráfico submerso visualiza o <strong className="text-rose-300">risco de rebaixamento de capital</strong> ao longo do tempo. Quando a linha toca a barra verde de <strong className="text-emerald-400">0%</strong>, significa que o seu capital atingiu um <strong className="text-emerald-400 font-semibold">novo pico histórico de saldo</strong>. Qualquer vale vermelho abaixo mostra o percentual que sua conta recuou em relação a esse maior topo alcançado antes de se recuperar.
              </p>
            </div>
          </div>
        )}

        {/* 4. ASSET & STRATEGY BREAKDOWN */}
        {activeTab === 'breakdown' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 pt-2">
            {/* By Asset */}
            <div className="rounded-xl border border-slate-800/80 bg-black p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
                <Layers className="h-4 w-4 text-emerald-400" />
                Performance por Ativo
              </h4>
              <div className="space-y-3">
                {assetStats.map((item) => {
                  const isPositive = item.pnl >= 0;
                  return (
                    <div key={item.asset} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white font-mono">{item.asset}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">
                            {item.tradesCount} {item.tradesCount === 1 ? 'trade' : 'trades'} (
                            <strong className="text-emerald-400">{item.winRate.toFixed(0)}% win</strong>)
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              isPositive ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isPositive ? '+' : ''}
                            {formatCurrency(item.pnl)}
                          </span>
                        </div>
                      </div>
                      {/* Bar */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(100, Math.max(10, item.winRate))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* By Strategy */}
            <div className="rounded-xl border border-slate-800/80 bg-black p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-purple-400" />
                Performance por Estratégia
              </h4>
              <div className="space-y-3">
                {strategyStats.map((item) => {
                  const isPositive = item.pnl >= 0;
                  return (
                    <div key={item.strategy} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">{item.strategy}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">
                            {item.tradesCount} trades (
                            <strong className="text-purple-400">{item.winRate.toFixed(0)}% win</strong>)
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              isPositive ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isPositive ? '+' : ''}
                            {formatCurrency(item.pnl)}
                          </span>
                        </div>
                      </div>
                      {/* Bar */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full ${isPositive ? 'bg-purple-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(100, Math.max(10, item.winRate))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 5. STRATEGY COMPARISON RADAR CHART */}
        {activeTab === 'radar' && (
          <div className="pt-2 space-y-4">
            <div className="rounded-xl border border-slate-800/80 bg-black p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Target className="h-4 w-4 text-amber-400" />
                    Painel Comparativo de Estratégias (Gráfico de Radar)
                  </h4>
                  <p className="text-xs text-slate-400">
                    Visualize comparativamente qual estratégia performa melhor em termos de risco-retorno (Win Rate, Payoff, Fator de Lucro e Retorno).
                  </p>
                </div>

                {/* Strategy Selector Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium">Comparar:</span>
                  {activeStrategies.map((s, idx) => {
                    const isSelected = displayedRadarStrategies.some((d) => d.strategy === s.strategy);
                    const color = RADAR_COLORS[idx % RADAR_COLORS.length];
                    return (
                      <button
                        key={s.strategy}
                        type="button"
                        onClick={() => toggleRadarStrategy(s.strategy)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                            : 'bg-black text-slate-500 border border-slate-900 hover:text-slate-300'
                        }`}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: isSelected ? color : '#64748b' }}
                        />
                        {s.strategy}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeStrategies.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-400">
                  Nenhuma estratégia registrada para comparação.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                  {/* Radar Chart Canvas */}
                  <div className="lg:col-span-2 h-[340px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarChartData}>
                        <PolarGrid stroke="#334155" strokeDasharray="3 3" />
                        <PolarAngleAxis
                          dataKey="subject"
                          tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 600 }}
                        />
                        <PolarRadiusAxis
                          angle={30}
                          domain={[0, 100]}
                          stroke="#475569"
                          tick={{ fill: '#64748b', fontSize: 9 }}
                        />
                        {displayedRadarStrategies.map((strat, idx) => {
                          const origIdx = activeStrategies.findIndex((s) => s.strategy === strat.strategy);
                          const color = RADAR_COLORS[(origIdx >= 0 ? origIdx : idx) % RADAR_COLORS.length];
                          return (
                            <Radar
                              key={strat.strategy}
                              name={strat.strategy}
                              dataKey={strat.strategy}
                              stroke={color}
                              fill={color}
                              fillOpacity={0.3}
                              strokeWidth={2}
                            />
                          );
                        })}
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: '#090d16',
                            borderColor: '#334155',
                            borderRadius: '12px',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                        />
                        <RechartsLegend
                          wrapperStyle={{ paddingTop: '12px', fontSize: '11px', color: '#cbd5e1' }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Summary Metric Cards for Selected Strategies */}
                  <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                    {displayedRadarStrategies.map((strat, idx) => {
                      const origIdx = activeStrategies.findIndex((s) => s.strategy === strat.strategy);
                      const color = RADAR_COLORS[(origIdx >= 0 ? origIdx : idx) % RADAR_COLORS.length];
                      return (
                        <div
                          key={strat.strategy}
                          className="rounded-xl border border-slate-800 bg-black p-3 space-y-1.5"
                          style={{ borderLeftColor: color, borderLeftWidth: '4px' }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs">{strat.strategy}</span>
                            <span
                              className={`font-mono font-bold text-xs ${
                                strat.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {strat.pnl >= 0 ? '+' : ''}
                              {formatCurrency(strat.pnl)}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                            <div>
                              <span>Win Rate:</span>
                              <div className="font-mono font-bold text-emerald-400">
                                {strat.winRate.toFixed(0)}%
                              </div>
                            </div>
                            <div>
                              <span>Profit Factor:</span>
                              <div className="font-mono font-bold text-purple-400">
                                {strat.profitFactor.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <span>Payoff:</span>
                              <div className="font-mono font-bold text-amber-400">
                                {strat.payoff.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. EMOTION BREAKDOWN */}
        {activeTab === 'emotion' && (
          <div className="pt-2">
            <div className="rounded-xl border border-slate-800/80 bg-black p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
                <Smile className="h-4 w-4 text-blue-400" />
                Performance por Estado Emocional
              </h4>
              <div className="space-y-3">
                {emotionStats.map((item) => {
                  const isPositive = item.pnl >= 0;
                  return (
                    <div key={item.emotion} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">{item.emotion}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">
                            {item.tradesCount} {item.tradesCount === 1 ? 'trade' : 'trades'} (
                            <strong className="text-blue-400">{item.winRate.toFixed(0)}% win</strong>)
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              isPositive ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isPositive ? '+' : ''}
                            {formatCurrency(item.pnl)}
                          </span>
                        </div>
                      </div>
                      {/* Bar */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full ${isPositive ? 'bg-blue-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(100, Math.max(10, item.winRate))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 7. MONTE CARLO SIMULATION */}
        {activeTab === 'montecarlo' && (
          <MonteCarloPanel metrics={metrics} trades={trades} />
        )}
      </div>
    </div>
  </div>
);
};

/* ============================================================
   Monte Carlo Simulation Panel
   ============================================================ */

interface MonteCarloPanelProps {
  metrics: OverallMetrics;
  trades: Trade[];
}

const MonteCarloPanel: React.FC<MonteCarloPanelProps> = ({ metrics, trades }) => {
  const [projectionDays, setProjectionDays] = useState<30 | 60 | 90>(90);
  const [numSimulations, setNumSimulations] = useState<number>(1000);

  const tradesPerDay = useMemo(() => {
    if (!trades || trades.length === 0) return 3;
    const daySet = new Set(trades.map(t => t.date));
    return Math.max(1, Math.round(trades.length / daySet.size));
  }, [trades]);

  const result = useMemo<MonteCarloResult | null>(() => {
    if (metrics.totalTrades < 5) return null;

    return runMonteCarloSimulation({
      winRate: metrics.winRate / 100,
      avgWin: metrics.avgWin,
      avgLoss: metrics.avgLoss,
      initialCapital: metrics.currentCapital > 0 ? metrics.currentCapital : metrics.initialCapital,
      tradesPerDay,
      numSimulations,
      projectionDays,
      ruinThreshold: 0.1,
    });
  }, [metrics, tradesPerDay, numSimulations, projectionDays]);

  if (metrics.totalTrades < 5) {
    return (
      <div className="pt-2">
        <div className="rounded-xl border border-slate-800/80 bg-black p-8 text-center">
          <Dices className="h-12 w-12 text-cyan-400/40 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            Registre pelo menos <strong className="text-cyan-300">5 trades</strong> para executar a simulação de Monte Carlo.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            A simulação utiliza sua taxa de acerto e payoff reais para projeções probabilísticas.
          </p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const riskColor = result.riskOfRuin < 0.05 ? 'text-emerald-400' : result.riskOfRuin < 0.2 ? 'text-amber-400' : 'text-rose-400';
  const riskBg = result.riskOfRuin < 0.05 ? 'bg-emerald-600 text-white shadow-sm' : result.riskOfRuin < 0.2 ? 'bg-amber-600 text-white shadow-sm' : 'bg-rose-600 text-white shadow-sm';
  const riskLabel = result.riskOfRuin < 0.05 ? 'SEGURO' : result.riskOfRuin < 0.2 ? 'ATENÇÃO' : 'CRÍTICO';

  const riskPercent = Math.min(100, result.riskOfRuin * 100);
  const expectancyPositive = result.expectancy > 0;

  // Custom tooltip for area chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0]?.payload;
    if (!data) return null;
    return (
      <div className="rounded-lg border border-slate-700 bg-black p-3 text-xs shadow-xl backdrop-blur">
        <p className="font-bold text-cyan-300 mb-1.5">Dia {data.day}</p>
        <div className="space-y-0.5">
          <p className="text-emerald-300">P90 (Otimista): <strong>{formatCurrency(data.p90)}</strong></p>
          <p className="text-emerald-400/80">P75: <strong>{formatCurrency(data.p75)}</strong></p>
          <p className="text-cyan-300 font-bold">P50 (Mediana): <strong>{formatCurrency(data.p50)}</strong></p>
          <p className="text-amber-400/80">P25: <strong>{formatCurrency(data.p25)}</strong></p>
          <p className="text-rose-400">P10 (Pessimista): <strong>{formatCurrency(data.p10)}</strong></p>
        </div>
      </div>
    );
  };

  return (
    <div className="pt-2 space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-black border border-slate-800 px-3 py-1.5">
          <span className="text-[11px] text-slate-400">Projeção:</span>
          {([30, 60, 90] as const).map(d => (
            <button
              key={d}
              onClick={() => setProjectionDays(d)}
              className={`rounded px-2 py-0.5 text-[11px] font-bold transition ${
                projectionDays === d
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-black border border-slate-800 px-3 py-1.5">
          <span className="text-[11px] text-slate-400">Simulações:</span>
          {[500, 1000, 2000].map(n => (
            <button
              key={n}
              onClick={() => setNumSimulations(n)}
              className={`rounded px-2 py-0.5 text-[11px] font-bold transition ${
                numSimulations === n
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Risk of Ruin Gauge + KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Risk of Ruin Card */}
        <div className={`rounded-xl border p-4 ${riskBg}`}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className={`h-4 w-4 ${riskColor}`} />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Risco de Ruína</span>
          </div>
          {/* Gauge */}
          <div className="relative flex items-center justify-center mb-3">
            <svg viewBox="0 0 120 70" className="w-32 h-20">
              {/* Background arc */}
              <path
                d="M 10 60 A 50 50 0 0 1 110 60"
                fill="none"
                stroke="#1e293b"
                strokeWidth="8"
                strokeLinecap="round"
              />
              {/* Colored arc */}
              <path
                d="M 10 60 A 50 50 0 0 1 110 60"
                fill="none"
                stroke={result.riskOfRuin < 0.05 ? '#10b981' : result.riskOfRuin < 0.2 ? '#f59e0b' : '#ef4444'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${riskPercent * 1.57} 157`}
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            </svg>
            <div className="absolute bottom-0 text-center">
              <p className={`text-2xl font-black font-mono ${riskColor}`}>
                {(result.riskOfRuin * 100).toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="text-center">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${riskBg} ${riskColor}`}>
              {riskLabel}
            </span>
            <p className="text-[10px] text-slate-500 mt-1">
              {result.ruinCount} de {result.totalSimulations} simulações quebraram
            </p>
          </div>
        </div>

        {/* Expectancy + Avg DD */}
        <div className="rounded-xl border border-slate-800/80 bg-black p-4 space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className={`h-3.5 w-3.5 ${expectancyPositive ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span className="text-[11px] text-slate-400 uppercase tracking-wider">Expectância / Trade</span>
            </div>
            <p className={`text-xl font-black font-mono ${expectancyPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {expectancyPositive ? '+' : ''}{formatCurrency(result.expectancy)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Valor médio esperado por operação
            </p>
          </div>
          <div className="border-t border-slate-800 pt-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[11px] text-slate-400 uppercase tracking-wider">Drawdown Médio Máx.</span>
            </div>
            <p className="text-xl font-black font-mono text-amber-400">
              {result.avgMaxDrawdown.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Projections 30/60/90 */}
        <div className="rounded-xl border border-slate-800/80 bg-black p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Projeção (Mediana)</span>
          </div>
          <div className="space-y-2">
            {[
              { label: '30 dias', value: result.projections.days30 },
              { label: '60 dias', value: result.projections.days60 },
              { label: '90 dias', value: result.projections.days90 },
            ].map(item => {
              const diff = item.value - (metrics.currentCapital > 0 ? metrics.currentCapital : metrics.initialCapital);
              const isUp = diff >= 0;
              return (
                <div key={item.label} className="flex items-center justify-between rounded-lg bg-black px-3 py-2">
                  <span className="text-xs text-slate-400">{item.label}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono text-slate-200">
                      {formatCurrency(item.value)}
                    </p>
                    <p className={`text-[10px] font-mono ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isUp ? '+' : ''}{formatCurrency(diff)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Area Chart - Capital Projection Bands */}
      <div className="rounded-xl border border-slate-800/80 bg-black p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-400" />
            Banda de Projeção de Capital ({numSimulations} simulações)
          </h4>
          <div className="flex flex-wrap items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400/60" />
              P75-P90
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              P50 (Mediana)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400/60" />
              P10-P25
            </span>
          </div>
        </div>

        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <AreaChart data={result.dailyPercentiles} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="mcGradientTop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="mcGradientMid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="mcGradientBottom" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="day"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(v: number) => `D${v}`}
                stroke="#334155"
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
                stroke="#334155"
                width={55}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              {/* P10-P90 band (widest) */}
              <Area type="monotone" dataKey="p90" stackId="band" stroke="none" fill="url(#mcGradientTop)" />
              <Area type="monotone" dataKey="p10" stackId="band2" stroke="none" fill="transparent" />
              {/* P25-P75 band */}
              <Area type="monotone" dataKey="p75" stroke="none" fill="url(#mcGradientMid)" fillOpacity={0.3} />
              <Area type="monotone" dataKey="p25" stroke="none" fill="url(#mcGradientBottom)" fillOpacity={0.2} />
              {/* Median line */}
              <Area type="monotone" dataKey="p50" stroke="#06b6d4" strokeWidth={2.5} fill="none" dot={false} />
              {/* P90 line */}
              <Area type="monotone" dataKey="p90" stroke="#10b981" strokeWidth={1} strokeDasharray="4 4" fill="none" dot={false} />
              {/* P10 line */}
              <Area type="monotone" dataKey="p10" stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" fill="none" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Final Capital Distribution */}
      <div className="rounded-xl border border-slate-800/80 bg-black p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
          <Dices className="h-4 w-4 text-cyan-400" />
          Distribuição de Capital Final ({projectionDays} dias)
        </h4>
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'P10 (Pior cenário)', value: result.finalCapitalPercentiles.p10, color: 'text-rose-400' },
            { label: 'P25', value: result.finalCapitalPercentiles.p25, color: 'text-amber-400' },
            { label: 'P50 (Mediana)', value: result.finalCapitalPercentiles.p50, color: 'text-cyan-300' },
            { label: 'P75', value: result.finalCapitalPercentiles.p75, color: 'text-emerald-400' },
            { label: 'P90 (Melhor cenário)', value: result.finalCapitalPercentiles.p90, color: 'text-emerald-300' },
          ].map(item => (
            <div key={item.label} className="rounded-lg bg-black p-2.5 text-center">
              <p className="text-[10px] text-slate-500 mb-0.5">{item.label}</p>
              <p className={`text-sm font-bold font-mono ${item.color}`}>
                {formatCurrency(item.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Methodology info */}
      <div className="rounded-lg bg-black/30 border border-slate-800/50 px-4 py-3">
        <div className="flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
          <div className="text-[10px] text-slate-500 space-y-0.5">
            <p>
              <strong className="text-slate-400">Metodologia:</strong> {numSimulations} simulações independentes, cada uma com {tradesPerDay} trades/dia durante {projectionDays} dias.
            </p>
            <p>
              Cada trade é sorteado aleatoriamente com probabilidade de acerto de <strong className="text-slate-400">{(metrics.winRate).toFixed(1)}%</strong>,
              ganho médio de <strong className="text-emerald-400">{formatCurrency(metrics.avgWin)}</strong> e
              perda média de <strong className="text-rose-400">{formatCurrency(metrics.avgLoss)}</strong>.
              Ruína = capital cair abaixo de 10% do capital atual.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

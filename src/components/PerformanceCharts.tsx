import React, { useState } from 'react';
import {
  BarChart2,
  TrendingUp,
  Activity,
  PieChart,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Trade, DayPerformance, OverallMetrics, RiskSettings } from '../types';
import {
  formatCurrency,
  formatPercent,
  formatShortDate,
  formatDate,
  getStatsByAsset,
  getStatsByStrategy,
} from '../utils/calculations';

interface PerformanceChartsProps {
  dailyData: DayPerformance[];
  trades: Trade[];
  metrics: OverallMetrics;
  settings?: RiskSettings;
  onSelectDay: (date: string) => void;
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  dailyData,
  trades,
  metrics,
  settings,
  onSelectDay,
}) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'equity' | 'drawdown' | 'breakdown'>('daily');
  const [hoveredDay, setHoveredDay] = useState<DayPerformance | null>(null);

  const dailyProfitTarget = settings?.dailyProfitTarget ?? 500;
  const dailyLossLimit = settings?.dailyLossLimit ?? 300;

  // Asset and Strategy stats
  const assetStats = getStatsByAsset(trades);
  const strategyStats = getStatsByStrategy(trades);

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

  // Equity points calculation
  let runningPeak = metrics.initialCapital;
  const equityPoints = dailyData.map((d) => {
    if (d.equityAtEndOfDay > runningPeak) {
      runningPeak = d.equityAtEndOfDay;
    }
    const ddAmount = runningPeak - d.equityAtEndOfDay;
    const ddPercent = runningPeak > 0 ? (ddAmount / runningPeak) * 100 : 0;
    return {
      date: d.date,
      equity: d.equityAtEndOfDay,
      peak: runningPeak,
      ddPercent,
    };
  });

  const minEquity = Math.min(
    metrics.initialCapital * 0.95,
    ...equityPoints.map((p) => p.equity)
  );
  const maxEquity = Math.max(
    metrics.initialCapital * 1.05,
    ...equityPoints.map((p) => p.equity)
  );

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-sm">
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
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 rounded-xl bg-slate-950/80 p-1 border border-slate-800 max-w-full">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 sm:py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition ${
              activeTab === 'daily'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
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
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
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
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
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
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="h-3.5 w-3.5" />
            <span>Ativos & Setups</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="mt-4">
        {/* 1. DAILY P&L CHART */}
        {activeTab === 'daily' && (
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
              <span className="text-[11px] text-slate-500">
                Toque ou passe o mouse para ver detalhes
              </span>
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
                        {/* Bar */}
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

                        {/* Date label */}
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

                {/* Hovered Day Tooltip Card */}
                {hoveredDay && (
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/90 p-3 shadow-lg text-xs">
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
                      <div className="h-4 w-px bg-slate-800" />
                      <div>
                        <span className="text-slate-400">Assertividade: </span>
                        <strong className="text-emerald-400 font-mono">
                          {hoveredDay.winRate.toFixed(1)}%
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {hoveredDay.dayOverDayGrowthPercent !== undefined && (
                        <div>
                          <span className="text-slate-400">Comparado ao dia anterior: </span>
                          <span
                            className={`font-bold font-mono ${
                              hoveredDay.dayOverDayGrowthPercent >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {formatPercent(hoveredDay.dayOverDayGrowthPercent, true)}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => onSelectDay(hoveredDay.date)}
                        className="flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-slate-200 hover:bg-slate-700"
                      >
                        Ver Trades <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. EQUITY CURVE (CURVA DE CAPITAL) */}
        {activeTab === 'equity' && (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <div className="flex items-center gap-4">
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
              <span className="font-mono text-emerald-400 font-bold">
                Saldo Atual: {formatCurrency(metrics.currentCapital)}
              </span>
            </div>

            {equityPoints.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-400">
                Nenhuma operação registrada para traçar a curva de capital.
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
                      <line
                        x1={paddingX}
                        y1={yInit}
                        x2={800 - paddingX}
                        y2={yInit}
                        stroke="#64748b"
                        strokeDasharray="4 4"
                        strokeWidth="1.2"
                      />
                    );
                  })()}

                  {/* Generate path for Equity Curve */}
                  {(() => {
                    const count = equityPoints.length;
                    const stepX = (800 - paddingX * 2) / Math.max(1, count - 1);
                    const rangeY = maxEquity - minEquity || 1;

                    const coords = equityPoints.map((p, i) => {
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
                        {coords.map((c) => (
                          <circle
                            key={c.date}
                            cx={c.x}
                            cy={c.y}
                            r="3.5"
                            fill="#10b981"
                            stroke="#0f172a"
                            strokeWidth="1.5"
                            className="hover:r-5 cursor-pointer"
                          />
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>
            )}
          </div>
        )}

        {/* 3. DRAWDOWN CHART (UNDER-WATER CHART) */}
        {activeTab === 'drawdown' && (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 bg-rose-500 rounded" />
                  Drawdown Submerso (% abaixo do pico)
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  Drawdown Máx: -{metrics.maxDrawdownPercent.toFixed(2)}% (-{formatCurrency(metrics.maxDrawdownAmount)})
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                0% = Novo Topo Histórico de Capital
              </span>
            </div>

            {equityPoints.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-400">
                Nenhum dado registrado para calcular drawdown.
              </div>
            ) : (
              <div className="relative w-full">
                <svg
                  className="w-full"
                  viewBox={`0 0 800 ${chartHeight}`}
                  preserveAspectRatio="none"
                >
                  {/* Zero line at top */}
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
                  >
                    0% (Pico / High Watermark)
                  </text>

                  {/* Drawdown Area */}
                  {(() => {
                    const count = equityPoints.length;
                    const stepX = (800 - paddingX * 2) / Math.max(1, count - 1);
                    const maxDdVal = Math.max(10, metrics.maxDrawdownPercent * 1.3);

                    const coords = equityPoints.map((p, i) => {
                      const x = paddingX + i * stepX;
                      const y = paddingY + (p.ddPercent / maxDdVal) * (chartHeight - paddingY * 2);
                      return { x, y, ddPercent: p.ddPercent, date: p.date };
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
                            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.1" />
                          </linearGradient>
                        </defs>
                        <path d={areaD} fill="url(#ddGrad)" />
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#f43f5e"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {coords.map((c) => (
                          <circle
                            key={c.date}
                            cx={c.x}
                            cy={c.y}
                            r="3"
                            fill="#f43f5e"
                            stroke="#0f172a"
                            strokeWidth="1.5"
                          />
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>
            )}
          </div>
        )}

        {/* 4. ASSET & STRATEGY BREAKDOWN */}
        {activeTab === 'breakdown' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 pt-2">
            {/* By Asset */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
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
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
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
      </div>
    </div>
  );
};

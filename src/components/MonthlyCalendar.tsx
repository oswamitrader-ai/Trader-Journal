import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  TrendingUp,
  XCircle,
  Eye,
  LayoutGrid,
  List,
} from 'lucide-react';
import { Trade } from '../types';
import { formatCurrency, formatShortDate, formatDate } from '../utils/calculations';

interface MonthlyCalendarProps {
  trades: Trade[];
  onSelectDay: (date: string) => void;
}

export const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({ trades, onSelectDay }) => {
  // Current calendar view month/year
  // Default to September 2026 (or latest trade month)
  const initialDate = useMemo(() => {
    if (trades.length > 0) {
      const sorted = [...trades].sort((a, b) => b.date.localeCompare(a.date));
      const [y, m] = sorted[0].date.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  }, [trades]);

  const [currentMonth, setCurrentMonth] = useState<Date>(initialDate);

  useEffect(() => {
    setCurrentMonth(initialDate);
  }, [initialDate]);

  const [selectedAsset, setSelectedAsset] = useState<string>('ALL');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('ALL');
  const [calendarMode, setCalendarMode] = useState<'grid' | 'list'>('grid');

  // Extract unique assets and strategies for filter dropdowns
  const availableAssets = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => {
      if (t.asset) set.add(t.asset);
    });
    return Array.from(set).sort();
  }, [trades]);

  const availableStrategies = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => {
      if (t.strategy) set.add(t.strategy);
    });
    return Array.from(set).sort();
  }, [trades]);

  // Filter trades based on selected asset and strategy
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (selectedAsset !== 'ALL' && t.asset !== selectedAsset) return false;
      if (selectedStrategy !== 'ALL' && t.strategy !== selectedStrategy) return false;
      return true;
    });
  }, [trades, selectedAsset, selectedStrategy]);

  // Month navigation
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  const goToToday = () => {
    setCurrentMonth(initialDate);
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-11
  const monthKey = `${year}-${(month + 1).toString().padStart(2, '0')}`;

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Group filtered trades by date for the calendar
  const dayStatsMap = useMemo(() => {
    const map = new Map<
      string,
      { pnl: number; tradesCount: number; wins: number; losses: number; trades: Trade[] }
    >();

    filteredTrades.forEach((t) => {
      const curr = map.get(t.date) || { pnl: 0, tradesCount: 0, wins: 0, losses: 0, trades: [] };
      curr.pnl += Number(t.pnl) || 0;
      curr.tradesCount++;
      if (t.pnl > 0.001) curr.wins++;
      else if (t.pnl < -0.001) curr.losses++;
      curr.trades.push(t);
      map.set(t.date, curr);
    });

    return map;
  }, [filteredTrades]);

  // Month summary for header
  const monthSummary = useMemo(() => {
    let totalPnl = 0;
    let totalTrades = 0;
    let wins = 0;
    let positiveDays = 0;
    let negativeDays = 0;

    dayStatsMap.forEach((data, date) => {
      if (date.startsWith(monthKey)) {
        totalPnl += data.pnl;
        totalTrades += data.tradesCount;
        wins += data.wins;
        if (data.pnl > 0.001) positiveDays++;
        else if (data.pnl < -0.001) negativeDays++;
      }
    });

    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    return { totalPnl, totalTrades, winRate, positiveDays, negativeDays };
  }, [dayStatsMap, monthKey]);

  // Days in month calculation
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 is Sunday
  // We will start week on Monday (Segunda-feira = 0)
  const mondayOffset = (firstDayOfWeek + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Calendar cells array
  const calendarCells = [];
  // Leading empty cells
  for (let i = 0; i < mondayOffset; i++) {
    calendarCells.push(null);
  }
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day
      .toString()
      .padStart(2, '0')}`;
    calendarCells.push({
      day,
      dateStr,
      data: dayStatsMap.get(dateStr) || null,
    });
  }

  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-sm">
      {/* Top Bar: Title & Filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Calendário Mensal de Negociações
            </h3>
            <p className="text-xs text-slate-400">
              Visualize seus dias de ganho e perda e filtre por ativo ou estratégia
            </p>
          </div>
        </div>

        {/* Filters: Ativo & Estratégia */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Asset filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300">
            <Filter className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] text-slate-400">Ativo:</span>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-white">Todos os Ativos</option>
              {availableAssets.map((asset) => (
                <option key={asset} value={asset} className="bg-slate-900 text-white">
                  {asset}
                </option>
              ))}
            </select>
          </div>

          {/* Strategy filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300">
            <span className="text-[11px] text-slate-400">Estratégia:</span>
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-white">Todas as Estratégias</option>
              {availableStrategies.map((strat) => (
                <option key={strat} value={strat} className="bg-slate-900 text-white">
                  {strat}
                </option>
              ))}
            </select>
          </div>

          {(selectedAsset !== 'ALL' || selectedStrategy !== 'ALL') && (
            <button
              onClick={() => {
                setSelectedAsset('ALL');
                setSelectedStrategy('ALL');
              }}
              className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Month Navigation & Month KPI Summary */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Month Selector Buttons & Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white transition"
              title="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[130px] text-center text-xs sm:text-sm font-bold text-white">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white transition"
              title="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={goToToday}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
          >
            Mês Atual
          </button>

          {/* View Mode Toggle: Grid vs List (Crucial for mobile smartphones) */}
          <div className="flex items-center rounded-lg bg-slate-950 p-0.5 border border-slate-800">
            <button
              onClick={() => setCalendarMode('grid')}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded ${
                calendarMode === 'grid'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Visualização em Grade"
            >
              <LayoutGrid className="h-3 w-3" />
              <span className="hidden xs:inline sm:inline">Grade</span>
            </button>
            <button
              onClick={() => setCalendarMode('list')}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded ${
                calendarMode === 'list'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Visualização em Lista (Ideal para celular)"
            >
              <List className="h-3 w-3" />
              <span className="hidden xs:inline sm:inline">Lista</span>
            </button>
          </div>
        </div>

        {/* Month KPI Badges */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-950/80 px-2.5 py-1 border border-slate-800">
            <span className="text-slate-400">Total no Mês:</span>
            <span
              className={`font-mono font-bold ${
                monthSummary.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {monthSummary.totalPnl >= 0 ? '+' : ''}
              {formatCurrency(monthSummary.totalPnl)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg bg-slate-950/80 px-2.5 py-1 border border-slate-800">
            <span className="text-slate-400">Assertividade:</span>
            <span className="font-mono font-bold text-emerald-400">
              {monthSummary.winRate.toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-950/80 px-2.5 py-1 border border-slate-800">
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <CheckCircle2 className="h-3 w-3" /> {monthSummary.positiveDays}
            </span>
            <span className="text-slate-600">/</span>
            <span className="flex items-center gap-1 text-rose-400 font-bold">
              <XCircle className="h-3 w-3" /> {monthSummary.negativeDays}
            </span>
          </div>
        </div>
      </div>

      {/* Mode 1: Calendar Grid View */}
      {calendarMode === 'grid' ? (
        <div className="mt-4">
          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
            {weekDays.map((wd, i) => (
              <div
                key={wd}
                className={`py-1 sm:py-1.5 rounded-lg ${
                  i >= 5 ? 'text-slate-500 bg-slate-950/30' : 'text-slate-300 bg-slate-950/60'
                }`}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Days Matrix */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarCells.map((cell, idx) => {
              if (!cell) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[58px] sm:min-h-[78px] rounded-xl border border-transparent bg-slate-950/20"
                  />
                );
              }

              const { day, dateStr, data } = cell;
              const hasTrades = !!data && data.tradesCount > 0;
              const isPositive = hasTrades && data.pnl > 0.001;
              const isNegative = hasTrades && data.pnl < -0.001;
              const isBreakeven = hasTrades && !isPositive && !isNegative;

              return (
                <div
                  key={dateStr}
                  onClick={() => hasTrades && onSelectDay(dateStr)}
                  className={`group relative flex min-h-[58px] sm:min-h-[82px] flex-col justify-between rounded-xl border p-1 sm:p-2 transition-all duration-200 ${
                    hasTrades
                      ? isPositive
                        ? 'border-emerald-500/40 bg-emerald-950/25 hover:bg-emerald-950/40 hover:border-emerald-400 cursor-pointer shadow-sm hover:shadow-emerald-900/30 active:scale-95'
                        : isNegative
                        ? 'border-rose-500/40 bg-rose-950/25 hover:bg-rose-950/40 hover:border-rose-400 cursor-pointer shadow-sm hover:shadow-rose-900/30 active:scale-95'
                        : 'border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 cursor-pointer active:scale-95'
                      : 'border-slate-800/60 bg-slate-950/40 opacity-50'
                  }`}
                >
                  {/* Day Number Header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] sm:text-xs font-bold font-mono ${
                        hasTrades
                          ? isPositive
                            ? 'text-emerald-300'
                            : isNegative
                            ? 'text-rose-300'
                            : 'text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      {day}
                    </span>
                    {hasTrades && (
                      <span className="rounded-full bg-slate-900/90 px-1 sm:px-1.5 py-0.2 text-[8px] sm:text-[9px] font-mono text-slate-300 border border-slate-700/50">
                        {data.tradesCount}
                      </span>
                    )}
                  </div>

                  {/* Day Result Content */}
                  {hasTrades ? (
                    <div className="mt-0.5 sm:mt-1">
                      <div
                        className={`text-[10px] sm:text-xs font-extrabold font-mono tracking-tight truncate ${
                          isPositive
                            ? 'text-emerald-400'
                            : isNegative
                            ? 'text-rose-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {formatCurrency(data.pnl)}
                      </div>
                      <div className="hidden sm:flex mt-0.5 items-center justify-between text-[10px] text-slate-400">
                        <span>
                          {data.wins}W - {data.losses}L
                        </span>
                        <span className="font-semibold text-emerald-400">
                          {data.tradesCount > 0
                            ? `${((data.wins / data.tradesCount) * 100).toFixed(0)}%`
                            : ''}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[9px] text-slate-600 self-center">-</div>
                  )}

                  {/* Hover indicator for trading days */}
                  {hasTrades && (
                    <div className="absolute inset-0 hidden sm:flex items-center justify-center rounded-xl bg-slate-950/80 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="flex items-center gap-1 text-[11px] font-bold text-white">
                        <Eye className="h-3 w-3 text-emerald-400" /> Ver Trades
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Mode 2: Calendar List View (Perfect for mobile smartphone screens) */
        <div className="mt-4 space-y-2">
          {calendarCells.filter(c => c && c.data && c.data.tradesCount > 0).length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
              Nenhuma operação registrada para este mês.
            </div>
          ) : (
            calendarCells
              .filter((c): c is NonNullable<typeof c> => !!c && !!c.data && c.data.tradesCount > 0)
              .map((cell) => {
                const { dateStr, data } = cell;
                const isPositive = data.pnl > 0.001;
                const isNegative = data.pnl < -0.001;
                const winRate = data.tradesCount > 0 ? (data.wins / data.tradesCount) * 100 : 0;

                return (
                  <div
                    key={dateStr}
                    onClick={() => onSelectDay(dateStr)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer active:scale-[0.99] ${
                      isPositive
                        ? 'border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/30'
                        : isNegative
                        ? 'border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/30'
                        : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-bold text-white">
                          {formatDate(dateStr)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {data.tradesCount} {data.tradesCount === 1 ? 'operação' : 'operações'} • {data.wins}W {data.losses}L
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div
                          className={`font-mono text-sm font-extrabold ${
                            isPositive
                              ? 'text-emerald-400'
                              : isNegative
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {formatCurrency(data.pnl)}
                        </div>
                        <div className="text-[10px] text-emerald-400 font-semibold font-mono">
                          {winRate.toFixed(0)}% assertividade
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}
    </div>
  );
};

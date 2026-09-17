import React from 'react';
import {
  CalendarRange,
  Trophy,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  BarChart,
  ChevronRight,
} from 'lucide-react';
import { WeeklyPerformance, RiskSettings } from '../types';
import { formatCurrency, formatPercent } from '../utils/calculations';

interface WeeklyPerformancePanelProps {
  weeklyData: WeeklyPerformance[];
  settings?: RiskSettings;
}

export const WeeklyPerformancePanel: React.FC<WeeklyPerformancePanelProps> = ({
  weeklyData,
  settings,
}) => {
  const dailyProfitTarget = settings?.dailyProfitTarget ?? 500;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Resumos Semanais de Performance
            </h3>
            <p className="text-xs text-slate-400">
              Controle o fechamento de cada semana, assertividade periódica e cumprimento de metas
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Total de <strong className="text-white">{weeklyData.length} semanas</strong> registradas
        </div>
      </div>

      {/* Grid of Weekly Cards */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {weeklyData.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-500">
            <p className="text-sm font-medium text-slate-400">Nenhum fechamento semanal registrado ainda.</p>
            <p className="text-xs text-slate-500 mt-1">Conforme você registrar suas operações diárias reais, os resumos semanais serão calculados e exibidos aqui.</p>
          </div>
        ) : (
          weeklyData.map((week) => {
          const isPositive = week.totalPnl >= 0;
          const isTargetHit = week.totalPnl >= dailyProfitTarget * 3;

          return (
            <div
              key={week.id}
              className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 transition-all duration-200 ${
                isPositive
                  ? 'border-emerald-500/30 bg-gradient-to-b from-slate-900/90 to-emerald-950/20 shadow-md shadow-emerald-950/20'
                  : 'border-rose-500/30 bg-gradient-to-b from-slate-900/90 to-rose-950/20 shadow-md shadow-rose-950/20'
              }`}
            >
              {/* Card Header: Week Label & Status Tag */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    {week.weekLabel}
                  </span>
                  {isTargetHit ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                      <Trophy className="h-3 w-3" /> Meta Superada
                    </span>
                  ) : isPositive ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                      <CheckCircle className="h-3 w-3" /> Positiva
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/20">
                      <AlertTriangle className="h-3 w-3" /> Negativa
                    </span>
                  )}
                </div>

                {/* Main P&L Value */}
                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Resultado Líquido</span>
                    <span
                      className={`text-2xl font-black font-mono tracking-tight ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {formatCurrency(week.totalPnl)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Assertividade</span>
                    <span className="text-lg font-bold font-mono text-white">
                      {week.winRate.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress bar for win rate */}
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${week.winRate}%` }}
                  />
                </div>
              </div>

              {/* Weekly Details Table */}
              <div className="mt-4 space-y-2 border-t border-slate-800/80 pt-3 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Operações Realizadas:</span>
                  <span className="font-semibold text-white">
                    {week.tradesCount} trades ({week.wins}W / {week.losses}L)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Dias Operados:</span>
                  <span>
                    <strong className="text-emerald-400">{week.positiveDays} dias verdes</strong> /{' '}
                    <strong className="text-rose-400">{week.negativeDays} vermelhos</strong>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Melhor Dia:</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    +{formatCurrency(week.bestDayPnl)}
                  </span>
                </div>

                {week.worstDayPnl < 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Pior Dia:</span>
                    <span className="font-mono font-semibold text-rose-400">
                      {formatCurrency(week.worstDayPnl)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        }))}
      </div>
    </div>
  );
};

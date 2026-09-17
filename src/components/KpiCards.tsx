import React, { useState } from 'react';
import {
  Wallet,
  Target,
  Percent,
  TrendingDown,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  ShieldAlert,
  CalendarDays,
  Info,
} from 'lucide-react';
import { OverallMetrics, RiskSettings, DayPerformance } from '../types';
import { formatCurrency, formatPercent } from '../utils/calculations';
import { ProfitFactorPayoffModal } from './ProfitFactorPayoffModal';

interface KpiCardsProps {
  metrics: OverallMetrics;
  settings?: RiskSettings;
  todayPerformance?: DayPerformance;
  dailyProfitTarget?: number;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  metrics,
  settings,
  todayPerformance,
  dailyProfitTarget,
}) => {
  const [showPfModal, setShowPfModal] = useState(false);
  const isPositiveNet = (metrics?.netProfit ?? 0) >= 0;
  const isWinRateGood = (metrics?.winRate ?? 0) >= 50;
  const isDayOverDayPositive = (metrics?.dayOverDayGrowthPercent ?? 0) >= 0;

  // Drawdown risk level tag
  const maxDdPercent = metrics?.maxDrawdownPercent ?? 0;
  const isDrawdownSafe = maxDdPercent < 6;
  const isDrawdownWarning = maxDdPercent >= 6 && maxDdPercent <= 12;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 sm:gap-4">
      {/* CARD 1: CAPITAL & LUCRO LÍQUIDO */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 sm:p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Capital Atual
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Wallet className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2.5">
          <div className="text-2xl font-black font-mono tracking-tight text-white">
            {formatCurrency(metrics.currentCapital)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            <span
              className={`flex items-center font-bold ${
                isPositiveNet ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPositiveNet ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {isPositiveNet ? '+' : ''}
              {formatCurrency(metrics.netProfit)} ({formatPercent(metrics.netProfitPercent, true)})
            </span>
          </div>
        </div>

        <div className="mt-3.5 border-t border-slate-800/80 pt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>Capital Inicial:</span>
          <span className="font-mono text-slate-200">{formatCurrency(metrics.initialCapital)}</span>
        </div>
      </div>

      {/* CARD 2: ASSERTIVIDADE (WIN RATE) */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Assertividade
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <Target className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2.5">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-black font-mono tracking-tight ${
                isWinRateGood ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {metrics.winRate.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400 font-medium">taxa de acerto</span>
          </div>

          {/* Visual Win/Loss bar */}
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, metrics.winRate)}%` }}
              title={`Gains: ${metrics.winCount}`}
            />
            <div
              className="bg-rose-500 transition-all duration-500"
              style={{
                width: `${
                  metrics.totalTrades > 0 ? (metrics.lossCount / metrics.totalTrades) * 100 : 0
                }%`,
              }}
              title={`Losses: ${metrics.lossCount}`}
            />
          </div>
        </div>

        <div className="mt-3 border-t border-slate-800/80 pt-2 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">
            <strong className="text-emerald-400">{metrics.winCount}W</strong> /{' '}
            <strong className="text-rose-400">{metrics.lossCount}L</strong> /{' '}
            <span className="text-slate-300">{metrics.breakevenCount}E</span>
          </span>
          {metrics.currentStreak.count > 0 && (
            <span className="flex items-center gap-1 font-bold text-amber-400">
              <Flame className="h-3 w-3 fill-amber-400" />
              {metrics.currentStreak.count}{metrics.currentStreak.type === 'WIN' ? 'W' : 'L'} seq.
            </span>
          )}
        </div>
      </div>

      {/* CARD 3: VARIAÇÃO DIÁRIA COMPARADA */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Variação Dia vs Dia Anterior
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <CalendarDays className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2.5">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-black font-mono tracking-tight ${
                isDayOverDayPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatPercent(metrics.dayOverDayGrowthPercent, true)}
            </span>
            <span className="text-[11px] text-slate-400">
              {isDayOverDayPositive ? 'evolução' : 'redução'}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-1 text-xs text-slate-300">
            <span className="text-slate-400">Último dia:</span>
            <span
              className={`font-mono font-semibold ${
                metrics.lastDayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatCurrency(metrics.lastDayPnl)}
            </span>
          </div>
        </div>

        <div className="mt-3.5 border-t border-slate-800/80 pt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>Dia anterior:</span>
          <span
            className={`font-mono ${
              metrics.prevDayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatCurrency(metrics.prevDayPnl)}
          </span>
        </div>
      </div>

      {/* CARD 4: DRAWDOWN ACUMULADO */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Drawdown Máximo
          </span>
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
              isDrawdownSafe
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : isDrawdownWarning
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
          >
            <TrendingDown className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2.5">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-black font-mono tracking-tight ${
                isDrawdownSafe
                  ? 'text-emerald-400'
                  : isDrawdownWarning
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              -{metrics.maxDrawdownPercent.toFixed(2)}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              (-{formatCurrency(metrics.maxDrawdownAmount)})
            </span>
          </div>

          <div className="mt-1 flex items-center gap-1.5 text-xs">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                isDrawdownSafe
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : isDrawdownWarning
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {isDrawdownSafe ? 'Risco Baixo' : isDrawdownWarning ? 'Risco Moderado' : 'Alerta Alto'}
            </span>
          </div>
        </div>

        <div className="mt-3 border-t border-slate-800/80 pt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>Drawdown Atual:</span>
          <span className="font-mono text-slate-200">
            {metrics.currentDrawdownPercent > 0.05
              ? `-${metrics.currentDrawdownPercent.toFixed(2)}%`
              : '0,00% (No Topo)'}
          </span>
        </div>
      </div>

      {/* CARD 5: FATOR DE LUCRO & PAYOFF (Clickable for Binary Options Guide & Reference Modal) */}
      <div
        id="card-profit-factor-payoff"
        role="button"
        tabIndex={0}
        onClick={() => setShowPfModal(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setShowPfModal(true);
          }
        }}
        className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg backdrop-blur-sm cursor-pointer transition-all duration-200 hover:border-purple-500/50 hover:bg-slate-900 hover:shadow-purple-950/20 hover:scale-[1.01] text-left"
        title="Clique para ver o guia detalhado e referências de Fator de Lucro e Payoff para Opções Binárias"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-purple-300 transition-colors">
            Fator de Lucro &amp; Payoff
          </span>
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline-flex text-[10px] font-medium text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 group-hover:bg-purple-500/25 transition">
              Guia OB
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:bg-purple-500/20 transition">
              <Scale className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="mt-2.5">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {metrics.profitFactor.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400">Profit Factor</span>
          </div>

          <div className="mt-1 text-xs text-slate-300">
            Payoff:{' '}
            <strong className="text-white font-mono">1 : {metrics.payoff.toFixed(2)}</strong>
          </div>
        </div>

        <div className="mt-3.5 border-t border-slate-800/80 pt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>Méd. Gain/Loss:</span>
          <span className="font-mono text-slate-200">
            {formatCurrency(metrics.avgWin)} / {formatCurrency(metrics.avgLoss)}
          </span>
        </div>

        {/* Click indicator note */}
        <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-purple-400/80 group-hover:text-purple-300 transition-colors pt-1 border-t border-purple-500/10">
          <Info className="w-3 h-3" />
          <span>Clique para ver referências de OB</span>
        </div>
      </div>

      {/* Modal with detailed explanations and Binary Options references */}
      <ProfitFactorPayoffModal
        isOpen={showPfModal}
        onClose={() => setShowPfModal(false)}
        metrics={metrics}
      />
    </div>
  );
};

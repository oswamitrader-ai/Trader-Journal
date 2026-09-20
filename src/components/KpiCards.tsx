import React, { useState, useEffect } from 'react';
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
  Bell,
  BellRing,
  BellOff,
  Trophy,
  AlertTriangle,
  Calculator,
} from 'lucide-react';
import { OverallMetrics, RiskSettings, DayPerformance } from '../types';
import { formatCurrency, formatPercent } from '../utils/calculations';
import { ProfitFactorPayoffModal } from './ProfitFactorPayoffModal';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  checkAndTrigger80PercentPush,
} from '../utils/browserNotifications';

interface KpiCardsProps {
  metrics: OverallMetrics;
  settings?: RiskSettings;
  todayPerformance?: DayPerformance;
  dailyPerformance?: DayPerformance[];
  dailyProfitTarget?: number;
  onOpenCapitalModal?: () => void;
  onOpenKellyCalculator?: () => void;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  metrics,
  settings,
  todayPerformance,
  dailyPerformance,
  dailyProfitTarget: propDailyProfitTarget,
  onOpenCapitalModal,
  onOpenKellyCalculator,
}) => {
  const [showPfModal, setShowPfModal] = useState(false);
  const [pushPermission, setPushPermission] = useState<string>(() => getNotificationPermission());

  const todayPnl = todayPerformance?.pnl ?? 0;
  const targetVal = settings?.dailyProfitTarget ?? propDailyProfitTarget ?? 500;
  const lossVal = settings?.dailyLossLimit ?? 300;

  // Auto trigger push notifications when threshold (80%) is reached
  useEffect(() => {
    if (pushPermission === 'granted') {
      checkAndTrigger80PercentPush(todayPnl, targetVal, lossVal);
    }
  }, [todayPnl, targetVal, lossVal, pushPermission]);

  const handleTogglePushPermission = async () => {
    const granted = await requestNotificationPermission();
    setPushPermission(granted ? 'granted' : 'denied');
    if (granted) {
      checkAndTrigger80PercentPush(todayPnl, targetVal, lossVal);
    }
  };

  const isPositiveNet = (metrics?.netProfit ?? 0) >= 0;
  const isWinRateGood = (metrics?.winRate ?? 0) >= 50;
  const isDayOverDayPositive = (metrics?.dayOverDayGrowthPercent ?? 0) >= 0;

  // Drawdown risk level tag
  const maxDdPercent = metrics?.maxDrawdownPercent ?? 0;
  const isDrawdownSafe = maxDdPercent < 6;
  const isDrawdownWarning = maxDdPercent >= 6 && maxDdPercent <= 12;

  // Calculations for Meta Diária Card (Target)
  const targetProgressPct = Math.min(100, Math.max(0, (todayPnl / (targetVal || 1)) * 100));
  const isNearTarget80 = todayPnl >= targetVal * 0.8 && todayPnl < targetVal;
  const isTargetAchieved = todayPnl >= targetVal;

  // Calculations for Limite de Perda Card (Stop)
  const currentLossAbs = Math.abs(Math.min(0, todayPnl));
  const lossProgressPct = Math.min(100, Math.max(0, (currentLossAbs / (lossVal || 1)) * 100));
  const isNearStop80 = todayPnl <= -lossVal * 0.8 && todayPnl > -lossVal;
  const isStopLossReached = todayPnl <= -lossVal;

  // Weekly Drawdown points calculation (for the current operating week / last 7 operating days)
  const weeklyDays = (dailyPerformance || []).slice(-7);
  let runningPeak = metrics.initialCapital;
  const weeklyDrawdownPoints = weeklyDays.map((d) => {
    if (d.equityAtEndOfDay > runningPeak) {
      runningPeak = d.equityAtEndOfDay;
    }
    const ddAmt = Math.max(0, runningPeak - d.equityAtEndOfDay);
    const ddPct = runningPeak > 0 ? (ddAmt / runningPeak) * 100 : 0;
    const parts = d.date.split('-');
    const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : d.date;
    return {
      date: d.date,
      label: dateLabel,
      pnl: d.pnl,
      ddPct: Number(ddPct.toFixed(2)),
      ddAmt,
    };
  });

  return (
    <div className="space-y-4">
      {/* SEÇÃO DE MONITORAMENTO DE META DIÁRIA & LIMITE DE PERDA COM ALERTAS DE 80% */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* CARD: META DIÁRIA DE GANHO */}
        <div className={`relative overflow-hidden rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all ${
          isTargetAchieved
            ? 'border-emerald-500/60 bg-emerald-950/40 ring-1 ring-emerald-500/30'
            : isNearTarget80
            ? 'border-amber-500/60 bg-amber-950/30 ring-1 ring-amber-500/30'
            : 'border-slate-800 bg-black/80'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Trophy className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Meta Diária de Ganho
                </span>
                <p className="text-[10px] text-slate-400">Meta configurada: {formatCurrency(targetVal)}</p>
              </div>
            </div>

            {/* Push Notification Button */}
            {isNotificationSupported() && (
              <button
                type="button"
                onClick={handleTogglePushPermission}
                title={
                  pushPermission === 'granted'
                    ? 'Notificações Push ativas no navegador (Avisará a 80% da Meta/Stop)'
                    : 'Clique para ativar notificações locais (Push) via navegador'
                }
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                  pushPermission === 'granted'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
              >
                {pushPermission === 'granted' ? (
                  <>
                    <BellRing className="h-3 w-3 text-white" />
                    <span>Push Ativo</span>
                  </>
                ) : (
                  <>
                    <Bell className="h-3 w-3" />
                    <span>Ativar Lembrete Push</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className={`text-xl font-black font-mono ${todayPnl >= 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                {todayPnl > 0 ? '+' : ''}{formatCurrency(todayPnl)}
              </span>
              <span className="text-xs font-mono font-bold text-slate-300">
                {targetProgressPct.toFixed(0)}% da meta
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-800 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isTargetAchieved
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/50'
                    : isNearTarget80
                    ? 'bg-gradient-to-r from-amber-500 to-emerald-400'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${targetProgressPct}%` }}
              />
            </div>
          </div>

          {/* 80% Alert Reminder Banner */}
          {isNearTarget80 && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-400 shrink-0" />
                <span>
                  <strong>🎯 Lembrete de Autodisciplina:</strong> Você atingiu 80% da sua meta diária ({formatCurrency(todayPnl)}). Proteja seus ganhos!
                </span>
              </div>
            </div>
          )}

          {isTargetAchieved && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-200">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>🎉 Meta Batida!</strong> Excelente disciplina. Considere encerrar as operações por hoje.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* CARD: LIMITE DIÁRIO DE PERDA */}
        <div className={`relative overflow-hidden rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all ${
          isStopLossReached
            ? 'border-rose-500/80 bg-rose-950/50 ring-1 ring-rose-500/40'
            : isNearStop80
            ? 'border-rose-500/50 bg-rose-950/30 ring-1 ring-rose-500/30'
            : 'border-slate-800 bg-black/80'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Limite Diário de Perda (Stop)
                </span>
                <p className="text-[10px] text-slate-400">Limite configurado: {formatCurrency(lossVal)}</p>
              </div>
            </div>

            {/* Push Notification Status */}
            {isNotificationSupported() && (
              <button
                type="button"
                onClick={handleTogglePushPermission}
                title={
                  pushPermission === 'granted'
                    ? 'Notificações Push ativas no navegador'
                    : 'Clique para ativar notificações locais (Push) via navegador'
                }
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                  pushPermission === 'granted'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
              >
                {pushPermission === 'granted' ? (
                  <>
                    <BellRing className="h-3 w-3 text-white" />
                    <span>Push Ativo</span>
                  </>
                ) : (
                  <>
                    <Bell className="h-3 w-3" />
                    <span>Ativar Lembrete Push</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className={`text-xl font-black font-mono ${todayPnl < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                {todayPnl < 0 ? '-' : ''}{formatCurrency(currentLossAbs)}
              </span>
              <span className="text-xs font-mono font-bold text-slate-300">
                {lossProgressPct.toFixed(0)}% do limite consumido
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-800 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isStopLossReached
                    ? 'bg-rose-600 shadow-md shadow-rose-600/50'
                    : isNearStop80
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                    : 'bg-rose-500/80'
                }`}
                style={{ width: `${lossProgressPct}%` }}
              />
            </div>
          </div>

          {/* 80% Alert Reminder Banner */}
          {isNearStop80 && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>
                  <strong>⚠️ Lembrete de Autodisciplina:</strong> Você atingiu 80% do seu Limite de Perda ({formatCurrency(todayPnl)}). Evite o &quot;dia de fúria&quot;!
                </span>
              </div>
            </div>
          )}

          {isStopLossReached && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-rose-600 bg-rose-600 text-white p-2.5 text-xs">
              <div className="flex items-center gap-2 font-bold">
                <ShieldAlert className="h-4 w-4 shrink-0 text-white" />
                <span>
                  🛑 STOP LOSS ATINGIDO: Feche a plataforma de operações imediatamente!
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PAINEL DE METRICAS GERAIS (5 KPI CARDS) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 sm:gap-4">
      {/* CARD 1: CAPITAL & LUCRO LÍQUIDO (One-Click para Depósitos e Saques) */}
      <div
        onClick={onOpenCapitalModal}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenCapitalModal?.();
          }
        }}
        className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-black/80 p-3.5 sm:p-4 shadow-lg backdrop-blur-sm cursor-pointer hover:border-emerald-500/60 hover:bg-black hover:shadow-emerald-950/30 transition-all duration-200"
        title="Clique para abrir a tela de Depósitos, Saques e Histórico de Capital"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-emerald-300 transition-colors">
            Capital Atual
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-white bg-emerald-600 px-2 py-1 rounded transition font-bold shadow-md shadow-emerald-900/30 whitespace-nowrap">
              Saques / Depósitos
            </span>
          </div>
        </div>

        <div className="mt-2.5">
          <div className="text-2xl font-black font-mono tracking-tight text-white group-hover:text-emerald-300 transition-colors">
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
          <span>Gerenciar Banca:</span>
          <span className="font-bold text-emerald-400 group-hover:underline flex items-center gap-0.5">
            Ver Extrato &amp; Sacar &rarr;
          </span>
        </div>
      </div>

      {/* CARD 2: ASSERTIVIDADE (WIN RATE) */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-black/80 p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Assertividade
          </span>
          <div className="flex items-center gap-1.5">
            {onOpenKellyCalculator && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenKellyCalculator();
                }}
                title="Abrir Calculadora do Critério de Kelly (Dimensionar Lotes)"
                className="flex items-center gap-1 rounded-lg bg-teal-600 px-2 py-1 text-[10px] font-bold text-white transition hover:bg-teal-500 active:scale-95 shadow-md shadow-teal-900/30 whitespace-nowrap"
              >
                <Calculator className="h-3 w-3 shrink-0" />
                <span>Calc. Kelly</span>
              </button>
            )}
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Target className="h-4 w-4" />
            </div>
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
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-black/80 p-4 shadow-lg backdrop-blur-sm">
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
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-black/80 p-4 shadow-lg backdrop-blur-sm">
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

        {/* Mini Gráfico de Linha do Drawdown Semanal */}
        {weeklyDrawdownPoints.length > 1 && (
          <div className="mt-2.5 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>Evolução Semanal do Drawdown:</span>
              <span className="font-mono text-rose-400 font-bold">
                Max: -{Math.max(...weeklyDrawdownPoints.map((p) => p.ddPct)).toFixed(1)}%
              </span>
            </div>

            <div className="h-10 w-full relative">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 200 40" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="ddSparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {(() => {
                  const maxDd = Math.max(5, ...weeklyDrawdownPoints.map((p) => p.ddPct));
                  const count = weeklyDrawdownPoints.length;
                  const stepX = 200 / Math.max(1, count - 1);
                  const coords = weeklyDrawdownPoints.map((p, i) => ({
                    x: i * stepX,
                    y: 36 - (p.ddPct / maxDd) * 32,
                    ...p,
                  }));
                  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
                  const areaD = `${pathD} L ${coords[coords.length - 1].x} 40 L ${coords[0].x} 40 Z`;
                  return (
                    <>
                      <path d={areaD} fill="url(#ddSparkGrad)" />
                      <path d={pathD} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
                      {coords.map((c) => (
                        <circle
                          key={c.date}
                          cx={c.x}
                          cy={c.y}
                          r="2.5"
                          fill="#f43f5e"
                          stroke="#0f172a"
                          strokeWidth="1"
                        >
                          <title>{`${c.label}: -${c.ddPct}% (${formatCurrency(-c.ddAmt)})`}</title>
                        </circle>
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        )}
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
        className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-black/80 p-4 shadow-lg backdrop-blur-sm cursor-pointer transition-all duration-200 hover:border-purple-500/50 hover:bg-black hover:shadow-purple-950/20 hover:scale-[1.01] text-left"
        title="Clique para ver o guia detalhado e referências de Fator de Lucro e Payoff para Opções Binárias"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-purple-300 transition-colors">
            Fator de Lucro &amp; Payoff
          </span>
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline-flex text-[10px] font-bold text-white bg-purple-600 px-2 py-1 rounded transition shadow-md shadow-purple-900/30 whitespace-nowrap">
              Guia OB
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:bg-purple-500/20 transition shrink-0">
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
    </div>
  );
};

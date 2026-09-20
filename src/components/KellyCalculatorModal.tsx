import React, { useState, useEffect } from 'react';
import {
  X,
  Calculator,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Percent,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { OverallMetrics } from '../types';
import { formatCurrency, formatPercent } from '../utils/calculations';
import { calculateKelly, KellyResult } from '../utils/kellyCalculator';

interface KellyCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: OverallMetrics;
  currentCapital?: number;
}

export const KellyCalculatorModal: React.FC<KellyCalculatorModalProps> = ({
  isOpen,
  onClose,
  metrics,
  currentCapital,
}) => {
  const displayCapital = currentCapital ?? metrics.currentCapital ?? 10000;
  const initialWinRate = metrics.winRate || 55;
  const initialAvgWin = metrics.avgWin || 150;
  const initialAvgLoss = metrics.avgLoss || 100;

  // Local state for interactive calculation
  const [capital, setCapital] = useState<number>(displayCapital);
  const [winRate, setWinRate] = useState<number>(Number(initialWinRate.toFixed(1)));
  const [avgWin, setAvgWin] = useState<number>(Number(initialAvgWin.toFixed(2)));
  const [avgLoss, setAvgLoss] = useState<number>(Number(initialAvgLoss.toFixed(2)));
  const [stopLossAmount, setStopLossAmount] = useState<number>(100); // R$ por mini-contrato/lote
  const [fractionMultiplier, setFractionMultiplier] = useState<number>(0.25); // Default 25% Conservador

  // Sync state when props change
  useEffect(() => {
    if (isOpen) {
      setCapital(displayCapital > 0 ? displayCapital : 10000);
      setWinRate(metrics.winRate > 0 ? Number(metrics.winRate.toFixed(1)) : 55);
      setAvgWin(metrics.avgWin > 0 ? Number(metrics.avgWin.toFixed(2)) : 150);
      setAvgLoss(metrics.avgLoss > 0 ? Number(metrics.avgLoss.toFixed(2)) : 100);
    }
  }, [isOpen, displayCapital, metrics.winRate, metrics.avgWin, metrics.avgLoss]);

  if (!isOpen) return null;

  // Calculate Kelly stats live
  const result: KellyResult = calculateKelly({
    capital,
    winRatePercent: winRate,
    avgWin,
    avgLoss,
    stopLossAmount,
    fractionMultiplier,
  });

  const handleResetToRealStats = () => {
    setCapital(displayCapital > 0 ? displayCapital : 10000);
    setWinRate(metrics.winRate > 0 ? Number(metrics.winRate.toFixed(1)) : 55);
    setAvgWin(metrics.avgWin > 0 ? Number(metrics.avgWin.toFixed(2)) : 150);
    setAvgLoss(metrics.avgLoss > 0 ? Number(metrics.avgLoss.toFixed(2)) : 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-md pt-safe pb-safe overflow-y-auto">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-800 bg-black/95 shadow-2xl backdrop-blur-xl my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800/80 p-5 sm:p-7 pb-4 shrink-0 bg-black/80">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-700 shadow-lg shadow-teal-900/40 text-white">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Calculadora do Critério de Kelly (Opções Binárias)
                </h2>
                <span className="rounded-full bg-teal-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-teal-300 border border-teal-500/30">
                  Stake / Entrada
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Calcule o valor ideal da sua entrada (Stake) com base na sua vantagem estatística real nas corretoras.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-800/50 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 sm:p-7 space-y-6 flex-1 min-h-0">
          {/* Top Info Banner & Reset */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-black/50 p-3 px-4">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Valores pré-preenchidos automaticamente com suas métricas históricas de trading.</span>
            </div>
            <button
              type="button"
              onClick={handleResetToRealStats}
              className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 transition shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Restaurar Minhas Métricas</span>
            </button>
          </div>

          {/* Form Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Capital Total */}
            <div className="rounded-2xl border border-slate-800 bg-black/70 p-3.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Capital da Banca
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="100"
                  value={capital}
                  onChange={(e) => setCapital(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-800 bg-black py-2 px-3 text-sm font-bold font-mono text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Taxa de Acerto */}
            <div className="rounded-2xl border border-slate-800 bg-black/70 p-3.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Taxa de Acerto (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="99"
                  step="0.5"
                  value={winRate}
                  onChange={(e) => setWinRate(Math.min(99, Math.max(1, Number(e.target.value))))}
                  className="w-full rounded-xl border border-slate-800 bg-black py-2 pl-3 pr-8 text-sm font-bold font-mono text-emerald-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-500">%</span>
              </div>
            </div>

            {/* Stake Base do Trade */}
            <div className="rounded-2xl border border-teal-500/30 bg-teal-950/20 p-3.5 ring-1 ring-teal-500/20">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-teal-300 mb-1.5">
                Stake Base / Entrada
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="5"
                  value={stopLossAmount}
                  onChange={(e) => setStopLossAmount(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-teal-500/40 bg-black py-2 px-3 text-sm font-bold font-mono text-teal-200 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Valor planejado por entrada na corretora</span>
            </div>

            {/* Lucro Médio */}
            <div className="rounded-2xl border border-slate-800 bg-black/70 p-3.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Lucro Médio Gain
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="5"
                  value={avgWin}
                  onChange={(e) => setAvgWin(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-800 bg-black py-2 px-3 text-sm font-bold font-mono text-emerald-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Prejuízo Médio */}
            <div className="rounded-2xl border border-slate-800 bg-black/70 p-3.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Prejuízo Médio Loss
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="5"
                  value={avgLoss}
                  onChange={(e) => setAvgLoss(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-800 bg-black py-2 px-3 text-sm font-bold font-mono text-rose-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Payoff resultante */}
            <div className="rounded-2xl border border-slate-800 bg-black/70 p-3.5 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Payoff Ratio (Média W/L)
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-xl font-black font-mono text-cyan-400">
                  {result.payoffRatio.toFixed(2)} : 1
                </span>
                <span className="text-[11px] text-slate-400">Gain/Loss</span>
              </div>
            </div>
          </div>

          {/* Kelly Fractional Selector */}
          <div className="rounded-2xl border border-slate-800 bg-black/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-teal-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Nível de Fração do Critério de Kelly
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-teal-400">
                {(fractionMultiplier * 100).toFixed(0)}% Kelly
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { val: 0.25, label: '25% Kelly', desc: 'Conservador (Recomendado)', color: 'border-teal-500/50 bg-teal-950/40 text-teal-300' },
                { val: 0.50, label: '50% Kelly', desc: 'Moderado', color: 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300' },
                { val: 0.75, label: '75% Kelly', desc: 'Agressivo', color: 'border-amber-500/50 bg-amber-950/40 text-amber-300' },
                { val: 1.00, label: '100% Kelly', desc: 'Puro / Alto Risco', color: 'border-rose-500/50 bg-rose-950/40 text-rose-300' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setFractionMultiplier(item.val)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                    fractionMultiplier === item.val
                      ? `${item.color} ring-2 ring-teal-500/40 shadow-lg font-bold`
                      : 'border-slate-800 bg-black/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xs font-bold font-mono">{item.label}</span>
                  <span className="text-[10px] opacity-80 mt-0.5">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* MAIN RESULTS DISPLAY CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Stake Sugerida Card */}
            <div className="md:col-span-1 rounded-2xl border border-teal-500/50 bg-gradient-to-b from-teal-950/40 to-slate-900 p-5 shadow-xl ring-1 ring-teal-500/30 flex flex-col justify-between">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-teal-300">
                  Stake Sugerida (Entrada)
                </span>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black font-mono tracking-tight text-emerald-400">
                    {formatCurrency(result.recommendedRiskAmount)}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block font-mono">
                  ({result.fractionalKellyPercent.toFixed(2)}% da sua banca total)
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-teal-500/20 flex items-center justify-between text-xs text-slate-300">
                <span>Risco Sugerido:</span>
                <span className="font-bold font-mono text-teal-300">
                  {result.fractionalKellyPercent.toFixed(2)}% por trade
                </span>
              </div>
            </div>

            {/* Metrics Breakdown Cards */}
            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              {/* Risco em % da Banca */}
              <div className="rounded-2xl border border-slate-800 bg-black/80 p-4 flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Risco por Operação (% Banca)
                </span>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-teal-300">
                    {result.fractionalKellyPercent.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Kelly Teórico 100%: {result.fullKellyPercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Expectativa Matemática EV */}
              <div className="rounded-2xl border border-slate-800 bg-black/80 p-4 flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Expectativa Matemática (EV)
                </span>
                <div className="mt-2">
                  <span className={`text-2xl font-black font-mono ${result.expectedValue > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {result.expectedValue > 0 ? '+' : ''}R$ {result.expectedValue.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    retorno médio por R$ 1 arriscado
                  </span>
                </div>
              </div>

              {/* Kelly Conservador (25%) */}
              <div className="rounded-2xl border border-slate-800 bg-black/80 p-4 flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  25% Kelly (Recomendado)
                </span>
                <div className="mt-2">
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    {(result.fullKellyPercent * 0.25).toFixed(2)}% banca
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {formatCurrency((capital * Math.max(0, result.fullKellyPercent * 0.25)) / 100)} / trade
                  </span>
                </div>
              </div>

              {/* Kelly Puro (100%) */}
              <div className="rounded-2xl border border-slate-800 bg-black/80 p-4 flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  100% Kelly (Teórico Máximo)
                </span>
                <div className="mt-2">
                  <span className="text-lg font-bold font-mono text-amber-400">
                    {result.fullKellyPercent.toFixed(2)}% banca
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {formatCurrency((capital * Math.max(0, result.fullKellyPercent)) / 100)} / trade
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Warning / Orientation Banner */}
          <div
            className={`rounded-2xl border p-4 text-xs ${
              result.warningLevel === 'negative'
                ? 'border-rose-500/50 bg-rose-950/40 text-rose-200'
                : result.warningLevel === 'danger'
                ? 'border-amber-500/50 bg-amber-950/40 text-amber-200'
                : result.warningLevel === 'warning'
                ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-200'
                : 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.warningLevel === 'negative' ? (
                <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              ) : result.warningLevel === 'danger' ? (
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">
                <span className="font-bold block mb-0.5">
                  {result.warningLevel === 'negative'
                    ? 'Sistema Sem Vantagem Probabilística'
                    : result.warningLevel === 'danger'
                    ? 'Atenção ao Risco Excessivo'
                    : 'Recomendação de Dimensionamento'}
                </span>
                <p>{result.warningMessage}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800/80 p-4 sm:p-5 shrink-0 bg-black/80">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Kelly Fracionário (25%) é a norma da indústria para mitigar a volatilidade da curva.</span>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-teal-900/30 transition hover:bg-teal-500 active:scale-95"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

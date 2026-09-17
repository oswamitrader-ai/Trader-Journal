import React, { useEffect } from 'react';
import { Trophy, AlertOctagon, AlertTriangle, ShieldCheck, ShieldAlert, X } from 'lucide-react';
import { RiskSettings } from '../types';
import { formatCurrency } from '../utils/calculations';
import { triggerConfetti } from '../utils/confetti';

interface RiskAlertBannerProps {
  todayPnl: number;
  todayTradesCount: number;
  settings?: RiskSettings;
  dismissedAlerts?: Record<string, boolean>;
  onDismiss?: (alertKey: string) => void;
  onOpenSettings: () => void;
  onOpenAntiFuria?: () => void;
}

export const RiskAlertBanner: React.FC<RiskAlertBannerProps> = ({
  todayPnl,
  todayTradesCount,
  settings,
  dismissedAlerts = {},
  onDismiss = (_alertKey: string) => {},
  onOpenSettings,
  onOpenAntiFuria,
}) => {
  const dailyProfitTarget = settings?.dailyProfitTarget ?? 500;
  const dailyLossLimit = settings?.dailyLossLimit ?? 300;
  const maxTradesPerDay = settings?.maxTradesPerDay ?? 5;

  const isTargetHit = todayPnl >= dailyProfitTarget;
  const isStopHit = todayPnl <= -dailyLossLimit;
  const isTradesLimitHit = todayTradesCount >= maxTradesPerDay;

  // Fire confetti when target is hit and not dismissed
  useEffect(() => {
    if (isTargetHit && !dismissedAlerts['target']) {
      triggerConfetti();
    }
  }, [isTargetHit, dismissedAlerts]);

  if (isTargetHit && !dismissedAlerts['target']) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/70 via-emerald-900/40 to-teal-950/70 p-4 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Trophy className="h-6 w-6 text-emerald-400 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-300 border border-emerald-500/30">
                  Meta Batida!
                </span>
                <h4 className="text-sm sm:text-base font-bold text-white">
                  Parabéns! Você atingiu a sua Meta Diária de Ganho ({formatCurrency(todayPnl)})
                </h4>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-emerald-200/90 leading-relaxed">
                Excelente disciplina! A meta configurada era de <strong>{formatCurrency(dailyProfitTarget)}</strong>. 
                O maior segredo de traders consistentes é saber a hora de parar e proteger o lucro no bolso. 
                Considere desligar a plataforma de operações por hoje.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
            <button
              onClick={onOpenSettings}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              Ajustar Meta
            </button>
            <button
              onClick={() => onDismiss('target')}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition"
              title="Dispensar alerta"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isStopHit && !dismissedAlerts['stop']) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-red-600 p-4 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-black/20 text-white">
              <AlertOctagon className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  Stop Loss Atingido
                </span>
                <h4 className="text-sm sm:text-base font-extrabold text-white">
                  Atenção: Limite Diário de Perda Atingido ({formatCurrency(todayPnl)})
                </h4>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-white/95 leading-relaxed font-medium">
                Seu limite de perda diário de <strong>{formatCurrency(dailyLossLimit)}</strong> foi atingido. 
                <strong> Feche o software de trade imediatamente!</strong> Não tente recuperar no mesmo dia para evitar o &quot;dia de fúria&quot;. O mercado estará aberto amanhã.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0 flex-wrap">
            {onOpenAntiFuria && (
              <button
                onClick={onOpenAntiFuria}
                className="flex items-center gap-1.5 rounded-xl bg-black/30 hover:bg-black/40 text-white px-3.5 py-2 text-xs font-bold shadow-md transition border border-white/20"
                title="Abrir Extensão de Bloqueio da Exnova"
              >
                <ShieldAlert className="w-4 h-4 text-white" />
                <span>Trava Anti-Fúria (Extensão)</span>
              </button>
            )}
            <button
              onClick={onOpenSettings}
              className="rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-red-700 shadow-md hover:bg-slate-100 transition"
            >
              Configurar Limite
            </button>
            <button
              onClick={() => onDismiss('stop')}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-black/20 hover:text-white transition"
              title="Dispensar alerta"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isTradesLimitHit && !dismissedAlerts['trades']) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-3.5 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-amber-200">
              <strong>Alerta de Overtrading:</strong> Você já realizou <strong>{todayTradesCount} operações</strong> hoje (limite sugerido: {maxTradesPerDay}). Fique atento à fadiga mental.
            </p>
          </div>
          <button
            onClick={() => onDismiss('trades')}
            className="text-amber-400 hover:text-amber-200 text-xs px-2 py-1"
          >
            Dispensar
          </button>
        </div>
      </div>
    );
  }

  return null;
};

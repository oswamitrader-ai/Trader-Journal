import React, { useState } from 'react';
import { X, Sliders, ShieldCheck, DollarSign, AlertTriangle, ShieldAlert, Clock } from 'lucide-react';
import { RiskSettings } from '../types';

interface RiskSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RiskSettings;
  onSave: (newSettings: RiskSettings) => void;
  isStopHit?: boolean;
  isMaxTradesHit?: boolean;
  isAntiFuriaActive?: boolean;
}

export const RiskSettingsModal: React.FC<RiskSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  isStopHit = false,
  isMaxTradesHit = false,
  isAntiFuriaActive = false,
}) => {
  const [initialCapital, setInitialCapital] = useState<number>(settings.initialCapital);
  const [dailyProfitTarget, setDailyProfitTarget] = useState<number>(settings.dailyProfitTarget);
  const [dailyLossLimit, setDailyLossLimit] = useState<number>(settings.dailyLossLimit);
  const [monthlyProfitTarget, setMonthlyProfitTarget] = useState<number>(settings.monthlyProfitTarget);
  const [monthlyLossLimit, setMonthlyLossLimit] = useState<number>(settings.monthlyLossLimit);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState<number>(settings.maxTradesPerDay);

  // Custom Anti-Fúria Schedule Window
  const [antiFuriaCustomWindowEnabled, setAntiFuriaCustomWindowEnabled] = useState<boolean>(
    settings.antiFuriaCustomWindowEnabled ?? false
  );
  const [antiFuriaStartTime, setAntiFuriaStartTime] = useState<string>(
    settings.antiFuriaStartTime || '07:00'
  );
  const [antiFuriaEndTime, setAntiFuriaEndTime] = useState<string>(
    settings.antiFuriaEndTime || '11:30'
  );

  // Sincroniza estado interno sempre que o modal abre ou settings muda
  React.useEffect(() => {
    if (isOpen) {
      setInitialCapital(settings.initialCapital);
      setDailyProfitTarget(settings.dailyProfitTarget);
      setDailyLossLimit(settings.dailyLossLimit);
      setMonthlyProfitTarget(settings.monthlyProfitTarget);
      setMonthlyLossLimit(settings.monthlyLossLimit);
      setMaxTradesPerDay(settings.maxTradesPerDay);
      setAntiFuriaCustomWindowEnabled(settings.antiFuriaCustomWindowEnabled ?? false);
      setAntiFuriaStartTime(settings.antiFuriaStartTime || '07:00');
      setAntiFuriaEndTime(settings.antiFuriaEndTime || '11:30');
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 🔒 Proteção Anti-Fúria: Se a trava foi ativada (Stop ou Max Trades), NÃO permite alterar/aumentar os limites
    const finalDailyLossLimit = (isStopHit || isAntiFuriaActive)
      ? settings.dailyLossLimit
      : Math.max(0, Number(dailyLossLimit) || 0);

    const finalMaxTradesPerDay = (isMaxTradesHit || isAntiFuriaActive)
      ? settings.maxTradesPerDay
      : Math.max(1, Number(maxTradesPerDay) || 5);

    onSave({
      initialCapital: Number(initialCapital) || 0,
      dailyProfitTarget: Math.max(0, Number(dailyProfitTarget) || 0),
      dailyLossLimit: finalDailyLossLimit,
      monthlyProfitTarget: Math.max(0, Number(monthlyProfitTarget) || 0),
      monthlyLossLimit: Math.max(0, Number(monthlyLossLimit) || 0),
      maxTradesPerDay: finalMaxTradesPerDay,
      alertSoundEnabled: true,
      antiFuriaCustomWindowEnabled,
      antiFuriaStartTime: antiFuriaStartTime || '07:00',
      antiFuriaEndTime: antiFuriaEndTime || '11:30',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto pt-safe pb-safe">
      <div className="relative w-full max-w-lg max-h-[94vh] flex flex-col rounded-2xl border border-slate-800 bg-black shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Configurações de Gestão de Risco & Metas</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {/* Capital Inicial */}
          <div>
            <label className="mb-1 block font-bold text-slate-200">
              Capital Inicial da Conta (R$)
            </label>
            <p className="mb-1.5 text-[11px] text-slate-400">
              Base para o cálculo do seu lucro acumulado, rentabilidade percentual e curva de patrimônio.
            </p>
            <input
              type="number"
              min="0"
              step="any"
              required
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-800 bg-black px-3.5 py-2 font-mono text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Metas Diárias: Ganho & Perda */}
          <div className="rounded-xl border border-slate-800 bg-black/60 p-3.5 space-y-3">
            <span className="block font-bold text-white uppercase text-[11px] tracking-wider text-emerald-400">
              Parâmetros Diários
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-emerald-300">
                  Meta de Ganho Diária (R$)
                </label>
                <input
                  type="number"
                  min="10"
                  step="any"
                  required
                  value={dailyProfitTarget}
                  onChange={(e) => setDailyProfitTarget(Number(e.target.value))}
                  className="w-full rounded-xl border border-emerald-500/30 bg-black px-3 py-2 font-mono font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-rose-300 flex items-center justify-between">
                  <span>Limite de Perda Diário (R$)</span>
                  {isStopHit && <span className="text-[10px] text-red-400 font-bold">🔒 BLOQUEADO</span>}
                </label>
                <input
                  type="number"
                  min="10"
                  step="any"
                  required
                  disabled={isStopHit}
                  value={dailyLossLimit}
                  onChange={(e) => setDailyLossLimit(Number(e.target.value))}
                  className={`w-full rounded-xl border px-3 py-2 font-mono font-bold text-rose-400 focus:outline-none ${
                    isStopHit
                      ? 'border-red-500/60 bg-red-950/30 cursor-not-allowed opacity-80'
                      : 'border-rose-500/30 bg-black focus:border-rose-500'
                  }`}
                />
              </div>
            </div>
            {isStopHit ? (
              <p className="text-[10px] text-red-300 font-bold flex items-center gap-1 bg-red-950/40 p-2 rounded-lg border border-red-500/30">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-red-400" />
                Stop Loss diário atingido hoje. O limite de perda não pode ser alterado para burlar o controle de risco.
              </p>
            ) : (
              <p className="text-[10px] text-slate-400">
                Ao atingir a meta ou o stop, o painel emitirá alertas imediatos para você proteger seu lucro ou evitar o tilt.
              </p>
            )}
          </div>

          {/* Área Dedicada: Trava Anti-Fúria & Janela de Operações */}
          <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4.5 w-4.5 text-red-400 shrink-0" />
                <span className="font-bold text-white text-xs uppercase tracking-wider">
                  Janela de Operação & Trava Anti-Fúria
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={antiFuriaCustomWindowEnabled}
                  onChange={(e) => setAntiFuriaCustomWindowEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {antiFuriaCustomWindowEnabled ? (
                <strong className="text-red-300">Janela de Horário Rígida Ativa:</strong>
              ) : (
                <span className="text-slate-400">Padrão: ao tomar stop, a trava libera o acesso à meia-noite (00:00h). Ative a opção acima para definir sua janela de trabalho exata.</span>
              )}
            </p>

            {antiFuriaCustomWindowEnabled && (
              <div className="pt-1 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-semibold text-slate-200">
                      Início das Operações
                    </label>
                    <input
                      type="time"
                      value={antiFuriaStartTime}
                      onChange={(e) => setAntiFuriaStartTime(e.target.value)}
                      className="w-full rounded-xl border border-red-500/40 bg-black px-3 py-2 font-mono text-sm font-bold text-white focus:border-red-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-slate-200">
                      Fim das Operações
                    </label>
                    <input
                      type="time"
                      value={antiFuriaEndTime}
                      onChange={(e) => setAntiFuriaEndTime(e.target.value)}
                      className="w-full rounded-xl border border-red-500/40 bg-black px-3 py-2 font-mono text-sm font-bold text-white focus:border-red-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-black/80 border border-slate-800 p-2.5 text-[10px] text-slate-400 space-y-1">
                  <p className="flex items-center gap-1.5 text-red-300 font-bold">
                    <Clock className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    Regra Rigorosa da Trava:
                  </p>
                  <p>
                    Se você atingir o stop loss hoje, o acesso a corretoras ficará bloqueado e só será liberado no próximo ciclo exatamente às <strong>{antiFuriaStartTime || '07:00'}h</strong>, impedindo operatórias fora da sua janela.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Metas Mensais */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-300">
                Meta Mensal (R$)
              </label>
              <input
                type="number"
                min="50"
                step="any"
                required
                value={monthlyProfitTarget}
                onChange={(e) => setMonthlyProfitTarget(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 font-mono text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-300">
                Stop Loss Mensal (R$)
              </label>
              <input
                type="number"
                min="50"
                step="any"
                required
                value={monthlyLossLimit}
                onChange={(e) => setMonthlyLossLimit(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 font-mono text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Overtrading limit */}
          <div>
            <label className="mb-1 block font-semibold text-slate-300 flex items-center justify-between">
              <span>Limite Máximo de Operações por Dia</span>
              {(isMaxTradesHit || isAntiFuriaActive) && <span className="text-[10px] text-red-400 font-bold">🔒 BLOQUEADO</span>}
            </label>
            <input
              type="number"
              min="1"
              max="50"
              required
              disabled={isMaxTradesHit || isAntiFuriaActive}
              value={maxTradesPerDay}
              onChange={(e) => setMaxTradesPerDay(Number(e.target.value))}
              className={`w-full rounded-xl border px-3 py-2 font-mono font-bold text-white focus:outline-none ${
                isMaxTradesHit || isAntiFuriaActive
                  ? 'border-red-500/60 bg-red-950/30 cursor-not-allowed opacity-80 text-red-400'
                  : 'border-slate-800 bg-black focus:border-emerald-500'
              }`}
            />
            {(isMaxTradesHit || isAntiFuriaActive) ? (
              <p className="mt-1 text-[10px] text-red-300 font-bold flex items-center gap-1 bg-red-950/40 p-2 rounded-lg border border-red-500/30">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-red-400" />
                Limite de operações atingido hoje. O número máximo não pode ser aumentado para burlar a trava.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-400">
                Ajuda a combater o overtrading bloqueando novas operações quando o limite for excedido.
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 px-4 py-2 font-semibold text-slate-400 hover:text-white transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition"
            >
              Salvar Parâmetros
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Tag,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Trade, DayPerformance } from '../types';
import { formatCurrency, formatPercent, formatDate, isTradeProtected, isOtcTrade } from '../utils/calculations';

interface DayDetailModalProps {
  date: string | null;
  trades: Trade[];
  dayPerformance?: DayPerformance;
  onClose: () => void;
  onOpenNewTradeForDate: (date: string) => void;
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
  onDeleteMultipleTrades?: (ids: string[]) => void;
  isAntiFuriaActive?: boolean;
}

export const DayDetailModal: React.FC<DayDetailModalProps> = ({
  date,
  trades,
  dayPerformance,
  onClose,
  onOpenNewTradeForDate,
  onEditTrade,
  onDeleteTrade,
  onDeleteMultipleTrades,
  isAntiFuriaActive = false,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Reset selected IDs when date changes
  useEffect(() => {
    setSelectedIds([]);
  }, [date]);

  if (!date) return null;

  const dayTrades = trades
    .filter((t) => t.date === date)
    .sort((a, b) => (b.time || '00:00').localeCompare(a.time || '00:00'));
  const totalPnl = dayTrades.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0);
  const isPositive = totalPnl >= 0;

  const wins = dayTrades.filter((t) => t.pnl > 0.001).length;
  const losses = dayTrades.filter((t) => t.pnl < -0.001).length;
  const breakevens = dayTrades.filter((t) => Math.abs(t.pnl) <= 0.001).length;
  const winRate = dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0;

  const deletableTrades = dayTrades.filter((t) => !isTradeProtected(t, isAntiFuriaActive));
  const isAllSelected =
    deletableTrades.length > 0 && deletableTrades.every((t) => selectedIds.includes(t.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(deletableTrades.map((t) => t.id));
    }
  };

  const toggleSelectTrade = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (onDeleteMultipleTrades) {
      onDeleteMultipleTrades(selectedIds);
    } else {
      if (
        window.confirm(
          `Deseja realmente excluir as ${selectedIds.length} operações selecionadas?`
        )
      ) {
        selectedIds.forEach((id) => onDeleteTrade(id));
      }
    }
    setSelectedIds([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto pt-safe pb-safe">
      <div className="relative w-full max-w-2xl max-h-[94vh] flex flex-col rounded-2xl border border-slate-800 bg-black shadow-2xl my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5 shrink-0 bg-black/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Detalhes do Dia {formatDate(date)}
              </h3>
              <p className="text-xs text-slate-400">
                {dayTrades.length} {dayTrades.length === 1 ? 'operação realizada' : 'operações realizadas'} nesta data
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1">
          {/* Day Metric Highlights */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* PnL Card */}
            <div
              className={`rounded-xl border p-3 ${
                isPositive
                  ? 'border-emerald-500/30 bg-emerald-950/30'
                  : 'border-rose-500/30 bg-rose-950/30'
              }`}
            >
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Resultado do Dia
              </span>
              <span
                className={`text-xl font-black font-mono tracking-tight ${
                  isPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isPositive ? '+' : ''}
                {formatCurrency(totalPnl)}
              </span>
            </div>

            {/* Win Rate Card */}
            <div className="rounded-xl border border-slate-800 bg-black/60 p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Assertividade do Dia
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black font-mono text-emerald-400">
                  {winRate.toFixed(1)}%
                </span>
                <span className="text-[11px] text-slate-400">
                  ({wins}W / {losses}L / {breakevens}E)
                </span>
              </div>
            </div>

            {/* Day-over-Day Growth Comparison */}
            <div className="rounded-xl border border-slate-800 bg-black/60 p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Variação vs Dia Anterior
              </span>
              {dayPerformance?.dayOverDayGrowthPercent !== undefined ? (
                <div className="flex items-center gap-1 mt-0.5">
                  {dayPerformance.dayOverDayGrowthPercent >= 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-rose-400" />
                  )}
                  <span
                    className={`text-lg font-black font-mono ${
                      dayPerformance.dayOverDayGrowthPercent >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {formatPercent(dayPerformance.dayOverDayGrowthPercent, true)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    (Ant: {formatCurrency(dayPerformance.prevDayPnl || 0)})
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">Primeiro dia do histórico</span>
              )}
            </div>
          </div>

          {/* List of Trades on this Day */}
          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Operações ({dayTrades.length})
                </h4>

                {deletableTrades.length > 0 && (
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-700 bg-black text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>Selecionar todas</span>
                  </label>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1 rounded-lg bg-rose-950/80 px-2.5 py-1 text-xs font-bold text-rose-200 border border-rose-500/50 hover:bg-rose-900 transition animate-pulse"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-300" />
                    <span>Excluir ({selectedIds.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onOpenNewTradeForDate(date)}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600/20 px-2.5 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition"
                >
                  <Plus className="h-3 w-3" /> + Adicionar
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {dayTrades.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Nenhuma operação registrada para esta data.
                </div>
              ) : (
                dayTrades.map((t) => {
                  const isGain = t.result === 'GAIN';
                  const isLoss = t.result === 'LOSS';
                  const isProtected = isTradeProtected(t, isAntiFuriaActive);
                  const isSelected = selectedIds.includes(t.id);

                  return (
                    <div
                      key={t.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border p-3 text-xs transition ${
                        isSelected
                          ? 'border-rose-500/50 bg-rose-950/20 ring-1 ring-rose-500/30'
                          : 'border-slate-800/80 bg-black/60 hover:bg-black/80'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        {!isProtected ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectTrade(t.id)}
                            className="h-4 w-4 rounded border-slate-700 bg-black text-emerald-500 focus:ring-emerald-500 cursor-pointer shrink-0"
                          />
                        ) : (
                          <ShieldCheck
                            className="h-4 w-4 text-amber-500/70 shrink-0"
                            title="Operação protegida pelo Anti-Fúria"
                          />
                        )}
                        <span className="font-mono text-slate-400 text-[11px]">{t.time || '--:--'}</span>
                        <span className="font-mono font-bold text-white text-sm">{t.asset}</span>
                        {isOtcTrade(t) && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-purple-500/20 border border-purple-500/40 px-1.5 py-0.5 text-[9px] font-black text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.35)] animate-pulse">
                            <Zap className="h-2.5 w-2.5 text-purple-400 fill-purple-400" /> OTC
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                            t.type === 'BUY'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          {t.type === 'BUY' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {t.type === 'BUY' ? 'Compra' : 'Venda'}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold border ${
                            t.accountType === 'DEMO' || t.isReal === false || (t.tags && t.tags.some(tag => tag.toUpperCase().includes('DEMO')))
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {t.accountType === 'DEMO' || t.isReal === false || (t.tags && t.tags.some(tag => tag.toUpperCase().includes('DEMO')))
                            ? 'DEMO 🧪'
                            : 'REAL 💵'}
                        </span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                          {t.strategy}
                        </span>
                        <span className="text-slate-400 text-[11px] font-mono">
                          Entrada: {formatCurrency(t.contractsOrQuantity)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span
                          className={`font-mono font-extrabold text-sm ${
                            isGain ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-300'
                          }`}
                        >
                          {t.pnl > 0 ? '+' : ''}
                          {formatCurrency(t.pnl)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditTrade(t)}
                            className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800 text-[11px]"
                          >
                            Editar
                          </button>
                          {isProtected ? (
                            <span
                              title="🔒 Operação de Conta Real ou Anti-Fúria ativo. Protegida contra exclusão."
                              className="text-amber-400 px-1.5 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 cursor-default select-none"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              <span>Protegido 🔒</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onDeleteTrade(t.id)}
                              className="text-slate-400 hover:text-rose-400 px-1.5 py-0.5 rounded hover:bg-rose-950/40 text-[11px]"
                            >
                              Excluir
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end p-4 border-t border-slate-800 bg-black/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  X,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  MinusCircle,
  Trash2,
  Building2,
  Calendar,
  FileText,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { CapitalTransaction, CapitalTransactionType } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';

interface CapitalHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: CapitalTransaction[];
  onAddTransaction: (tx: CapitalTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  currentCapital: number;
  initialCapital: number;
}

const DEFAULT_BROKERS = ['Exnova', 'XP Investimentos', 'Clear Corretora', 'BTG Pactual', 'Binance', 'IQ Option', 'Outra'];

export const CapitalHistoryModal: React.FC<CapitalHistoryModalProps> = ({
  isOpen,
  onClose,
  transactions,
  onAddTransaction,
  onDeleteTransaction,
  currentCapital,
  initialCapital,
}) => {
  const [activeType, setActiveType] = useState<CapitalTransactionType>('WITHDRAWAL');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [broker, setBroker] = useState<string>('Exnova');
  const [customBroker, setCustomBroker] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);

  if (!isOpen) return null;

  const totalDeposits = transactions
    .filter((t) => t.type === 'DEPOSIT')
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const totalWithdrawals = transactions
    .filter((t) => t.type === 'WITHDRAWAL')
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return;

    const finalBroker = broker === 'Outra' ? customBroker.trim() || 'Outra Corretora' : broker;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newTx: CapitalTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: activeType,
      amount: numAmount,
      date: date || new Date().toISOString().split('T')[0],
      time: timeStr,
      broker: finalBroker,
      notes: notes.trim(),
    };

    onAddTransaction(newTx);

    // Reset form
    setAmount('');
    setNotes('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm pt-safe pb-safe overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5 shrink-0 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-md">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Gestão de Capital & Movimentações
              </h3>
              <p className="text-xs text-slate-400">
                Histórico completo de saques e depósitos nas corretoras
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Capital Atual */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Capital Atual Total
              </span>
              <div className="text-lg font-black font-mono text-white">
                {formatCurrency(currentCapital)}
              </div>
              <p className="text-[10px] text-slate-500">Saldo atual da banca</p>
            </div>

            {/* Total Depósitos */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3.5 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5" /> Total Depósitos
              </span>
              <div className="text-lg font-black font-mono text-emerald-400">
                +{formatCurrency(totalDeposits)}
              </div>
              <p className="text-[10px] text-slate-400">Total injetado na banca</p>
            </div>

            {/* Total Saques */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3.5 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <ArrowDownRight className="h-3.5 w-3.5" /> Total Saques
              </span>
              <div className="text-lg font-black font-mono text-amber-400">
                -{formatCurrency(totalWithdrawals)}
              </div>
              <p className="text-[10px] text-slate-400">Total realizado / retirado</p>
            </div>
          </div>

          {/* Action Bar (Novo Saque / Depósito) */}
          <div className="flex items-center justify-between gap-2 border-t border-slate-800/80 pt-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Histórico de Lançamentos ({transactions.length})
            </h4>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveType('DEPOSIT');
                  setShowAddForm(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md"
              >
                <PlusCircle className="h-3.5 w-3.5" /> + Depósito
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveType('WITHDRAWAL');
                  setShowAddForm(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition shadow-md"
              >
                <MinusCircle className="h-3.5 w-3.5" /> - Saque
              </button>
            </div>
          </div>

          {/* Add Transaction Form Drawer */}
          {showAddForm && (
            <form
              onSubmit={handleSubmit}
              className="p-4 rounded-xl border border-slate-700 bg-slate-950 space-y-3 animate-fadeIn"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  {activeType === 'DEPOSIT' ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-amber-400" />
                  )}
                  {activeType === 'DEPOSIT' ? 'Registrar Novo Depósito' : 'Registrar Novo Saque'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Valor */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Valor (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 font-mono font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      required
                      placeholder="0,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-10 pr-3 py-2 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Corretora */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Corretora</label>
                  <select
                    value={broker}
                    onChange={(e) => setBroker(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none font-medium"
                  >
                    {DEFAULT_BROKERS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Data */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none font-medium"
                  />
                </div>
              </div>

              {/* Custom Broker if 'Outra' */}
              {broker === 'Outra' && (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Nome da Corretora</label>
                  <input
                    type="text"
                    placeholder="Ex: Pocket Option, Deriv..."
                    value={customBroker}
                    onChange={(e) => setCustomBroker(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none font-medium"
                  />
                </div>
              )}

              {/* Observações */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Observações (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Saque de lucros da semana PIX / Transferência"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 font-bold text-white rounded-lg transition shadow-md ${
                    activeType === 'DEPOSIT'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-amber-600 hover:bg-amber-500'
                  }`}
                >
                  {activeType === 'DEPOSIT' ? 'Confirmar Depósito' : 'Confirmar Saque'}
                </button>
              </div>
            </form>
          )}

          {/* Transactions List */}
          {transactions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2 border border-slate-800/80 rounded-xl bg-slate-950/40">
              <Building2 className="mx-auto h-8 w-8 text-slate-600" />
              <p className="font-semibold text-slate-300">Nenhum depósito ou saque registrado ainda.</p>
              <p className="text-xs text-slate-500">
                Utilize os botões acima para cadastrar saques e depósitos feitos em suas corretoras.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {transactions
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((t) => {
                  const isDeposit = t.type === 'DEPOSIT';
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-slate-950/50 hover:bg-slate-800/40 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                            isDeposit
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {isDeposit ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bold text-xs ${
                                isDeposit ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            >
                              {isDeposit ? 'Depósito' : 'Saque'}
                            </span>
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 font-medium">
                              {t.broker || 'Corretora'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {formatDate(t.date)} {t.time ? `às ${t.time}` : ''}
                            {t.notes ? ` • ${t.notes}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`font-mono font-bold text-sm ${
                            isDeposit ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {isDeposit ? '+' : '-'}
                          {formatCurrency(t.amount)}
                        </span>
                        <button
                          onClick={() => onDeleteTransaction(t.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition"
                          title="Excluir movimentação"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

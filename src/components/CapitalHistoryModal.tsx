import React, { useState, useRef } from 'react';
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
  Percent,
  Receipt,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Ban,
  Clock,
  CheckSquare,
  Square,
} from 'lucide-react';
import { CapitalTransaction, CapitalTransactionType, CapitalTransactionStatus } from '../types';
import { formatCurrency, formatDate, getLocalDateStr } from '../utils/calculations';
import { parseCapitalTransactionsCsv, ParseCapitalTransactionsResult } from '../utils/tradeParsers';

interface CapitalHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: CapitalTransaction[];
  onAddTransaction: (tx: CapitalTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onDeleteMultipleTransactions?: (ids: string[]) => void;
  currentCapital: number;
  initialCapital: number;
}

const DEFAULT_BROKERS = ['Exnova', 'XP Investimentos', 'Clear Corretora', 'BTG Pactual', 'Binance', 'IQ Option', 'Quotex', 'Outra'];

export const CapitalHistoryModal: React.FC<CapitalHistoryModalProps> = ({
  isOpen,
  onClose,
  transactions,
  onAddTransaction,
  onDeleteTransaction,
  onDeleteMultipleTransactions,
  currentCapital,
  initialCapital,
}) => {
  const [activeType, setActiveType] = useState<CapitalTransactionType>('WITHDRAWAL');
  const [amount, setAmount] = useState<string>('');
  const [fee, setFee] = useState<string>('');
  const [showFeeInput, setShowFeeInput] = useState<boolean>(false);
  const [date, setDate] = useState<string>(() => getLocalDateStr());
  const [broker, setBroker] = useState<string>('Exnova');
  const [customBroker, setCustomBroker] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<CapitalTransactionStatus>('COMPLETED');
  const [showAddForm, setShowAddForm] = useState(false);

  // Estados de Seleção e Exclusão em Massa
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);

  // Estados de Importação de CSV
  const [showImportSection, setShowImportSection] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParseCapitalTransactionsResult | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // CÁLCULOS DOS TOTAIS (Apenas transações NÃO canceladas afetam os depósitos, saques e taxas)
  const totalDeposits = transactions
    .filter((t) => t.type === 'DEPOSIT' && t.status !== 'CANCELED')
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const totalWithdrawals = transactions
    .filter((t) => t.type === 'WITHDRAWAL' && t.status !== 'CANCELED')
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const totalFees = transactions
    .filter((t) => t.status !== 'CANCELED')
    .reduce((acc, t) => acc + (Number(t.fee) || 0), 0);

  const totalCanceledCount = transactions.filter((t) => t.status === 'CANCELED').length;

  // Lógica de Seleção em Massa
  const handleToggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedTxIds.length === transactions.length) {
      setSelectedTxIds([]);
    } else {
      setSelectedTxIds(transactions.map((t) => t.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedTxIds.length === 0) return;
    if (
      window.confirm(
        `Deseja realmente excluir permanentemente as ${selectedTxIds.length} movimentações selecionadas?`
      )
    ) {
      if (onDeleteMultipleTransactions) {
        onDeleteMultipleTransactions(selectedTxIds);
      } else {
        selectedTxIds.forEach((id) => onDeleteTransaction(id));
      }
      setSelectedTxIds([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return;

    const numFee = Number(fee);
    const finalBroker = broker === 'Outra' ? customBroker.trim() || 'Outra Corretora' : broker;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newTx: CapitalTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: activeType,
      amount: numAmount,
      fee: !isNaN(numFee) && numFee > 0 ? numFee : undefined,
      date: date || getLocalDateStr(),
      time: timeStr,
      broker: finalBroker,
      notes: notes.trim(),
      status,
    };

    onAddTransaction(newTx);

    // Reset form
    setAmount('');
    setFee('');
    setNotes('');
    setStatus('COMPLETED');
    setShowFeeInput(false);
    setShowAddForm(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsReadingFile(true);
    setParsedResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = parseCapitalTransactionsCsv(content);
        setParsedResult(res);
      }
      setIsReadingFile(false);
    };
    reader.onerror = () => {
      setParsedResult({
        transactions: [],
        errors: ['Erro ao ler o arquivo CSV.'],
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalFees: 0,
        canceledCount: 0,
      });
      setIsReadingFile(false);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!parsedResult || parsedResult.transactions.length === 0) return;
    parsedResult.transactions.forEach((tx) => {
      onAddTransaction(tx);
    });
    const canceledMsg = parsedResult.canceledCount > 0 ? ` (${parsedResult.canceledCount} canceladas desconsideradas do saldo)` : '';
    alert(`✅ ${parsedResult.transactions.length} movimentações de capital importadas com sucesso!${canceledMsg}`);
    setParsedResult(null);
    setFileName('');
    setShowImportSection(false);
  };

  const renderStatusBadge = (txStatus?: CapitalTransactionStatus) => {
    if (txStatus === 'CANCELED') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-rose-950/60 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-800/60">
          <Ban className="h-3 w-3 text-rose-400 shrink-0" /> Cancelado
        </span>
      );
    }
    if (txStatus === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-800/60">
          <Clock className="h-3 w-3 text-amber-400 shrink-0" /> Pendente
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/60">
        <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" /> Concluído
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm pt-safe pb-safe overflow-y-auto">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-800 bg-black shadow-2xl my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5 shrink-0 bg-black/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-md">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Gestão de Capital & Movimentações
              </h3>
              <p className="text-xs text-slate-400">
                Histórico de saques, depósitos, comissões e controle de status
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
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Capital Atual */}
            <div className="rounded-xl border border-slate-800 bg-black/60 p-3 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Capital Atual Total
              </span>
              <div className="text-base sm:text-lg font-black font-mono text-white">
                {formatCurrency(currentCapital)}
              </div>
              <p className="text-[10px] text-slate-500">Saldo atual da banca</p>
            </div>

            {/* Total Depósitos */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5" /> Depósitos
              </span>
              <div className="text-base sm:text-lg font-black font-mono text-emerald-400">
                +{formatCurrency(totalDeposits)}
              </div>
              <p className="text-[10px] text-slate-400">Apenas concluídos</p>
            </div>

            {/* Total Saques */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <ArrowDownRight className="h-3.5 w-3.5" /> Saques
              </span>
              <div className="text-base sm:text-lg font-black font-mono text-amber-400">
                -{formatCurrency(totalWithdrawals)}
              </div>
              <p className="text-[10px] text-slate-400">Apenas concluídos</p>
            </div>

            {/* Total Taxas das Corretoras */}
            <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5" /> Taxas / Comissões
              </span>
              <div className="text-base sm:text-lg font-black font-mono text-rose-400">
                {formatCurrency(totalFees)}
              </div>
              <p className="text-[10px] text-slate-400">Custo de saques / taxas</p>
            </div>
          </div>

          {/* Action Bar (Novo Saque / Depósito / Importar CSV / Seleção em Massa) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-4">
            <div className="flex items-center gap-2">
              {transactions.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 font-medium text-xs transition cursor-pointer"
                  title="Selecionar Todos"
                >
                  {selectedTxIds.length === transactions.length ? (
                    <CheckSquare className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span>Selecionar Todos ({selectedTxIds.length}/{transactions.length})</span>
                </button>
              )}

              {selectedTxIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer animate-pulse"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir Selecionados ({selectedTxIds.length})
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportSection(!showImportSection);
                  setShowAddForm(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" /> 📥 Importar CSV
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveType('DEPOSIT');
                  setShowAddForm(true);
                  setShowImportSection(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer"
              >
                <PlusCircle className="h-3.5 w-3.5" /> + Depósito
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveType('WITHDRAWAL');
                  setShowAddForm(true);
                  setShowImportSection(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer"
              >
                <MinusCircle className="h-3.5 w-3.5" /> - Saque
              </button>
            </div>
          </div>

          {/* CSV Import Drawer */}
          {showImportSection && (
            <div className="p-4 rounded-xl border border-blue-500/40 bg-blue-950/20 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-blue-500/30">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-blue-400" />
                  Importar Histórico de Depósitos & Saques (CSV com Status e Taxas)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowImportSection(false);
                    setParsedResult(null);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Upload Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 rounded-xl border-2 border-dashed border-blue-500/40 bg-black/60 hover:bg-blue-950/30 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="h-7 w-7 text-blue-400 animate-bounce" />
                <span className="text-xs font-bold text-white">
                  {fileName ? `Arquivo: ${fileName}` : 'Clique para selecionar seu arquivo CSV'}
                </span>
                <span className="text-[10px] text-slate-400">
                  Identifica automaticamente saques/depósitos, taxas/comissões e descarta movimentações com status de <strong className="text-rose-400 font-bold">cancelado/recusado</strong> dos cálculos da banca.
                </span>
              </div>

              {isReadingFile && (
                <div className="text-center py-3 text-blue-400 font-mono font-bold animate-pulse">
                  Processando arquivo CSV...
                </div>
              )}

              {/* Errors (if any) */}
              {parsedResult && parsedResult.errors.length > 0 && (
                <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-rose-400" /> Erro de Leitura:
                  </div>
                  {parsedResult.errors.map((err, i) => (
                    <p key={i} className="text-[11px]">{err}</p>
                  ))}
                </div>
              )}

              {/* Preview Summary */}
              {parsedResult && parsedResult.transactions.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-black/80 p-3 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-mono">Movimentações</span>
                      <span className="text-sm font-bold text-white font-mono">
                        {parsedResult.transactions.length} Lançamentos
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-400 block font-mono">Total Depósitos</span>
                      <span className="text-sm font-bold text-emerald-400 font-mono">
                        +{formatCurrency(parsedResult.totalDeposits)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-400 block font-mono">Total Saques</span>
                      <span className="text-sm font-bold text-amber-400 font-mono">
                        -{formatCurrency(parsedResult.totalWithdrawals)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-rose-400 block font-mono">Taxas / Comissões</span>
                      <span className="text-sm font-bold text-rose-400 font-mono">
                        {formatCurrency(parsedResult.totalFees)}
                      </span>
                    </div>
                  </div>

                  {/* Canceled Banner if any */}
                  {parsedResult.canceledCount > 0 && (
                    <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-950/20 text-amber-300 text-xs font-semibold flex items-center gap-2">
                      <Ban className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>
                        <strong>{parsedResult.canceledCount} movimentação(ões) cancelada(s)</strong> foram identificadas. Elas serão importadas com a tag <span className="text-rose-400 font-bold">Cancelado 🛑</span> e <strong>não afetam o saldo da banca</strong>.
                      </span>
                    </div>
                  )}

                  {/* Preview Table */}
                  <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-lg bg-black/40 p-2">
                    <table className="w-full text-left text-[11px]">
                      <thead className="border-b border-slate-800 text-slate-400 font-bold uppercase">
                        <tr>
                          <th className="p-1">Tipo</th>
                          <th className="p-1">Data</th>
                          <th className="p-1">Corretora</th>
                          <th className="p-1">Status</th>
                          <th className="p-1 text-right">Taxa (R$)</th>
                          <th className="p-1 text-right">Valor (R$)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {parsedResult.transactions.slice(0, 15).map((t, idx) => {
                          const isCanceled = t.status === 'CANCELED';
                          return (
                            <tr key={idx} className={isCanceled ? 'opacity-60 bg-rose-950/10' : ''}>
                              <td className={`p-1 font-bold ${t.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {t.type === 'DEPOSIT' ? 'Depósito' : 'Saque'}
                              </td>
                              <td className="p-1 font-mono text-slate-300">{formatDate(t.date)}</td>
                              <td className="p-1 text-slate-300">{t.broker}</td>
                              <td className="p-1">{renderStatusBadge(t.status)}</td>
                              <td className="p-1 text-right font-mono text-rose-400">
                                {t.fee && t.fee > 0 ? formatCurrency(t.fee) : '-'}
                              </td>
                              <td className={`p-1 text-right font-mono font-bold ${isCanceled ? 'line-through text-slate-500' : t.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {t.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(t.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {parsedResult.transactions.length > 15 && (
                      <p className="text-[10px] text-center text-slate-500 pt-1">
                        ...e mais {parsedResult.transactions.length - 15} lançamentos.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setParsedResult(null)}
                      className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      className="px-4 py-1.5 font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition shadow-md flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmar Importação ({parsedResult.transactions.length})
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add Transaction Form Drawer */}
          {showAddForm && (
            <form
              onSubmit={handleSubmit}
              className="p-4 rounded-xl border border-slate-700 bg-black space-y-3 animate-fadeIn"
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

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
                      className="w-full rounded-xl border border-slate-800 bg-black pl-10 pr-3 py-2 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Corretora */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Corretora</label>
                  <select
                    value={broker}
                    onChange={(e) => setBroker(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-white focus:border-emerald-500 focus:outline-none font-medium"
                  >
                    {DEFAULT_BROKERS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CapitalTransactionStatus)}
                    className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-white focus:border-emerald-500 focus:outline-none font-medium"
                  >
                    <option value="COMPLETED">Concluído 🟢</option>
                    <option value="PENDING">Pendente 🟡</option>
                    <option value="CANCELED">Cancelado 🛑 (Fora do Saldo)</option>
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
                    className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-white focus:border-emerald-500 focus:outline-none font-medium"
                  />
                </div>
              </div>

              {/* Botão Nano Modal / Toggle para Taxa de Saque */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowFeeInput(!showFeeInput)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-950/30 text-[11px] font-bold text-amber-300 hover:bg-amber-900/40 transition"
                >
                  <Percent className="h-3.5 w-3.5 text-amber-400" />
                  {showFeeInput ? 'Ocultar Campo de Taxa' : '+ Registrar Taxa / Comissão da Corretora'}
                </button>
              </div>

              {/* Campo de Taxa da Corretora */}
              {showFeeInput && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 space-y-1">
                  <label className="block font-semibold text-amber-300 text-xs">
                    Taxa da Corretora / Comissão de Saque (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 font-mono font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0,00 (Ex: comissão ou taxa cobrada)"
                      value={fee}
                      onChange={(e) => setFee(e.target.value)}
                      className="w-full rounded-xl border border-amber-500/40 bg-black pl-10 pr-3 py-1.5 text-white font-mono text-xs font-bold focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-amber-400/80">
                    A taxa será descontada automaticamente do saldo total da conta.
                  </p>
                </div>
              )}

              {/* Custom Broker if 'Outra' */}
              {broker === 'Outra' && (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Nome da Corretora</label>
                  <input
                    type="text"
                    placeholder="Ex: Pocket Option, Deriv..."
                    value={customBroker}
                    onChange={(e) => setCustomBroker(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-white focus:border-emerald-500 focus:outline-none font-medium"
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
                  className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
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
            <div className="py-12 text-center text-slate-400 space-y-2 border border-slate-800/80 rounded-xl bg-black/40">
              <Building2 className="mx-auto h-8 w-8 text-slate-600" />
              <p className="font-semibold text-slate-300">Nenhum depósito ou saque registrado ainda.</p>
              <p className="text-xs text-slate-500">
                Utilize os botões acima para cadastrar ou importar saques e depósitos das corretoras.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {transactions
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((t) => {
                  const isDeposit = t.type === 'DEPOSIT';
                  const isCanceled = t.status === 'CANCELED';
                  const isSelected = selectedTxIds.includes(t.id);
                  const hasFee = Boolean(t.fee && t.fee > 0);

                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition ${
                        isSelected
                          ? 'border-blue-500/60 bg-blue-950/20'
                          : isCanceled
                          ? 'border-slate-800/50 bg-black/30 opacity-75'
                          : 'border-slate-800/80 bg-black/50 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox de Seleção em Massa */}
                        <button
                          type="button"
                          onClick={() => handleToggleSelectTx(t.id)}
                          className="text-slate-400 hover:text-white transition p-0.5 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-blue-400" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-600 hover:text-slate-400" />
                          )}
                        </button>

                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                            isCanceled
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : isDeposit
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {isCanceled ? (
                            <Ban className="h-4 w-4 text-rose-400" />
                          ) : isDeposit ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`font-bold text-xs ${
                                isCanceled
                                  ? 'text-rose-400 line-through'
                                  : isDeposit
                                  ? 'text-emerald-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              {isDeposit ? 'Depósito' : 'Saque'}
                            </span>
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 font-medium">
                              {t.broker || 'Corretora'}
                            </span>
                            {renderStatusBadge(t.status)}
                            {hasFee && (
                              <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300 border border-rose-500/30">
                                Taxa: {formatCurrency(t.fee!)}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {formatDate(t.date)} {t.time ? `às ${t.time}` : ''}
                            {t.notes ? ` • ${t.notes}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span
                            className={`font-mono font-bold text-sm block ${
                              isCanceled
                                ? 'line-through text-slate-500'
                                : isDeposit
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {isDeposit ? '+' : '-'}
                            {formatCurrency(t.amount)}
                          </span>
                          {hasFee && !isCanceled && (
                            <span className="text-[10px] font-mono text-slate-400 block">
                              Total: {formatCurrency(isDeposit ? t.amount - t.fee! : t.amount + t.fee!)}
                            </span>
                          )}
                          {isCanceled && (
                            <span className="text-[9px] font-mono text-rose-400 block font-bold">
                              (Desconsiderado)
                            </span>
                          )}
                        </div>
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

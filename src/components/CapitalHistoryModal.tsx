import React, { useState, useRef, useMemo } from 'react';
import {
  ArrowLeft,
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
  Search,
  Filter,
  RefreshCw,
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

  // Filtros e Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELED' | 'PENDING'>('ALL');

  // Seleção e Exclusão em Massa
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

  // Lista Filtrada
  const filteredTransactions = transactions
    .filter((t) => {
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
      const txStatus = t.status || 'COMPLETED';
      if (statusFilter !== 'ALL' && txStatus !== statusFilter) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesBroker = (t.broker || '').toLowerCase().includes(term);
        const matchesNotes = (t.notes || '').toLowerCase().includes(term);
        const matchesDate = (t.date || '').includes(term);
        const matchesAmount = (t.amount || 0).toString().includes(term);
        return matchesBroker || matchesNotes || matchesDate || matchesAmount;
      }

      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  // Lógica de Seleção em Massa
  const handleToggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedTxIds.length === filteredTransactions.length) {
      setSelectedTxIds([]);
    } else {
      setSelectedTxIds(filteredTransactions.map((t) => t.id));
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
        <span className="inline-flex items-center gap-1 rounded bg-rose-950/60 px-2 py-0.5 text-xs font-bold text-rose-400 border border-rose-800/60">
          <Ban className="h-3.5 w-3.5 text-rose-400 shrink-0" /> Cancelado (Fora do Saldo)
        </span>
      );
    }
    if (txStatus === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-950/60 px-2 py-0.5 text-xs font-bold text-amber-400 border border-amber-800/60">
          <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" /> Pendente
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/60 px-2 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-800/60">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> Concluído
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col overflow-hidden w-screen h-screen">
      {/* Top Header Bar - Full Screen Style */}
      <div className="border-b border-slate-800 bg-black px-4 sm:px-8 py-4 flex items-center justify-between shrink-0 shadow-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 font-bold text-xs transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao Diário de Trade
          </button>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-md">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                Gestão de Capital & Movimentações
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Controle integral de saques, depósitos, comissões de corretoras e extratos de conta
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            title="Fechar Tela"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Workspace Body - Occupies 100% space */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 w-full max-w-[1920px] mx-auto">
        {/* KPI Cards Grid - Spans 100% Width */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Capital Atual */}
          <div className="rounded-2xl border border-slate-800 bg-black/80 p-5 space-y-2 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Capital Atual Total
              </span>
              <Building2 className="h-5 w-5 text-slate-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-white">
              {formatCurrency(currentCapital)}
            </div>
            <p className="text-xs text-slate-500 font-medium">Saldo total disponível na banca</p>
          </div>

          {/* Total Depósitos */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 space-y-2 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <ArrowUpRight className="h-4 w-4" /> Total Depósitos
              </span>
              <PlusCircle className="h-5 w-5 text-emerald-400/80" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
              +{formatCurrency(totalDeposits)}
            </div>
            <p className="text-xs text-emerald-400/70 font-medium">Apenas transações concluídas</p>
          </div>

          {/* Total Saques */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-2 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <ArrowDownRight className="h-4 w-4" /> Total Saques
              </span>
              <MinusCircle className="h-5 w-5 text-amber-400/80" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
              -{formatCurrency(totalWithdrawals)}
            </div>
            <p className="text-xs text-amber-400/70 font-medium">Apenas transações concluídas</p>
          </div>

          {/* Total Taxas das Corretoras */}
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-5 space-y-2 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <Receipt className="h-4 w-4" /> Taxas / Comissões
              </span>
              <Percent className="h-5 w-5 text-rose-400/80" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-rose-400">
              {formatCurrency(totalFees)}
            </div>
            <p className="text-xs text-rose-400/70 font-medium">Custo total cobrado pelas corretoras</p>
          </div>
        </div>

        {/* Action & Filter Toolbar */}
        <div className="rounded-2xl border border-slate-800 bg-black/80 p-4 sm:p-5 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Lado Esquerdo: Busca e Filtros */}
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por corretora, observação, valor ou data..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-black pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none font-medium"
                />
              </div>

              {/* Filtro por Tipo */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="rounded-xl border border-slate-800 bg-black px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none font-bold"
              >
                <option value="ALL">Todos os Tipos</option>
                <option value="DEPOSIT">Apenas Depósitos</option>
                <option value="WITHDRAWAL">Apenas Saques</option>
              </select>

              {/* Filtro por Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="rounded-xl border border-slate-800 bg-black px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none font-bold"
              >
                <option value="ALL">Todos os Status</option>
                <option value="COMPLETED">Apenas Concluídos 🟢</option>
                <option value="CANCELED">Apenas Cancelados 🛑</option>
                <option value="PENDING">Apenas Pendentes 🟡</option>
              </select>
            </div>

            {/* Lado Direito: Ações Principais */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportSection(!showImportSection);
                  setShowAddForm(false);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer"
              >
                <Upload className="h-4 w-4" /> 📥 Importar CSV
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveType('DEPOSIT');
                  setShowAddForm(true);
                  setShowImportSection(false);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" /> + Novo Depósito
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveType('WITHDRAWAL');
                  setShowAddForm(true);
                  setShowImportSection(false);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer"
              >
                <MinusCircle className="h-4 w-4" /> - Novo Saque
              </button>
            </div>
          </div>

          {/* Seleção em Massa Actions Bar */}
          {transactions.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  {selectedTxIds.length === filteredTransactions.length && filteredTransactions.length > 0 ? (
                    <CheckSquare className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Square className="h-4 w-4 text-slate-400" />
                  )}
                  <span>Selecionar Todos ({selectedTxIds.length}/{filteredTransactions.length})</span>
                </button>

                {selectedTxIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-2 px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer animate-pulse"
                  >
                    <Trash2 className="h-4 w-4" /> Excluir Selecionados ({selectedTxIds.length})
                  </button>
                )}
              </div>

              <span className="text-xs text-slate-400 font-mono">
                Exibindo <strong>{filteredTransactions.length}</strong> de <strong>{transactions.length}</strong> lançamentos
              </span>
            </div>
          )}
        </div>

        {/* CSV Import Drawer Section */}
        {showImportSection && (
          <div className="p-6 rounded-2xl border border-blue-500/40 bg-blue-950/20 space-y-4 animate-fadeIn shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-blue-500/30">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-blue-400" />
                Importar Extrato de Depósitos & Saques (CSV com Status e Comissões)
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowImportSection(false);
                  setParsedResult(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Upload Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 rounded-2xl border-2 border-dashed border-blue-500/40 bg-black/80 hover:bg-blue-950/30 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="h-8 w-8 text-blue-400 animate-bounce" />
              <span className="text-sm font-bold text-white">
                {fileName ? `Arquivo selecionado: ${fileName}` : 'Clique para selecionar seu arquivo CSV'}
              </span>
              <span className="text-xs text-slate-400 max-w-xl">
                Suporta extratos da Exnova, Quotex, IQ Option, Binance, XP, Clear, etc. Detecta automaticamente taxas, saques, depósitos e desconsidera registros <strong className="text-rose-400 font-bold">cancelados</strong> do cálculo da banca.
              </span>
            </div>

            {isReadingFile && (
              <div className="text-center py-4 text-blue-400 font-mono font-bold animate-pulse">
                Processando e validando arquivo CSV...
              </div>
            )}

            {/* Errors (if any) */}
            {parsedResult && parsedResult.errors.length > 0 && (
              <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs space-y-1">
                <div className="font-bold flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-rose-400" /> Erro de Leitura:
                </div>
                {parsedResult.errors.map((err, i) => (
                  <p key={i} className="text-xs font-mono">{err}</p>
                ))}
              </div>
            )}

            {/* Preview Summary */}
            {parsedResult && parsedResult.transactions.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/90 p-4 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-xs text-slate-400 block font-mono">Movimentações Detectadas</span>
                    <span className="text-base font-bold text-white font-mono">
                      {parsedResult.transactions.length} Lançamentos
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-emerald-400 block font-mono">Total Depósitos</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      +{formatCurrency(parsedResult.totalDeposits)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-amber-400 block font-mono">Total Saques</span>
                    <span className="text-base font-bold text-amber-400 font-mono">
                      -{formatCurrency(parsedResult.totalWithdrawals)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-rose-400 block font-mono">Taxas / Comissões</span>
                    <span className="text-base font-bold text-rose-400 font-mono">
                      {formatCurrency(parsedResult.totalFees)}
                    </span>
                  </div>
                </div>

                {/* Canceled Banner */}
                {parsedResult.canceledCount > 0 && (
                  <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-300 text-xs font-semibold flex items-center gap-3">
                    <Ban className="h-5 w-5 text-amber-400 shrink-0" />
                    <span>
                      <strong>{parsedResult.canceledCount} movimentação(ões) cancelada(s)</strong> foram identificadas. Elas serão importadas com a tag <span className="text-rose-400 font-bold">Cancelado 🛑</span> e <strong>não afetam o saldo da banca</strong>.
                    </span>
                  </div>
                )}

                {/* Preview Table */}
                <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl bg-black/60 p-3">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-slate-400 font-bold uppercase">
                      <tr>
                        <th className="p-2">Tipo</th>
                        <th className="p-2">Data</th>
                        <th className="p-2">Corretora</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 text-right">Taxa (R$)</th>
                        <th className="p-2 text-right">Valor (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {parsedResult.transactions.slice(0, 20).map((t, idx) => {
                        const isCanceled = t.status === 'CANCELED';
                        return (
                          <tr key={idx} className={isCanceled ? 'opacity-60 bg-rose-950/10' : ''}>
                            <td className={`p-2 font-bold ${t.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {t.type === 'DEPOSIT' ? 'Depósito' : 'Saque'}
                            </td>
                            <td className="p-2 font-mono text-slate-300">{formatDate(t.date)}</td>
                            <td className="p-2 text-slate-300">{t.broker}</td>
                            <td className="p-2">{renderStatusBadge(t.status)}</td>
                            <td className="p-2 text-right font-mono text-rose-400">
                              {t.fee && t.fee > 0 ? formatCurrency(t.fee) : '-'}
                            </td>
                            <td className={`p-2 text-right font-mono font-bold ${isCanceled ? 'line-through text-slate-500' : t.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {t.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(t.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {parsedResult.transactions.length > 20 && (
                    <p className="text-xs text-center text-slate-500 pt-2 font-mono">
                      ...e mais {parsedResult.transactions.length - 20} lançamentos.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setParsedResult(null)}
                    className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition shadow-md flex items-center gap-2 text-xs cursor-pointer"
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
            className="p-6 rounded-2xl border border-slate-800 bg-black space-y-4 animate-fadeIn shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                {activeType === 'DEPOSIT' ? (
                  <ArrowUpRight className="h-5 w-5 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-amber-400" />
                )}
                {activeType === 'DEPOSIT' ? 'Registrar Novo Depósito' : 'Registrar Novo Saque'}
              </span>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {/* Valor */}
              <div>
                <label className="block font-bold text-slate-300 mb-1 text-xs">Valor (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-mono font-bold text-slate-400 text-xs">R$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-black pl-10 pr-3 py-2 text-white font-mono font-bold text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Corretora */}
              <div>
                <label className="block font-bold text-slate-300 mb-1 text-xs">Corretora</label>
                <select
                  value={broker}
                  onChange={(e) => setBroker(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-white focus:border-emerald-500 focus:outline-none font-bold text-xs"
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
                <label className="block font-bold text-slate-300 mb-1 text-xs">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CapitalTransactionStatus)}
                  className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-white focus:border-emerald-500 focus:outline-none font-bold text-xs"
                >
                  <option value="COMPLETED">Concluído 🟢</option>
                  <option value="PENDING">Pendente 🟡</option>
                  <option value="CANCELED">Cancelado 🛑 (Fora do Saldo)</option>
                </select>
              </div>

              {/* Data */}
              <div>
                <label className="block font-bold text-slate-300 mb-1 text-xs">Data</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-white focus:border-emerald-500 focus:outline-none font-bold text-xs"
                />
              </div>
            </div>

            {/* Toggle para Taxa de Saque */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowFeeInput(!showFeeInput)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-950/30 text-xs font-bold text-amber-300 hover:bg-amber-900/40 transition cursor-pointer"
              >
                <Percent className="h-4 w-4 text-amber-400" />
                {showFeeInput ? 'Ocultar Campo de Taxa' : '+ Registrar Taxa / Comissão da Corretora'}
              </button>
            </div>

            {/* Campo de Taxa da Corretora */}
            {showFeeInput && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 space-y-2">
                <label className="block font-bold text-amber-300 text-xs">
                  Taxa da Corretora / Comissão de Saque (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 font-mono font-bold text-slate-400 text-xs">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0,00 (Ex: comissão ou taxa cobrada)"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    className="w-full rounded-xl border border-amber-500/40 bg-black pl-10 pr-3 py-2 text-white font-mono text-xs font-bold focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-amber-400/80 font-medium">
                  A taxa será descontada automaticamente do saldo total da conta.
                </p>
              </div>
            )}

            {/* Custom Broker if 'Outra' */}
            {broker === 'Outra' && (
              <div>
                <label className="block font-bold text-slate-300 mb-1 text-xs">Nome da Corretora</label>
                <input
                  type="text"
                  placeholder="Ex: Pocket Option, Deriv..."
                  value={customBroker}
                  onChange={(e) => setCustomBroker(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-white focus:border-emerald-500 focus:outline-none font-bold text-xs"
                />
              </div>
            )}

            {/* Observações */}
            <div>
              <label className="block font-bold text-slate-300 mb-1 text-xs">Observações (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: Saque de lucros da semana PIX / Transferência"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-white focus:border-emerald-500 focus:outline-none font-medium text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`px-5 py-2 font-bold text-white rounded-xl transition shadow-md text-xs cursor-pointer ${
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

        {/* Transactions Table - Full Width Space */}
        <div className="rounded-2xl border border-slate-800 bg-black/80 shadow-2xl overflow-hidden">
          {filteredTransactions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <Building2 className="mx-auto h-10 w-10 text-slate-600" />
              <p className="font-bold text-slate-300 text-sm">Nenhum depósito ou saque encontrado com os filtros atuais.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Utilize os botões acima para cadastrar novos saques/depósitos ou importar arquivos CSV.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-black uppercase tracking-wider">
                  <tr>
                    <th className="p-4 w-12 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-slate-400 hover:text-white transition cursor-pointer"
                      >
                        {selectedTxIds.length === filteredTransactions.length && filteredTransactions.length > 0 ? (
                          <CheckSquare className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-500" />
                        )}
                      </button>
                    </th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Data & Hora</th>
                    <th className="p-4">Corretora</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Taxa (R$)</th>
                    <th className="p-4 text-right">Valor Líquido (R$)</th>
                    <th className="p-4">Observações</th>
                    <th className="p-4 text-center w-16">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredTransactions.map((t) => {
                    const isDeposit = t.type === 'DEPOSIT';
                    const isCanceled = t.status === 'CANCELED';
                    const isSelected = selectedTxIds.includes(t.id);
                    const hasFee = Boolean(t.fee && t.fee > 0);

                    return (
                      <tr
                        key={t.id}
                        className={`transition ${
                          isSelected
                            ? 'bg-blue-950/30'
                            : isCanceled
                            ? 'bg-slate-950/30 opacity-70'
                            : 'hover:bg-slate-900/60'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectTx(t.id)}
                            className="text-slate-400 hover:text-white transition cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-blue-400" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-600 hover:text-slate-400" />
                            )}
                          </button>
                        </td>

                        {/* Tipo */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                                isCanceled
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  : isDeposit
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {isCanceled ? (
                                <Ban className="h-3.5 w-3.5 text-rose-400" />
                              ) : isDeposit ? (
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDownRight className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <span
                              className={`font-black uppercase tracking-wider ${
                                isCanceled
                                  ? 'text-rose-400 line-through'
                                  : isDeposit
                                  ? 'text-emerald-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              {isDeposit ? 'Depósito' : 'Saque'}
                            </span>
                          </div>
                        </td>

                        {/* Data & Hora */}
                        <td className="p-4 font-mono text-slate-300">
                          {formatDate(t.date)} {t.time ? `às ${t.time}` : ''}
                        </td>

                        {/* Corretora */}
                        <td className="p-4">
                          <span className="rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 text-slate-200 font-bold">
                            {t.broker || 'Corretora'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-4">{renderStatusBadge(t.status)}</td>

                        {/* Taxa */}
                        <td className="p-4 text-right font-mono text-rose-400 font-bold">
                          {hasFee ? formatCurrency(t.fee!) : '-'}
                        </td>

                        {/* Valor */}
                        <td className="p-4 text-right font-mono font-black text-sm">
                          <span
                            className={
                              isCanceled
                                ? 'line-through text-slate-500'
                                : isDeposit
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }
                          >
                            {isDeposit ? '+' : '-'}{formatCurrency(t.amount)}
                          </span>
                          {hasFee && !isCanceled && (
                            <span className="text-[10px] text-slate-500 block font-normal">
                              Líquido: {formatCurrency(isDeposit ? t.amount - t.fee! : t.amount + t.fee!)}
                            </span>
                          )}
                        </td>

                        {/* Observações */}
                        <td className="p-4 text-slate-400 max-w-xs truncate" title={t.notes}>
                          {t.notes || '-'}
                        </td>

                        {/* Ações */}
                        <td className="p-4 text-center">
                          <button
                            onClick={() => onDeleteTransaction(t.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                            title="Excluir Lançamento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  ListFilter,
  PlusCircle,
  Search,
  Download,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  RotateCcw,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Tag,
} from 'lucide-react';
import { Trade } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';

interface TradeListProps {
  trades: Trade[];
  onOpenNewTrade: () => void;
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
  onResetData: () => void;
}

export const TradeList: React.FC<TradeListProps> = ({
  trades,
  onOpenNewTrade,
  onEditTrade,
  onDeleteTrade,
  onResetData,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResult, setFilterResult] = useState<'ALL' | 'GAIN' | 'LOSS' | 'BREAKEVEN'>('ALL');
  const [filterAsset, setFilterAsset] = useState<string>('ALL');
  const [filterStrategy, setFilterStrategy] = useState<string>('ALL');
  const [filterPeriod, setFilterPeriod] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  // Extract unique assets & strategies
  const assets = useMemo(() => {
    return Array.from(new Set(trades.map((t) => t.asset))).filter(Boolean).sort();
  }, [trades]);

  const strategies = useMemo(() => {
    return Array.from(new Set(trades.map((t) => t.strategy))).filter(Boolean).sort();
  }, [trades]);

  // Today reference (real current date or latest trade date)
  const todayDate = useMemo(() => {
    if (trades.length > 0) {
      const sorted = [...trades].sort((a, b) => b.date.localeCompare(a.date));
      return sorted[0].date;
    }
    return new Date().toISOString().split('T')[0];
  }, [trades]);

  // Filtered trades list
  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesAsset = trade.asset.toLowerCase().includes(term);
        const matchesStrategy = trade.strategy.toLowerCase().includes(term);
        const matchesNotes = (trade.notes || '').toLowerCase().includes(term);
        if (!matchesAsset && !matchesStrategy && !matchesNotes) return false;
      }

      // Result
      if (filterResult !== 'ALL' && trade.result !== filterResult) return false;

      // Asset
      if (filterAsset !== 'ALL' && trade.asset !== filterAsset) return false;

      // Strategy
      if (filterStrategy !== 'ALL' && trade.strategy !== filterStrategy) return false;

      // Period
      if (filterPeriod === 'TODAY' && trade.date !== todayDate) return false;
      if (filterPeriod === 'MONTH') {
        const currentMonthPrefix = todayDate.substring(0, 7);
        if (!trade.date.startsWith(currentMonthPrefix)) return false;
      }

      return true;
    });
  }, [trades, searchTerm, filterResult, filterAsset, filterStrategy, filterPeriod, todayDate]);

  // Calculate totals of filtered trades
  const filteredTotals = useMemo(() => {
    let pnl = 0;
    let wins = 0;
    filteredTrades.forEach((t) => {
      pnl += Number(t.pnl) || 0;
      if (t.pnl > 0.001) wins++;
    });
    const winRate = filteredTrades.length > 0 ? (wins / filteredTrades.length) * 100 : 0;
    return { pnl, winRate, count: filteredTrades.length };
  }, [filteredTrades]);

  // Export to CSV function
  const exportToCsv = () => {
    const headers = ['Data', 'Horario', 'Ativo', 'Tipo', 'Estrategia', 'Valor_Entrada_BRL', 'Resultado', 'Lucro_Prejuizo_BRL', 'Notas'];
    const rows = filteredTrades.map((t) => [
      t.date,
      t.time || '',
      t.asset,
      t.type,
      `"${t.strategy}"`,
      t.contractsOrQuantity,
      t.result,
      t.pnl,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `trader_journal_export_${todayDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-sm">
      {/* Header & Main Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ListFilter className="h-5 w-5 text-emerald-400" />
            Diário de Operações (Histórico Detalhado)
          </h3>
          <p className="text-xs text-slate-400">
            Anotações individuais de cada entrada, saída, justificativa operacional e resultado
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportToCsv}
            title="Exportar dados filtrados para arquivo CSV"
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar CSV</span>
          </button>

          {trades.length > 0 && (
            <button
              onClick={onResetData}
              title="Limpar histórico de operações"
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-300 hover:border-rose-900/50 hover:bg-rose-950/20 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Limpar Diário</span>
            </button>
          )}

          <button
            onClick={onOpenNewTrade}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-900/30 hover:bg-emerald-500 transition"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Adicionar Trade</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar ativo, setup, nota..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Period filter */}
        <div>
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value as any)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Todos os Períodos</option>
            <option value="TODAY">Apenas Hoje ({todayDate})</option>
            <option value="MONTH">Mês Atual</option>
          </select>
        </div>

        {/* Result filter */}
        <div>
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value as any)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Todos os Resultados</option>
            <option value="GAIN">Apenas Gains (Vitórias)</option>
            <option value="LOSS">Apenas Losses (Perdas)</option>
            <option value="BREAKEVEN">Apenas Breakevens (0x0)</option>
          </select>
        </div>

        {/* Asset filter */}
        <div>
          <select
            value={filterAsset}
            onChange={(e) => setFilterAsset(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Todos os Ativos</option>
            {assets.map((asset) => (
              <option key={asset} value={asset}>
                {asset}
              </option>
            ))}
          </select>
        </div>

        {/* Strategy filter */}
        <div>
          <select
            value={filterStrategy}
            onChange={(e) => setFilterStrategy(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Todas as Estratégias</option>
            {strategies.map((strat) => (
              <option key={strat} value={strat}>
                {strat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Stats Bar */}
      <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xl bg-slate-950/60 p-3 text-xs text-slate-400 border border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <span>
            Exibindo <strong className="text-white">{filteredTrades.length}</strong> de{' '}
            {trades.length} operações
          </span>
          <span className="hidden sm:inline h-3 w-px bg-slate-800" />
          <span>
            Assertividade:{' '}
            <strong className="text-emerald-400 font-mono">
              {filteredTotals.winRate.toFixed(1)}%
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span>Subtotal Filtrado:</span>
          <strong
            className={`font-mono ${
              filteredTotals.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {filteredTotals.pnl >= 0 ? '+' : ''}
            {formatCurrency(filteredTotals.pnl)}
          </strong>
        </div>
      </div>

      {/* Mobile Card-Based Feed (Visible on Mobile & Tablet < md) */}
      <div className="mt-4 space-y-3 md:hidden">
        {filteredTrades.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
            Nenhuma operação encontrada com os filtros selecionados.
          </div>
        ) : (
          filteredTrades.map((trade) => {
            const isGain = trade.result === 'GAIN';
            const isLoss = trade.result === 'LOSS';
            const isBreakeven = trade.result === 'BREAKEVEN';

            return (
              <div
                key={trade.id}
                className="rounded-2xl border border-slate-800/90 bg-slate-950/70 p-3.5 shadow-sm space-y-2.5 transition active:scale-[0.99]"
              >
                {/* Top Row: Date, Time & PnL */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white">{formatDate(trade.date)}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{trade.time || '--:--'}</span>
                  </div>
                  <div
                    className={`font-mono font-black text-sm ${
                      isGain
                        ? 'text-emerald-400'
                        : isLoss
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {trade.pnl > 0 ? '+' : ''}
                    {formatCurrency(trade.pnl)}
                  </div>
                </div>

                {/* Middle Badges Row: Asset, Buy/Sell, Strategy, Entry */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="rounded-lg bg-slate-800 px-2 py-1 font-mono font-bold text-slate-200 border border-slate-700/60">
                    {trade.asset}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      trade.type === 'BUY'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {trade.type === 'BUY' ? (
                      <>
                        <ArrowUp className="h-3 w-3" /> Compra
                      </>
                    ) : (
                      <>
                        <ArrowDown className="h-3 w-3" /> Venda
                      </>
                    )}
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800/90 px-2 py-1 text-[11px] text-slate-300 border border-slate-700/40">
                    <Tag className="h-2.5 w-2.5 text-slate-400" />
                    {trade.strategy}
                  </span>

                  {trade.contractsOrQuantity != null && trade.contractsOrQuantity > 0 && (
                    <span className="text-[11px] text-slate-400 font-mono pl-1">
                      Entrada: {formatCurrency(trade.contractsOrQuantity)}
                    </span>
                  )}
                </div>

                {/* Notes (if any) */}
                {trade.notes && (
                  <div className="rounded-xl bg-slate-900/90 p-2.5 text-xs text-slate-300 border border-slate-800/80 leading-relaxed">
                    {trade.notes}
                  </div>
                )}

                {/* Action Buttons (Touch Target >= 40px) */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/70 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Resultado: <strong className={isGain ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-300'}>{isGain ? 'Vitória' : isLoss ? 'Derrota' : '0x0'}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEditTrade(trade)}
                      className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 active:scale-95 transition"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-slate-300" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => onDeleteTrade(trade.id)}
                      className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/50 active:scale-95 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Trades Table (Visible on md and larger) */}
      <div className="mt-4 hidden md:block overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Data / Hora</th>
              <th className="px-3 py-3">Ativo</th>
              <th className="px-3 py-3">Tipo</th>
              <th className="px-3 py-3">Estratégia</th>
              <th className="px-3 py-3">Valor de Entrada</th>
              <th className="px-3 py-3 text-right">Resultado (R$)</th>
              <th className="px-4 py-3">Observações / Setup</th>
              <th className="px-3 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {filteredTrades.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  Nenhuma operação encontrada com os filtros selecionados.
                </td>
              </tr>
            ) : (
              filteredTrades.map((trade) => {
                const isGain = trade.result === 'GAIN';
                const isLoss = trade.result === 'LOSS';
                const isBreakeven = trade.result === 'BREAKEVEN';

                return (
                  <tr
                    key={trade.id}
                    className="hover:bg-slate-800/40 transition-colors duration-150"
                  >
                    {/* Date / Time */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono font-medium text-white">{formatDate(trade.date)}</div>
                      <div className="text-[10px] text-slate-400">{trade.time || '--:--'}</div>
                    </td>

                    {/* Asset */}
                    <td className="px-3 py-3 whitespace-nowrap font-mono font-bold text-slate-200">
                      {trade.asset}
                    </td>

                    {/* Type: BUY / SELL */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          trade.type === 'BUY'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {trade.type === 'BUY' ? (
                          <>
                            <ArrowUp className="h-3 w-3" /> Compra
                          </>
                        ) : (
                          <>
                            <ArrowDown className="h-3 w-3" /> Venda
                          </>
                        )}
                      </span>
                    </td>

                    {/* Strategy */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                        <Tag className="h-2.5 w-2.5 text-slate-400" />
                        {trade.strategy}
                      </span>
                    </td>

                    {/* Entry Value */}
                    <td className="px-3 py-3 whitespace-nowrap font-mono font-semibold text-slate-300">
                      {trade.contractsOrQuantity != null && trade.contractsOrQuantity > 0
                        ? formatCurrency(trade.contractsOrQuantity)
                        : '-'}
                    </td>

                    {/* Result (R$) */}
                    <td className="px-3 py-3 whitespace-nowrap text-right">
                      <div
                        className={`font-mono font-extrabold text-sm ${
                          isGain
                            ? 'text-emerald-400'
                            : isLoss
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {trade.pnl > 0 ? '+' : ''}
                        {formatCurrency(trade.pnl)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isGain ? 'Vitória' : isLoss ? 'Derrota' : '0x0'}
                      </div>
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3 max-w-xs truncate text-slate-400 text-xs" title={trade.notes}>
                      {trade.notes || <span className="text-slate-600 italic">Sem observações</span>}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onEditTrade(trade)}
                          title="Editar Trade"
                          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTrade(trade.id)}
                          title="Excluir Trade"
                          className="rounded p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

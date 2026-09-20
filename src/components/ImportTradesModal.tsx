import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CheckSquare,
  Square,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Download,
  Sparkles,
  HelpCircle,
  Plus,
  FileType,
  Loader2,
} from 'lucide-react';
import { Trade } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import {
  parseTradeFile,
  parsePdfFile,
  PlatformPreset,
  ParsedTradeItem,
  ParseReportResult,
} from '../utils/tradeParsers';

interface ImportTradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTrades: (trades: Trade[]) => void;
}

export const ImportTradesModal: React.FC<ImportTradesModalProps> = ({
  isOpen,
  onClose,
  onImportTrades,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<PlatformPreset>('AUTO');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<'csv' | 'pdf' | null>(null);
  const [parseResult, setParseResult] = useState<ParseReportResult | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedTradeItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    setFileName(file.name);
    setIsProcessing(true);

    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    setFileType(isPdf ? 'pdf' : 'csv');

    try {
      if (isPdf) {
        // PDF: lê como ArrayBuffer
        const buffer = await file.arrayBuffer();
        const res = await parsePdfFile(buffer, selectedPreset);
        setFileContent('[PDF]');
        setParseResult(res);
        setParsedItems(res.trades);
      } else {
        // CSV/TXT/TSV: lê como texto
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('Erro ao ler o arquivo'));
          reader.readAsText(file);
        });

        if (text) {
          setFileContent(text);
          const res = parseTradeFile(text, selectedPreset);
          setParseResult(res);
          setParsedItems(res.trades);
        }
      }
    } catch (err: any) {
      setParseResult({
        trades: [],
        errors: [`Erro ao processar arquivo: ${err?.message || 'Erro desconhecido'}`],
        platformDetected: 'Erro',
        totalPnl: 0,
      });
      setParsedItems([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handlePresetChange = async (preset: PlatformPreset) => {
    setSelectedPreset(preset);
    // Re-parse apenas para CSV (PDF precisa do ArrayBuffer original)
    if (fileContent && fileContent !== '[PDF]') {
      const res = parseTradeFile(fileContent, preset);
      setParseResult(res);
      setParsedItems(res.trades);
    }
  };

  const toggleSelectAll = () => {
    const allSelected = parsedItems.every((t) => t.selected);
    setParsedItems((prev) => prev.map((t) => ({ ...t, selected: !allSelected })));
  };

  const toggleItemSelect = (id: string) => {
    setParsedItems((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleConfirmImport = () => {
    const selectedTrades = parsedItems.filter((t) => t.selected);
    if (selectedTrades.length === 0) return;

    // Convert ParsedTradeItem to standard Trade
    const cleanTrades: Trade[] = selectedTrades.map(({ selected, rawRow, ...trade }) => trade);
    onImportTrades(cleanTrades);
    onClose();
  };

  const selectedCount = parsedItems.filter((t) => t.selected).length;
  const selectedPnl = parsedItems
    .filter((t) => t.selected)
    .reduce((acc, t) => acc + t.pnl, 0);

  // Stats rápidos
  const selectedWins = parsedItems.filter((t) => t.selected && t.result === 'GAIN').length;
  const selectedLosses = parsedItems.filter((t) => t.selected && t.result === 'LOSS').length;
  const selectedBreakevens = parsedItems.filter((t) => t.selected && t.result === 'BREAKEVEN').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-md pt-safe pb-safe overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-800 bg-black/95 shadow-2xl backdrop-blur-xl my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 p-5 sm:p-6 shrink-0 bg-black/80">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 shadow-lg shadow-blue-900/40 text-white">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Importar Relatório de Performance
                </h2>
                <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-blue-300 border border-blue-500/30">
                  CSV / PDF
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Importe dezenas de trades da ProfitChart, MetaTrader 4/5 ou Exnova de uma só vez — via CSV ou PDF.
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
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1 min-h-0">
          {/* Preset Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Plataforma de Origem
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'AUTO', label: 'Auto-detectar', desc: 'Genérico CSV/PDF' },
                { key: 'PROFITCHART', label: 'ProfitChart', desc: 'Nelogica B3' },
                { key: 'METATRADER', label: 'MetaTrader 4/5', desc: 'B3 / Forex' },
                { key: 'EXNOVA', label: 'Exnova / IQ', desc: 'Opções Binárias' },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handlePresetChange(p.key as PlatformPreset)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                    selectedPreset === p.key
                      ? 'border-blue-500/60 bg-blue-950/40 text-blue-300 ring-2 ring-blue-500/30 shadow-lg font-bold'
                      : 'border-slate-800 bg-black/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xs font-bold">{p.label}</span>
                  <span className="text-[10px] opacity-75 mt-0.5">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
              dragOver
                ? 'border-blue-500 bg-blue-950/30 scale-[1.01]'
                : fileContent
                ? 'border-emerald-500/40 bg-black/80'
                : 'border-slate-800 bg-black/50 hover:border-slate-700 hover:bg-black/80'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
                <span className="text-sm font-bold text-blue-300">Processando arquivo...</span>
                <p className="text-[11px] text-slate-400">
                  Analisando colunas, datas, valores e resultados
                </p>
              </div>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 text-blue-400 border border-slate-700 mb-3">
                  <Upload className="h-6 w-6" />
                </div>

                {fileName ? (
                  <div className="text-center">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 justify-center">
                      <CheckCircle2 className="h-4 w-4" /> Arquivo selecionado: {fileName}
                      {fileType && (
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 uppercase font-mono ml-1">
                          {fileType}
                        </span>
                      )}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Clique ou arraste outro arquivo para substituir.
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <span className="text-sm font-bold text-white">
                      Arraste seu arquivo CSV ou PDF aqui
                    </span>
                    <p className="text-xs text-slate-400 mt-1">
                      ou clique para selecionar no computador
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-3">
                      <span className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300 border border-emerald-500/20">
                        <FileSpreadsheet className="h-3 w-3" /> CSV / TXT / TSV
                      </span>
                      <span className="flex items-center gap-1 rounded-lg bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-300 border border-rose-500/20">
                        <FileType className="h-3 w-3" /> PDF
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">
                      Suporta relatórios ProfitChart, MT4, MT5 e Exnova / IQ Option
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Parsed Trades Preview */}
          {parseResult && !isProcessing && (
            <div className="space-y-4">
              {/* Summary Stats Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-800 bg-black/70">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white">
                        {parsedItems.length} trades identificados
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 font-mono">
                        {parseResult.platformDetected}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-emerald-400 font-mono font-bold">
                        {selectedWins}W
                      </span>
                      <span className="text-[11px] text-rose-400 font-mono font-bold">
                        {selectedLosses}L
                      </span>
                      {selectedBreakevens > 0 && (
                        <span className="text-[11px] text-slate-400 font-mono font-bold">
                          {selectedBreakevens}E
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        Selecione quais operações importar.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-auto">
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Resultado Selecionado
                    </span>
                    <span
                      className={`text-sm font-black font-mono ${
                        selectedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {selectedPnl >= 0 ? '+' : ''}
                      {formatCurrency(selectedPnl)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                  >
                    {parsedItems.every((t) => t.selected) ? (
                      <>
                        <CheckSquare className="h-3.5 w-3.5 text-blue-400" /> Desmarcar Todos
                      </>
                    ) : (
                      <>
                        <Square className="h-3.5 w-3.5 text-slate-400" /> Selecionar Todos
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Warnings / Errors */}
              {parseResult.errors.length > 0 && (
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/30 text-amber-200 text-xs space-y-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400" /> Avisos de Leitura:
                  </span>
                  {parseResult.errors.map((err, idx) => (
                    <p key={idx} className="text-[11px] opacity-90 pl-5">
                      • {err}
                    </p>
                  ))}
                </div>
              )}

              {/* Interactive Trades Table */}
              <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-800 bg-black/50">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-black border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 z-10">
                    <tr>
                      <th className="p-3 w-10 text-center">Importar</th>
                      <th className="p-3">Data / Hora</th>
                      <th className="p-3">Ativo</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Investimento</th>
                      <th className="p-3 text-right">Resultado (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {parsedItems.map((trade) => {
                      const isGain = trade.pnl > 0.001;
                      const isLoss = trade.pnl < -0.001;

                      return (
                        <tr
                          key={trade.id}
                          onClick={() => toggleItemSelect(trade.id)}
                          className={`cursor-pointer transition-colors ${
                            trade.selected
                              ? 'bg-blue-950/20 hover:bg-blue-950/30'
                              : 'opacity-40 hover:opacity-60 bg-black/30'
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={trade.selected}
                              onChange={() => toggleItemSelect(trade.id)}
                              className="h-4 w-4 rounded border-slate-700 bg-black text-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="p-3 whitespace-nowrap text-white font-sans">
                            {formatDate(trade.date)}{' '}
                            <span className="text-slate-400 font-mono text-[11px]">
                              {trade.time}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap font-bold text-slate-200">
                            {trade.asset}
                          </td>
                          <td className="p-3 whitespace-nowrap font-sans">
                            <span
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                trade.type === 'BUY'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {trade.type === 'BUY' ? 'CALL ↑' : 'PUT ↓'}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap text-slate-300">
                            {formatCurrency(trade.contractsOrQuantity)}
                          </td>
                          <td className="p-3 whitespace-nowrap text-right font-black">
                            <span
                              className={
                                isGain
                                  ? 'text-emerald-400'
                                  : isLoss
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                              }
                            >
                              {trade.pnl > 0 ? '+' : ''}
                              {formatCurrency(trade.pnl)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800/80 p-4 sm:p-5 shrink-0 bg-black/80">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Trades importados são salvos localmente e sincronizados no Supabase.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-800 bg-slate-800/50 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={selectedCount === 0 || isProcessing}
              onClick={handleConfirmImport}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              <span>Importar {selectedCount} Trades</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  X,
  PlusCircle,
  Check,
  ArrowUp,
  ArrowDown,
  Settings2,
  Trash2,
  Edit2,
  Plus,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { Trade, TradeType, TradeResult } from '../types';
import { isTradeProtected, getLocalDateStr } from '../utils/calculations';

interface TradeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (trade: Trade) => void;
  editingTrade?: Trade | null;
}

const DEFAULT_ASSETS = ['WIN', 'WDO', 'PETR4', 'VALE3', 'BTC/USD', 'ETH/USD', 'EUR/USD'];
const ASSETS_STORAGE_KEY = 'trader_saved_assets';

const DEFAULT_STRATEGIES = [
  'Price Action',
  'Rompimento',
  'Pullback',
  'Médias Móveis',
  'Retração Fibonacci',
  'VWAP / Reversão',
  'Order Flow / Tape Reading',
];
const STRATEGIES_STORAGE_KEY = 'trader_saved_strategies';

const DEFAULT_EMOTIONS = [
  'Calmo',
  'Confiante',
  'Neutro',
  'Ansioso',
  'Eufórico',
  'Com Medo',
  'Frustrado',
  'Irritado',
];
const EMOTIONS_STORAGE_KEY = 'trader_saved_emotions';
const LAST_EMOTION_STORAGE_KEY = 'trader_last_emotional_state';

const getLastEmotionalState = (): string => {
  try {
    const saved = localStorage.getItem(LAST_EMOTION_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return 'Calmo';
};

export const TradeFormModal: React.FC<TradeFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTrade,
}) => {
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [asset, setAsset] = useState<string>('WIN');
  const [type, setType] = useState<TradeType>('BUY');
  const [strategy, setStrategy] = useState<string>('Price Action');
  const [contractsOrQuantity, setContractsOrQuantity] = useState<number>(100);
  const [pnl, setPnl] = useState<number>(250);
  const [result, setResult] = useState<TradeResult>('GAIN');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [exitPrice, setExitPrice] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [emotionalState, setEmotionalState] = useState<string>('Neutro');
  const [accountType, setAccountType] = useState<'REAL' | 'DEMO'>('REAL');

  // Asset Management State
  const [savedAssets, setSavedAssets] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(ASSETS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return DEFAULT_ASSETS;
  });
  const [isManagingAssets, setIsManagingAssets] = useState(false);
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [newAssetInput, setNewAssetInput] = useState('');
  const [editingAssetIdx, setEditingAssetIdx] = useState<number | null>(null);
  const [editingAssetText, setEditingAssetText] = useState('');

  // Strategy Management State
  const [savedStrategies, setSavedStrategies] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STRATEGIES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return DEFAULT_STRATEGIES;
  });
  const [isManagingStrategies, setIsManagingStrategies] = useState(false);
  const [isAddingStrategyInline, setIsAddingStrategyInline] = useState(false);
  const [newStrategyInput, setNewStrategyInput] = useState('');
  const [editingStrategyIdx, setEditingStrategyIdx] = useState<number | null>(null);
  const [editingStrategyText, setEditingStrategyText] = useState('');

  // Emotional State Management State
  const [savedEmotions, setSavedEmotions] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(EMOTIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return DEFAULT_EMOTIONS;
  });
  const [isManagingEmotions, setIsManagingEmotions] = useState(false);
  const [isAddingEmotionInline, setIsAddingEmotionInline] = useState(false);
  const [newEmotionInput, setNewEmotionInput] = useState('');
  const [editingEmotionIdx, setEditingEmotionIdx] = useState<number | null>(null);
  const [editingEmotionText, setEditingEmotionText] = useState('');

  // Persist assets to localStorage
  const updateSavedAssets = (newAssets: string[]) => {
    setSavedAssets(newAssets);
    try {
      localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(newAssets));
    } catch (e) {
      console.warn('Erro ao salvar ativos no localStorage:', e);
    }
  };

  const handleAddAsset = (assetToAdd: string) => {
    const trimmed = assetToAdd.trim().toUpperCase();
    if (!trimmed) return;
    if (!savedAssets.includes(trimmed)) {
      const updated = [...savedAssets, trimmed];
      updateSavedAssets(updated);
    }
    setAsset(trimmed);
    setNewAssetInput('');
    setIsAddingInline(false);
  };

  const handleDeleteAsset = (assetToDelete: string) => {
    const updated = savedAssets.filter((a) => a !== assetToDelete);
    updateSavedAssets(updated.length > 0 ? updated : ['WIN']);
    if (asset === assetToDelete) {
      setAsset(updated[0] || 'WIN');
    }
  };

  const handleSaveEditAsset = (idx: number) => {
    const trimmed = editingAssetText.trim().toUpperCase();
    if (!trimmed) {
      setEditingAssetIdx(null);
      return;
    }
    const oldVal = savedAssets[idx];
    const updated = [...savedAssets];
    updated[idx] = trimmed;
    updateSavedAssets(updated);
    if (asset === oldVal) {
      setAsset(trimmed);
    }
    setEditingAssetIdx(null);
  };

  const handleResetAssets = () => {
    updateSavedAssets(DEFAULT_ASSETS);
  };

  // Persist strategies to localStorage
  const updateSavedStrategies = (newStrategies: string[]) => {
    setSavedStrategies(newStrategies);
    try {
      localStorage.setItem(STRATEGIES_STORAGE_KEY, JSON.stringify(newStrategies));
    } catch (e) {
      console.warn('Erro ao salvar estratégias no localStorage:', e);
    }
  };

  const handleAddStrategy = (strategyToAdd: string) => {
    const trimmed = strategyToAdd.trim();
    if (!trimmed) return;
    if (!savedStrategies.includes(trimmed)) {
      const updated = [...savedStrategies, trimmed];
      updateSavedStrategies(updated);
    }
    setStrategy(trimmed);
    setNewStrategyInput('');
    setIsAddingStrategyInline(false);
  };

  const handleDeleteStrategy = (strategyToDelete: string) => {
    const updated = savedStrategies.filter((s) => s !== strategyToDelete);
    updateSavedStrategies(updated.length > 0 ? updated : ['Price Action']);
    if (strategy === strategyToDelete) {
      setStrategy(updated[0] || 'Price Action');
    }
  };

  const handleSaveEditStrategy = (idx: number) => {
    const trimmed = editingStrategyText.trim();
    if (!trimmed) {
      setEditingStrategyIdx(null);
      return;
    }
    const oldVal = savedStrategies[idx];
    const updated = [...savedStrategies];
    updated[idx] = trimmed;
    updateSavedStrategies(updated);
    if (strategy === oldVal) {
      setStrategy(trimmed);
    }
    setEditingStrategyIdx(null);
  };

  const handleResetStrategies = () => {
    updateSavedStrategies(DEFAULT_STRATEGIES);
  };

  // Persist emotions to localStorage
  const updateSavedEmotions = (newEmotions: string[]) => {
    setSavedEmotions(newEmotions);
    try {
      localStorage.setItem(EMOTIONS_STORAGE_KEY, JSON.stringify(newEmotions));
    } catch (e) {
      console.warn('Erro ao salvar estados emocionais no localStorage:', e);
    }
  };

  const handleAddEmotion = (emotionToAdd: string) => {
    const trimmed = emotionToAdd.trim();
    if (!trimmed) return;
    if (!savedEmotions.includes(trimmed)) {
      const updated = [...savedEmotions, trimmed];
      updateSavedEmotions(updated);
    }
    setEmotionalState(trimmed);
    setNewEmotionInput('');
    setIsAddingEmotionInline(false);
  };

  const handleDeleteEmotion = (emotionToDelete: string) => {
    const updated = savedEmotions.filter((e) => e !== emotionToDelete);
    updateSavedEmotions(updated.length > 0 ? updated : ['Neutro']);
    if (emotionalState === emotionToDelete) {
      setEmotionalState(updated[0] || 'Neutro');
    }
  };

  const handleSaveEditEmotion = (idx: number) => {
    const trimmed = editingEmotionText.trim();
    if (!trimmed) {
      setEditingEmotionIdx(null);
      return;
    }
    const oldVal = savedEmotions[idx];
    const updated = [...savedEmotions];
    updated[idx] = trimmed;
    updateSavedEmotions(updated);
    if (emotionalState === oldVal) {
      setEmotionalState(trimmed);
    }
    setEditingEmotionIdx(null);
  };

  const handleResetEmotions = () => {
    updateSavedEmotions(DEFAULT_EMOTIONS);
  };

  useEffect(() => {
    if (editingTrade) {
      setDate(editingTrade.date || getLocalDateStr());
      setTime(editingTrade.time || '');
      setAsset(editingTrade.asset || savedAssets[0] || 'WIN');
      setType(editingTrade.type || 'BUY');
      setStrategy(editingTrade.strategy || savedStrategies[0] || 'Price Action');
      setContractsOrQuantity(editingTrade.contractsOrQuantity || 0);
      setPnl(editingTrade.pnl || 0);
      setResult(editingTrade.result || 'GAIN');
      setEntryPrice(editingTrade.entryPrice ? String(editingTrade.entryPrice) : '');
      setExitPrice(editingTrade.exitPrice ? String(editingTrade.exitPrice) : '');
      setNotes(editingTrade.notes || '');
      setEmotionalState(editingTrade.emotionalState || getLastEmotionalState());
      setAccountType(editingTrade.accountType || (editingTrade.isReal === false ? 'DEMO' : 'REAL'));
    } else {
      // Default new trade: real today's date and clean values
      const now = new Date();
      const todayStr = getLocalDateStr(now);
      setDate(todayStr);
      setTime(
        `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}`
      );
      setAsset(savedAssets[0] || 'WIN');
      setType('BUY');
      setStrategy(savedStrategies[0] || 'Price Action');
      setContractsOrQuantity(0);
      setPnl(0);
      setResult('GAIN');
      setEntryPrice('');
      setExitPrice('');
      setNotes('');
      setEmotionalState(getLastEmotionalState());
      setAccountType('REAL');
    }
  }, [editingTrade, isOpen]);

  if (!isOpen) return null;

  const isEditingProtected = Boolean(editingTrade && isTradeProtected(editingTrade));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Determine result status if not manually set
    let finalResult = result;
    if (pnl > 0.001) finalResult = 'GAIN';
    else if (pnl < -0.001) finalResult = 'LOSS';
    else finalResult = 'BREAKEVEN';

    const normalizedAsset = asset.trim().toUpperCase() || 'WIN';
    const normalizedStrategy = strategy.trim() || 'Price Action';

    // Auto-save asset to saved assets list if not already there
    if (!savedAssets.includes(normalizedAsset)) {
      updateSavedAssets([...savedAssets, normalizedAsset]);
    }

    // Auto-save strategy to saved strategies list if not already there
    if (!savedStrategies.includes(normalizedStrategy)) {
      updateSavedStrategies([...savedStrategies, normalizedStrategy]);
    }

    const normalizedEmotion = emotionalState.trim() || getLastEmotionalState();
    if (!savedEmotions.includes(normalizedEmotion)) {
      updateSavedEmotions([...savedEmotions, normalizedEmotion]);
    }
    try {
      localStorage.setItem(LAST_EMOTION_STORAGE_KEY, normalizedEmotion);
    } catch (e) {
      console.warn(e);
    }

    const currentDateStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // If editing a protected trade, keep original financial values unchanged!
    const tradeData: Trade = {
      id: editingTrade?.id || `trade-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: isEditingProtected && editingTrade ? editingTrade.date : (date || currentDateStr),
      time: isEditingProtected && editingTrade ? editingTrade.time : (time || currentTimeStr),
      asset: normalizedAsset,
      type: isEditingProtected && editingTrade ? editingTrade.type : type,
      strategy: normalizedStrategy,
      result: isEditingProtected && editingTrade ? editingTrade.result : finalResult,
      pnl: isEditingProtected && editingTrade ? editingTrade.pnl : (Number(pnl) || 0),
      contractsOrQuantity: isEditingProtected && editingTrade ? editingTrade.contractsOrQuantity : (Number(contractsOrQuantity) || 0),
      entryPrice: isEditingProtected && editingTrade ? editingTrade.entryPrice : (entryPrice ? Number(entryPrice) : undefined),
      exitPrice: isEditingProtected && editingTrade ? editingTrade.exitPrice : (exitPrice ? Number(exitPrice) : undefined),
      notes: notes.trim(),
      emotionalState: normalizedEmotion,
      accountType: isEditingProtected && editingTrade ? editingTrade.accountType : accountType,
      isReal: isEditingProtected && editingTrade ? (editingTrade.isReal !== false) : (accountType === 'REAL'),
      isAutoCaptured: editingTrade?.isAutoCaptured,
    };

    onSave(tradeData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto pt-safe pb-safe">
      <div className="relative w-full max-w-xl max-h-[94vh] flex flex-col rounded-2xl border border-slate-800 bg-black shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5 shrink-0">
          <div className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              {editingTrade ? 'Editar Operação' : 'Registrar Nova Operação'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {/* Protected Trade Warning Banner */}
          {isEditingProtected && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3.5 text-amber-200 text-xs flex items-start gap-2.5">
              <ShieldCheck className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-amber-300 font-bold">Operação de Conta Real Protegida 🔒</strong>
                <span className="leading-relaxed">
                  Os valores de entrada, resultado líquido (P&L em R$) e dados financeiros desta operação foram capturados/importados da corretora e são **estritamente imutáveis** para garantir que o controle de risco e a Trava Anti-Fúria não sejam burlados. Você pode atualizar apenas a estratégia, anotações e estado emocional.
                </span>
              </div>
            </div>
          )}
          {/* Row 1: Date & Time & Account Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-300">Data do Trade</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-300">Horário</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-300">Tipo de Conta</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={isEditingProtected}
                  onClick={() => setAccountType('REAL')}
                  className={`flex items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-bold transition ${
                    isEditingProtected ? 'cursor-not-allowed opacity-60' : ''
                  } ${
                    accountType === 'REAL'
                      ? 'bg-rose-950/80 border border-rose-500/60 text-rose-200 shadow-sm'
                      : 'border border-slate-800 bg-black text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="h-3 w-3 text-rose-400" />
                  <span>Real 🔒</span>
                </button>
                <button
                  type="button"
                  disabled={isEditingProtected}
                  onClick={() => setAccountType('DEMO')}
                  className={`flex items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-bold transition ${
                    isEditingProtected ? 'cursor-not-allowed opacity-60' : ''
                  } ${
                    accountType === 'DEMO'
                      ? 'bg-slate-800 border border-slate-700 text-white shadow-sm'
                      : 'border border-slate-800 bg-black text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Demo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Asset & Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Asset Section with Editing & Adding Capabilities */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-300">Ativo Negociado</label>
                <button
                  type="button"
                  onClick={() => setIsManagingAssets(!isManagingAssets)}
                  className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition font-medium"
                >
                  <Settings2 className="h-3 w-3" />
                  {isManagingAssets ? 'Fechar' : 'Gerenciar / Editar'}
                </button>
              </div>

              {/* Main Asset Text Input */}
              <input
                type="text"
                required
                placeholder="Ex: WIN, WDO, PETR4, BTC..."
                value={asset}
                onChange={(e) => setAsset(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-white uppercase focus:border-emerald-500 focus:outline-none font-mono font-bold tracking-wider"
              />

              {/* Quick Asset Chips */}
              {!isManagingAssets && (
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Ativos rápidos:</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingInline(true)}
                      className="flex items-center gap-0.5 text-emerald-400 hover:underline font-medium"
                    >
                      <Plus className="h-2.5 w-2.5" /> + Novo
                    </button>
                  </div>

                  {/* Inline Add Input */}
                  {isAddingInline && (
                    <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black border border-emerald-500/40">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Nome (ex: AAPL, SOL)"
                        value={newAssetInput}
                        onChange={(e) => setNewAssetInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddAsset(newAssetInput);
                          } else if (e.key === 'Escape') {
                            setIsAddingInline(false);
                          }
                        }}
                        className="flex-1 bg-transparent px-2 py-0.5 text-xs text-white uppercase font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddAsset(newAssetInput)}
                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingInline(false);
                          setNewAssetInput('');
                        }}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* Chips */}
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-0.5">
                    {savedAssets.map((a) => {
                      const isSelected = asset.trim().toUpperCase() === a.trim().toUpperCase();
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setAsset(a)}
                          className={`rounded px-2 py-0.5 text-[10px] font-mono transition ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {a}
                        </button>
                      );
                    })}
                  </div>

                  {/* Prompt to save typed asset if not in list */}
                  {asset.trim() && !savedAssets.includes(asset.trim().toUpperCase()) && (
                    <button
                      type="button"
                      onClick={() => handleAddAsset(asset.trim().toUpperCase())}
                      className="flex items-center gap-1 text-[10px] text-emerald-400/90 hover:text-emerald-300 pt-0.5"
                    >
                      <Plus className="h-2.5 w-2.5" /> Salvar "{asset.trim().toUpperCase()}" nos ativos rápidos
                    </button>
                  )}
                </div>
              )}

              {/* Management Drawer/Panel */}
              {isManagingAssets && (
                <div className="mt-2 p-3 rounded-xl bg-black border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300 pb-1 border-b border-slate-800">
                    <span className="font-semibold text-[11px]">Editar ou Adicionar Ativos</span>
                    <button
                      type="button"
                      onClick={handleResetAssets}
                      title="Restaurar lista padrão"
                      className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                    >
                      <RotateCcw className="h-2.5 w-2.5" /> Padrão
                    </button>
                  </div>

                  {/* Add Input inside manager */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Ex: MGLU3, XAUUSD..."
                      value={newAssetInput}
                      onChange={(e) => setNewAssetInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAsset(newAssetInput);
                        }
                      }}
                      className="flex-1 rounded-lg border border-slate-800 bg-black px-2 py-1 text-xs text-white font-mono uppercase focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddAsset(newAssetInput)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition"
                    >
                      <Plus className="h-3 w-3" /> Adicionar
                    </button>
                  </div>

                  {/* List of items with Edit / Delete */}
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {savedAssets.map((a, idx) => (
                      <div
                        key={a}
                        className="flex items-center justify-between py-1 px-2 rounded bg-black/60 border border-slate-800/60"
                      >
                        {editingAssetIdx === idx ? (
                          <div className="flex items-center gap-1 flex-1 mr-1">
                            <input
                              type="text"
                              autoFocus
                              value={editingAssetText}
                              onChange={(e) => setEditingAssetText(e.target.value.toUpperCase())}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveEditAsset(idx);
                                } else if (e.key === 'Escape') {
                                  setEditingAssetIdx(null);
                                }
                              }}
                              className="flex-1 rounded border border-emerald-500 bg-black px-1.5 py-0.5 text-xs text-white font-mono uppercase focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditAsset(idx)}
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                              title="Salvar"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingAssetIdx(null)}
                              className="p-1 text-slate-400 hover:text-white"
                              title="Cancelar"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-xs font-bold text-slate-200">
                            {a}
                          </span>
                        )}

                        {editingAssetIdx !== idx && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAssetIdx(idx);
                                setEditingAssetText(a);
                              }}
                              title={`Editar ${a}`}
                              className="p-1 text-slate-400 hover:text-emerald-400 transition"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAsset(a)}
                              title={`Excluir ${a}`}
                              className="p-1 text-slate-400 hover:text-rose-400 transition"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsManagingAssets(false)}
                    className="w-full py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded transition text-center"
                  >
                    Concluir Edição
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-300">
                Direção da Operação {isEditingProtected && '🔒'}
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  disabled={isEditingProtected}
                  onClick={() => setType('BUY')}
                  className={`flex items-center justify-center gap-1 rounded-xl py-2 font-bold transition ${
                    isEditingProtected ? 'cursor-not-allowed opacity-60' : ''
                  } ${
                    type === 'BUY'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                      : 'border border-slate-800 bg-black text-slate-400 hover:text-white'
                  }`}
                >
                  <ArrowUp className="h-4 w-4" /> Compra
                </button>
                <button
                  type="button"
                  disabled={isEditingProtected}
                  onClick={() => setType('SELL')}
                  className={`flex items-center justify-center gap-1 rounded-xl py-2 font-bold transition ${
                    isEditingProtected ? 'cursor-not-allowed opacity-60' : ''
                  } ${
                    type === 'SELL'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
                      : 'border border-slate-800 bg-black text-slate-400 hover:text-white'
                  }`}
                >
                  <ArrowDown className="h-4 w-4" /> Venda
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Strategy & Valor de Entrada (Substituindo Contratos) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Strategy Section with Editing & Adding Capabilities */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-300">Estratégia / Setup</label>
                <button
                  type="button"
                  onClick={() => setIsManagingStrategies(!isManagingStrategies)}
                  className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition font-medium"
                >
                  <Settings2 className="h-3 w-3" />
                  {isManagingStrategies ? 'Fechar' : 'Gerenciar / Editar'}
                </button>
              </div>

              {/* Main Strategy Text Input */}
              <input
                type="text"
                required
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                placeholder="Ex: Price Action, Rompimento..."
                className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-white focus:border-emerald-500 focus:outline-none font-medium"
              />

              {/* Quick Strategy Chips */}
              {!isManagingStrategies && (
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Estratégias rápidas:</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingStrategyInline(true)}
                      className="flex items-center gap-0.5 text-emerald-400 hover:underline font-medium"
                    >
                      <Plus className="h-2.5 w-2.5" /> + Nova
                    </button>
                  </div>

                  {/* Inline Add Input */}
                  {isAddingStrategyInline && (
                    <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black border border-emerald-500/40">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Nome (ex: Fluxo Institucional)"
                        value={newStrategyInput}
                        onChange={(e) => setNewStrategyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddStrategy(newStrategyInput);
                          } else if (e.key === 'Escape') {
                            setIsAddingStrategyInline(false);
                          }
                        }}
                        className="flex-1 bg-transparent px-2 py-0.5 text-xs text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddStrategy(newStrategyInput)}
                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingStrategyInline(false);
                          setNewStrategyInput('');
                        }}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* Chips */}
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-0.5">
                    {savedStrategies.map((s) => {
                      const isSelected = strategy.trim().toLowerCase() === s.trim().toLowerCase();
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStrategy(s)}
                          className={`rounded px-2 py-0.5 text-[10px] transition ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>

                  {/* Prompt to save typed strategy if not in list */}
                  {strategy.trim() &&
                    !savedStrategies.some(
                      (s) => s.trim().toLowerCase() === strategy.trim().toLowerCase()
                    ) && (
                      <button
                        type="button"
                        onClick={() => handleAddStrategy(strategy.trim())}
                        className="flex items-center gap-1 text-[10px] text-emerald-400/90 hover:text-emerald-300 pt-0.5"
                      >
                        <Plus className="h-2.5 w-2.5" /> Salvar "{strategy.trim()}" nas estratégias rápidas
                      </button>
                    )}
                </div>
              )}

              {/* Management Drawer/Panel */}
              {isManagingStrategies && (
                <div className="mt-2 p-3 rounded-xl bg-black border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300 pb-1 border-b border-slate-800">
                    <span className="font-semibold text-[11px]">Editar ou Adicionar Estratégias</span>
                    <button
                      type="button"
                      onClick={handleResetStrategies}
                      title="Restaurar lista padrão"
                      className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                    >
                      <RotateCcw className="h-2.5 w-2.5" /> Padrão
                    </button>
                  </div>

                  {/* Add Input inside manager */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Ex: Falsa Quebra, Scalp 2 Min..."
                      value={newStrategyInput}
                      onChange={(e) => setNewStrategyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddStrategy(newStrategyInput);
                        }
                      }}
                      className="flex-1 rounded-lg border border-slate-800 bg-black px-2 py-1 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddStrategy(newStrategyInput)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition"
                    >
                      <Plus className="h-3 w-3" /> Adicionar
                    </button>
                  </div>

                  {/* List of items with Edit / Delete */}
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {savedStrategies.map((s, idx) => (
                      <div
                        key={s}
                        className="flex items-center justify-between py-1 px-2 rounded bg-black/60 border border-slate-800/60"
                      >
                        {editingStrategyIdx === idx ? (
                          <div className="flex items-center gap-1 flex-1 mr-1">
                            <input
                              type="text"
                              autoFocus
                              value={editingStrategyText}
                              onChange={(e) => setEditingStrategyText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveEditStrategy(idx);
                                } else if (e.key === 'Escape') {
                                  setEditingStrategyIdx(null);
                                }
                              }}
                              className="flex-1 rounded border border-emerald-500 bg-black px-1.5 py-0.5 text-xs text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditStrategy(idx)}
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                              title="Salvar"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStrategyIdx(null)}
                              className="p-1 text-slate-400 hover:text-white"
                              title="Cancelar"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-slate-200">{s}</span>
                        )}

                        {editingStrategyIdx !== idx && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStrategyIdx(idx);
                                setEditingStrategyText(s);
                              }}
                              title={`Editar ${s}`}
                              className="p-1 text-slate-400 hover:text-emerald-400 transition"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStrategy(s)}
                              title={`Excluir ${s}`}
                              className="p-1 text-slate-400 hover:text-rose-400 transition"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsManagingStrategies(false)}
                    className="w-full py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded transition text-center"
                  >
                    Concluir Edição
                  </button>
                </div>
              )}
            </div>

            {/* Valor de Entrada Section */}
            <div>
              <label className="mb-1 block font-semibold text-slate-300">
                Valor de Entrada (R$) {isEditingProtected && '🔒'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 font-mono font-bold text-slate-400">R$</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  disabled={isEditingProtected}
                  value={contractsOrQuantity}
                  onChange={(e) => setContractsOrQuantity(Number(e.target.value))}
                  placeholder="Ex: 100,00 ou 500,00"
                  className="w-full rounded-xl border border-slate-800 bg-black pl-10 pr-3 py-2 text-white focus:border-emerald-500 focus:outline-none font-mono font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {isEditingProtected
                  ? '🔒 Protegido pelo Anti-Fúria (Capturado/Importado).'
                  : 'Valor financeiro ou margem alocada na entrada deste trade.'}
              </p>
            </div>
          </div>

          {/* Row 4: Financial Result (P&L em R$) */}
          <div className="rounded-xl border border-slate-800 bg-black/60 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-white text-xs">
                Resultado Líquido da Operação (R$) {isEditingProtected && '🔒'}
              </label>
              {!isEditingProtected && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPnl(Math.abs(pnl) || 200);
                      setResult('GAIN');
                    }}
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      pnl > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    + Gain
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPnl(-Math.abs(pnl || 150));
                      setResult('LOSS');
                    }}
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      pnl < 0 ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    - Loss
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPnl(0);
                      setResult('BREAKEVEN');
                    }}
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      pnl === 0 ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    0x0 (Empate)
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2 font-mono font-bold text-slate-400">R$</span>
              <input
                type="number"
                step="any"
                required
                disabled={isEditingProtected}
                value={pnl}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPnl(val);
                  if (val > 0.001) setResult('GAIN');
                  else if (val < -0.001) setResult('LOSS');
                  else setResult('BREAKEVEN');
                }}
                className={`w-full rounded-xl border border-slate-800 bg-black pl-10 pr-3 py-2 text-base font-extrabold font-mono focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                  pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-rose-400' : 'text-white'
                }`}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {isEditingProtected
                ? '🔒 O resultado líquido (lucro/perda) é imutável nesta operação de Conta Real.'
                : 'Insira o valor financeiro direto em reais (positivo para ganho, negativo para perda).'}
            </p>
          </div>

          {/* Row 5: Estado Emocional */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-slate-300">
                Estado Emocional
              </label>
              <button
                type="button"
                onClick={() => setIsManagingEmotions(!isManagingEmotions)}
                className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 transition font-medium"
              >
                <Settings2 className="h-3 w-3" />
                {isManagingEmotions ? 'Fechar' : 'Gerenciar / Editar'}
              </button>
            </div>

            {/* Selected / Custom Emotion text input */}
            <input
              type="text"
              value={emotionalState}
              onChange={(e) => setEmotionalState(e.target.value)}
              placeholder="Ex: Calmo, Ansioso, Focado..."
              className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-white focus:border-purple-500 focus:outline-none font-medium mb-1.5"
            />

            {/* Quick Emotion Chips */}
            {!isManagingEmotions && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Estados rápidos:</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingEmotionInline(true)}
                    className="flex items-center gap-0.5 text-purple-400 hover:underline font-medium"
                  >
                    <Plus className="h-2.5 w-2.5" /> + Novo Estado
                  </button>
                </div>

                {/* Inline Add Input */}
                {isAddingEmotionInline && (
                  <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black border border-purple-500/40">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Nome do estado (ex: Focado)"
                      value={newEmotionInput}
                      onChange={(e) => setNewEmotionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEmotion(newEmotionInput);
                        } else if (e.key === 'Escape') {
                          setIsAddingEmotionInline(false);
                        }
                      }}
                      className="flex-1 bg-transparent px-2 py-0.5 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddEmotion(newEmotionInput)}
                      className="px-2 py-0.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-bold"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingEmotionInline(false);
                        setNewEmotionInput('');
                      }}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Chips */}
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-0.5">
                  {savedEmotions.map((state) => (
                    <button
                      key={state}
                      type="button"
                      onClick={() => {
                        setEmotionalState(state);
                        try {
                          localStorage.setItem(LAST_EMOTION_STORAGE_KEY, state);
                        } catch {}
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        emotionalState.trim().toLowerCase() === state.trim().toLowerCase()
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                          : 'border border-slate-800 bg-black text-slate-400 hover:text-white hover:bg-black'
                      }`}
                    >
                      {state}
                    </button>
                  ))}
                </div>

                {/* Prompt to save typed emotion if not in list */}
                {emotionalState.trim() &&
                  !savedEmotions.some(
                    (e) => e.trim().toLowerCase() === emotionalState.trim().toLowerCase()
                  ) && (
                    <button
                      type="button"
                      onClick={() => handleAddEmotion(emotionalState.trim())}
                      className="flex items-center gap-1 text-[10px] text-purple-400/90 hover:text-purple-300 pt-0.5"
                    >
                      <Plus className="h-2.5 w-2.5" /> Salvar "{emotionalState.trim()}" nos estados rápidos
                    </button>
                  )}
              </div>
            )}

            {/* Management Drawer */}
            {isManagingEmotions && (
              <div className="mt-2 p-3 rounded-xl bg-black border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300 pb-1 border-b border-slate-800">
                  <span className="font-semibold text-[11px]">Editar ou Adicionar Estados Emocionais</span>
                  <button
                    type="button"
                    onClick={handleResetEmotions}
                    title="Restaurar lista padrão"
                    className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> Padrão
                  </button>
                </div>

                {/* Add Input inside manager */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Ex: Confiante, Vingativo..."
                    value={newEmotionInput}
                    onChange={(e) => setNewEmotionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEmotion(newEmotionInput);
                      }
                    }}
                    className="flex-1 rounded-lg border border-slate-800 bg-black px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddEmotion(newEmotionInput)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition"
                  >
                    <Plus className="h-3 w-3" /> Adicionar
                  </button>
                </div>

                {/* List of items with Edit / Delete */}
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {savedEmotions.map((e, idx) => (
                    <div
                      key={e}
                      className="flex items-center justify-between py-1 px-2 rounded bg-black/60 border border-slate-800/60"
                    >
                      {editingEmotionIdx === idx ? (
                        <div className="flex items-center gap-1 flex-1 mr-1">
                          <input
                            type="text"
                            autoFocus
                            value={editingEmotionText}
                            onChange={(ev) => setEditingEmotionText(ev.target.value)}
                            onKeyDown={(ev) => {
                              if (ev.key === 'Enter') {
                                ev.preventDefault();
                                handleSaveEditEmotion(idx);
                              } else if (ev.key === 'Escape') {
                                setEditingEmotionIdx(null);
                              }
                            }}
                            className="flex-1 rounded border border-purple-500 bg-black px-1.5 py-0.5 text-xs text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditEmotion(idx)}
                            className="p-1 text-purple-400 hover:text-purple-300"
                            title="Salvar"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingEmotionIdx(null)}
                            className="p-1 text-slate-400 hover:text-white"
                            title="Cancelar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-slate-200">{e}</span>
                      )}

                      {editingEmotionIdx !== idx && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEmotionIdx(idx);
                              setEditingEmotionText(e);
                            }}
                            title={`Editar ${e}`}
                            className="p-1 text-slate-400 hover:text-purple-400 transition"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEmotion(e)}
                            title={`Excluir ${e}`}
                            className="p-1 text-slate-400 hover:text-rose-400 transition"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setIsManagingEmotions(false)}
                  className="w-full py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded transition text-center"
                >
                  Concluir Edição
                </button>
              </div>
            )}
          </div>

          {/* Row 6: Notes */}
          <div>
            <label className="mb-1 block font-semibold text-slate-300">
              Observações / Checklist Psicológico & Técnico
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Rompimento limpo com volume; esperei o pullback na média de 20; segui o plano sem hesitação."
              className="w-full rounded-xl border border-slate-800 bg-black p-3 text-white focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
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
              {editingTrade ? 'Atualizar Trade' : 'Salvar Operação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


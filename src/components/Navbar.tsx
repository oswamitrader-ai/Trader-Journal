import React, { useState } from 'react';
import {
  TrendingUp,
  Shield,
  ShieldAlert,
  PlusCircle,
  Brain,
  Bell,
  Settings,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Calculator,
  Upload,
  FileText,
  Users,
  LogOut,
} from 'lucide-react';
import { OverallMetrics, RiskSettings, NotificationAlert, SystemUser } from '../types';
import { formatCurrency, formatPercent, CurrencyCode, CURRENCIES, getGlobalCurrency } from '../utils/calculations';
import { SupabaseConnectionStatus } from '../lib/supabase';

interface NavbarProps {
  metrics?: OverallMetrics;
  settings?: RiskSettings;
  notifications?: NotificationAlert[];
  todayPnl?: number;
  todayTradesCount?: number;
  currentCapital?: number;
  supabaseStatus?: SupabaseConnectionStatus;
  currentCurrency?: CurrencyCode;
  currentUser?: SystemUser | null;
  onCurrencyChange?: (currency: CurrencyCode) => void;
  onOpenNewTrade: () => void;
  onOpenImportModal?: () => void;
  onOpenSettings: () => void;
  onOpenAiMentor: () => void;
  onOpenKellyCalculator?: () => void;
  onOpenStakePlanner?: () => void;
  onOpenSupabase?: () => void;
  onOpenAntiFuria?: () => void;
  onOpenPdfReport?: () => void;
  onOpenAdminManagement?: () => void;
  onLogout?: () => void;
  onClearNotifications?: () => void;
  onResetData?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  metrics,
  settings,
  notifications = [],
  todayPnl = 0,
  todayTradesCount = 0,
  currentCapital,
  supabaseStatus = 'connecting',
  currentCurrency = getGlobalCurrency(),
  currentUser,
  onCurrencyChange = (_curr: CurrencyCode) => {},
  onOpenNewTrade,
  onOpenImportModal,
  onOpenSettings,
  onOpenAiMentor,
  onOpenKellyCalculator,
  onOpenStakePlanner,
  onOpenSupabase = () => {},
  onOpenAntiFuria,
  onOpenPdfReport,
  onOpenAdminManagement,
  onLogout,
  onClearNotifications = () => {},
  onResetData = () => {},
}) => {
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);

  // Safe defaults for risk settings
  const dailyProfitTarget = settings?.dailyProfitTarget ?? 500;
  const dailyLossLimit = settings?.dailyLossLimit ?? 300;

  // Status for today
  const isTargetHit = todayPnl >= dailyProfitTarget;
  const isStopHit = todayPnl <= -dailyLossLimit;
  const isNearStop = todayPnl < 0 && Math.abs(todayPnl) >= dailyLossLimit * 0.75;
  const safeNotifList = notifications || [];
  const displayCapital = metrics?.currentCapital ?? currentCapital ?? 10000;
  const displayWinRate = metrics?.winRate ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-black/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 gap-2">
        {/* Brand & Logo (Apenas Ícone) */}
        <div className="flex items-center shrink-0">
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-lg shadow-emerald-900/30 shrink-0">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
        </div>

        {/* Highlighted Today Result Badge (Mobile & Tablet) */}
        <div className="flex lg:hidden items-center shrink-0">
          <div
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border shadow-md font-mono transition-all ${
              todayPnl > 0
                ? 'border-emerald-600 bg-black text-emerald-400'
                : todayPnl < 0
                ? 'border-rose-600 bg-black text-rose-400'
                : 'border-slate-800 bg-black text-slate-200'
            }`}
          >
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400">
              Hoje:
            </span>
            <span className="text-xs sm:text-sm font-black tracking-tight">
              {todayPnl > 0 ? '+' : ''}
              {formatCurrency(todayPnl)}
            </span>
            {isTargetHit && (
              <span className="rounded bg-emerald-600 px-1 py-0.2 text-[8px] sm:text-[9px] font-bold text-white shadow-sm uppercase">
                Meta
              </span>
            )}
            {isStopHit && (
              <span className="rounded bg-rose-600 px-1 py-0.2 text-[8px] sm:text-[9px] font-bold text-white shadow-sm uppercase animate-pulse">
                Stop!
              </span>
            )}
          </div>
        </div>

        {/* Live Day Status Indicators (Desktop) */}
        <div className="hidden lg:flex items-center gap-4">
          <div
            className={`flex items-center gap-3.5 rounded-2xl border px-4 py-2 shadow-lg transition-all ${
              todayPnl > 0
                ? 'border-emerald-600 bg-black text-emerald-400'
                : todayPnl < 0
                ? 'border-rose-600 bg-black text-rose-400'
                : 'border-slate-800 bg-black text-slate-200'
            }`}
          >
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Resultado Hoje
                </span>
                <span className="text-[10px] font-medium text-slate-500">
                  {todayTradesCount} {todayTradesCount === 1 ? 'trade' : 'trades'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-xl font-black font-mono tracking-tight ${
                    todayPnl > 0
                      ? 'text-emerald-400'
                      : todayPnl < 0
                      ? 'text-rose-400'
                      : 'text-slate-200'
                  }`}
                >
                  {todayPnl > 0 ? '+' : ''}
                  {formatCurrency(todayPnl)}
                </span>
                {isTargetHit && (
                  <span className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Meta Batida
                  </span>
                )}
                {isStopHit && (
                  <span className="flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm animate-pulse">
                    <XCircle className="h-3.5 w-3.5" /> Stop Atingido
                  </span>
                )}
                {!isStopHit && isNearStop && (
                  <span className="flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                    <AlertTriangle className="h-3.5 w-3.5" /> Alerta Stop
                  </span>
                )}
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800" />

            <div className="flex flex-col">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Saldo Atual
              </span>
              <span className="text-sm font-bold font-mono text-white">
                {formatCurrency(displayCapital)}
              </span>
            </div>

            <div className="h-7 w-px bg-slate-800" />

            <div className="flex flex-col">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Assertividade
              </span>
              <span className="text-sm font-bold font-mono text-emerald-400">
                {displayWinRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2.5 shrink-0 pb-1 sm:pb-0 max-w-full">
          {/* New Trade Button */}
          <button
            id="btn-nova-operacao"
            onClick={onOpenNewTrade}
            title="Nova Operação"
            className="flex h-8 sm:h-9 w-8 sm:w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-900/30 transition-all hover:bg-emerald-500 active:scale-95 shrink-0"
          >
            <PlusCircle className="h-4 w-4" />
          </button>

          {/* AI Mentor Button */}
          <button
            id="btn-mentor-ia"
            onClick={onOpenAiMentor}
            title="Mentor Trader Inteligente (Gemini IA)"
            className="flex h-8 sm:h-9 w-8 sm:w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md transition-all hover:bg-teal-500 active:scale-95 shrink-0"
          >
            <Brain className="h-4 w-4" />
          </button>

          {/* Import CSV Button */}
          {onOpenImportModal && (
            <button
              id="btn-importar-csv"
              onClick={onOpenImportModal}
              title="Importar Relatório de Performance (ProfitChart, MT4/MT5, Exnova)"
              className="flex h-8 sm:h-9 w-8 sm:w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md transition-all hover:bg-blue-500 active:scale-95 shrink-0"
            >
              <Upload className="h-4 w-4" />
            </button>
          )}

          {/* Kelly Calculator Button */}
          {onOpenKellyCalculator && (
            <button
              id="btn-calculadora-kelly"
              onClick={onOpenKellyCalculator}
              title="Calculadora do Critério de Kelly (Dimensionamento de Lote & Contratos)"
              className="flex h-8 sm:h-9 w-8 sm:w-9 items-center justify-center rounded-xl bg-slate-800 text-white shadow-md transition-all hover:bg-slate-700 active:scale-95 shrink-0"
            >
              <Calculator className="h-4 w-4" />
            </button>
          )}

          {/* Stake Planner (Soros) Button */}
          {onOpenStakePlanner && (
            <button
              id="btn-planejador-soros"
              onClick={onOpenStakePlanner}
              title="Planejador de Entradas (Simulador de Soros, Mão Fixa e Gale)"
              className="flex h-8 sm:h-9 w-8 sm:w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md transition-all hover:bg-indigo-500 active:scale-95 shrink-0"
            >
              <TrendingUp className="h-4 w-4" />
            </button>
          )}

          {/* PDF Report Button */}
          {onOpenPdfReport && (
            <button
              id="btn-relatorio-pdf"
              onClick={onOpenPdfReport}
              title="Exportar Relatório Executivo em PDF"
              className="flex h-8 sm:h-9 w-8 sm:w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md transition-all hover:bg-violet-500 active:scale-95 shrink-0"
            >
              <FileText className="h-4 w-4" />
            </button>
          )}

          {/* 1. Anti-Fúria Extension Button */}
          {onOpenAntiFuria && (
            <button
              id="btn-anti-furia-extensao"
              onClick={onOpenAntiFuria}
              title={
                isStopHit
                  ? 'Trava Ativa: Corretoras Bloqueadas! Clique para ver o status da extensão'
                  : 'Extensão Trava Anti-Fúria (Bloquear Exnova no Stop)'
              }
              className={`flex h-8 sm:h-9 w-8 sm:w-9 items-center justify-center rounded-xl border transition-all active:scale-95 shrink-0 ${
                isStopHit
                  ? 'border-red-600 bg-red-800 text-white hover:bg-red-700 animate-pulse shadow-md shadow-red-950'
                  : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <ShieldAlert className={`h-4 w-4 shrink-0 ${isStopHit ? 'text-white' : 'text-red-400'}`} />
            </button>
          )}

          {/* 2. Notifications Trigger */}
          <div className="relative shrink-0">
            <button
              id="btn-notificacoes"
              onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
              title="Notificações e Alertas"
              className="relative flex h-8 sm:h-9 w-8 sm:w-9 items-center justify-center rounded-xl bg-slate-800 text-white shadow-md transition hover:bg-slate-700 active:scale-95 shrink-0"
            >
              <Bell className="h-4 w-4" />
              {safeNotifList.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                  {safeNotifList.length}
                </span>
              )}
            </button>

            {/* Notifications Dropdown with Backdrop on Mobile */}
            {showNotificationsDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/40 sm:hidden"
                  onClick={() => setShowNotificationsDropdown(false)}
                />
                <div className="absolute right-0 top-14 sm:top-auto mt-2 w-[calc(100vw-1rem)] max-w-sm sm:w-96 rounded-2xl border border-slate-800 bg-black p-4 shadow-2xl z-50">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-bold text-white">Notificações e Alertas</span>
                    </div>
                    {safeNotifList.length > 0 && (
                      <button
                        onClick={onClearNotifications}
                        className="text-xs text-slate-400 hover:text-slate-200 transition underline"
                      >
                        Limpar
                      </button>
                    )}
                  </div>

                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {safeNotifList.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        Nenhum alerta pendente no momento. Suas notificações de metas e limites aparecerão aqui!
                      </div>
                    ) : (
                      safeNotifList.map((n) => (
                        <div
                          key={n.id}
                          className={`rounded-xl border p-3 text-xs ${
                            n.severity === 'error'
                              ? 'border-rose-500/30 bg-rose-950/30 text-rose-200'
                              : n.severity === 'warning'
                              ? 'border-amber-500/30 bg-amber-950/30 text-amber-200'
                              : n.severity === 'success'
                              ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'
                              : 'border-slate-800 bg-slate-800/40 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span>{n.title}</span>
                            <span className="text-[10px] opacity-70 font-normal">{n.timestamp}</span>
                          </div>
                          <p className="mt-1 leading-relaxed opacity-90">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3. Currency Selector Dropdown */}
          <div className="relative shrink-0">
            <button
              id="btn-moeda-painel"
              onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
              title="Alterar Moeda Exibida no Painel"
              className="flex h-8 sm:h-9 items-center gap-1.5 px-2.5 rounded-xl bg-slate-800 text-xs font-bold text-white shadow-md transition hover:bg-slate-700 active:scale-95 shrink-0 font-mono"
            >
              <span className="text-sm">
                {(CURRENCIES.find((c) => c.code === currentCurrency) || CURRENCIES[0]).flag}
              </span>
              <span className="text-emerald-400 font-bold hidden sm:inline">
                {(CURRENCIES.find((c) => c.code === currentCurrency) || CURRENCIES[0]).symbol}
              </span>
            </button>

            {showCurrencyDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/40 sm:hidden"
                  onClick={() => setShowCurrencyDropdown(false)}
                />
                <div className="absolute right-0 top-14 sm:top-auto mt-2 w-56 rounded-2xl border border-slate-800 bg-black p-2 shadow-2xl z-50">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1">
                    Moeda do Painel
                  </div>
                  <div className="space-y-0.5">
                    {CURRENCIES.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => {
                          onCurrencyChange(c.code);
                          setShowCurrencyDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${
                          currentCurrency === c.code
                            ? 'bg-emerald-600 text-white font-bold shadow-sm'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{c.flag}</span>
                          <span>{c.name}</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-400">{c.symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            id="btn-config-risco"
            onClick={onOpenSettings}
            title="Configurar Metas & Limites de Risco"
            className="flex h-8 sm:h-9 w-8 sm:w-9 items-center justify-center rounded-xl bg-slate-800 text-white shadow-md transition hover:bg-slate-700 active:scale-95 shrink-0"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Admin User Management Button */}
          {currentUser?.role === 'ADMIN' && onOpenAdminManagement && (
            <button
              id="btn-gestao-clientes-admin"
              onClick={onOpenAdminManagement}
              title="Painel Admin - Gestão de Clientes"
              className="flex h-8 sm:h-9 items-center gap-1.5 px-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md transition hover:opacity-90 active:scale-95 shrink-0 text-xs font-bold font-mono"
            >
              <Users className="h-4 w-4 text-violet-200" />
              <span className="hidden sm:inline">Clientes</span>
            </button>
          )}

          {/* Current User Badge & Logout */}
          {currentUser && (
            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2 ml-1">
              <div
                title={`${currentUser.name} (${currentUser.email})`}
                className="hidden xl:flex flex-col items-end text-[11px]"
              >
                <span className="font-bold text-slate-200 leading-tight max-w-[120px] truncate">
                  {currentUser.name || currentUser.email.split('@')[0]}
                </span>
                <span
                  className={`text-[9px] font-mono font-bold uppercase tracking-wider ${
                    currentUser.role === 'ADMIN' ? 'text-violet-400' : 'text-emerald-400'
                  }`}
                >
                  {currentUser.role === 'ADMIN' ? '[ADMIN]' : '[CLIENTE]'}
                </span>
              </div>

              {onLogout && (
                <button
                  id="btn-logout"
                  onClick={onLogout}
                  title="Sair da Conta"
                  className="flex h-8 sm:h-9 w-8 sm:w-9 items-center justify-center rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-300 hover:bg-rose-900/60 hover:text-white shadow-md transition active:scale-95 shrink-0"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

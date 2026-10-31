import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  BarChart2,
  CalendarRange,
  ListFilter,
  PlusCircle,
  Brain,
  ShieldCheck,
  TrendingUp,
  Activity,
  Award,
  Lock,
} from 'lucide-react';
import { Trade, RiskSettings, DayPerformance, NotificationAlert, CapitalTransaction } from './types';
import { INITIAL_TRADES, DEFAULT_RISK_SETTINGS } from './data/initialTrades';
import {
  calculateMetrics,
  getDailyPerformances,
  getWeeklyPerformances,
  getMonthlyPerformances,
  formatCurrency,
  CurrencyCode,
  getGlobalCurrency,
  setGlobalCurrency,
  isTradeProtected,
  getLocalDateStr,
  sortAndSanitizeTrades,
} from './utils/calculations';
import { Navbar } from './components/Navbar';
import { RiskAlertBanner } from './components/RiskAlertBanner';
import { KpiCards } from './components/KpiCards';
import { PerformanceCharts } from './components/PerformanceCharts';
import { MonthlyCalendar } from './components/MonthlyCalendar';
import { WeeklyPerformancePanel } from './components/WeeklyPerformancePanel';
import { TradeList } from './components/TradeList';
import { TradeFormModal } from './components/TradeFormModal';
import { RiskSettingsModal } from './components/RiskSettingsModal';
import { DayDetailModal } from './components/DayDetailModal';
import { AiTraderMentorModal } from './components/AiTraderMentorModal';
import { SupabaseSyncModal } from './components/SupabaseSyncModal';
import { AntiFuriaExtensionPage } from './components/AntiFuriaExtensionPage';
import { DEFAULT_BLOCKED_DOMAINS } from './utils/extensionGenerator';
import { RiskManagementPage } from './components/RiskManagementPage';
import { CapitalHistoryModal } from './components/CapitalHistoryModal';
import { KellyCalculatorModal } from './components/KellyCalculatorModal';
import { StakePlannerModal } from './components/StakePlannerModal';
import { ImportTradesModal } from './components/ImportTradesModal';
import { PDFReportModal } from './components/PDFReportModal';
import { LoginScreen } from './components/LoginScreen';
import { AdminUserManagementPage } from './components/AdminUserManagementPage';
import { restoreAuthenticatedUser, applyJournalReset, logoutUser } from './utils/auth';
import { SystemUser } from './types';
import {
  supabase,
  checkSupabaseConnection,
  fetchTradesFromSupabase,
  fetchRiskSettingsFromSupabase,
  fetchCapitalTransactionsFromSupabase,
  fetchDeletedRecordIds,
  purgeCloudRecordsDeletedByUser,
  upsertTradeToSupabase,
  upsertCapitalTransactionToSupabase,
  deleteTradeFromSupabase,
  deleteCapitalTransactionFromSupabase,
  clearAllTradesFromSupabase,
  syncAllTradesToSupabase,
  syncAllCapitalTransactionsToSupabase,
  saveRiskSettingsToSupabase,
  SupabaseHealthResult,
} from './lib/supabase';

type ActiveView = 'all' | 'charts' | 'calendar' | 'weekly' | 'trades';

function readDeletedIds(key: string): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch { return new Set(); }
}

function saveDeletedId(key: string, id: string): void {
  const ids = readDeletedIds(key);
  ids.add(id);
  try { localStorage.setItem(key, JSON.stringify(Array.from(ids))); } catch {}
}

export default function App() {
  // 0. Auth State
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  useEffect(() => {
    let mounted = true;
    const refresh = () => { restoreAuthenticatedUser().then(user => { if(mounted) setCurrentUser(user); }).catch(() => { if(mounted) setCurrentUser(null); }); };
    refresh();
    const {data:{subscription}} = supabase.auth.onAuthStateChange((event) => {
      if(event === 'SIGNED_OUT') setCurrentUser(null);
      else if(event === 'SIGNED_IN') setTimeout(refresh,0);
    });
    return () => { mounted=false; subscription.unsubscribe(); };
  }, []);
  const [currentView, setCurrentView] = useState<'JOURNAL' | 'ADMIN_CLIENTS' | 'ANTI_FURIA' | 'RISK_MANAGEMENT' | 'CAPITAL_MANAGEMENT'>('JOURNAL');
  const [exnovaCaptureStatus, setExnovaCaptureStatus] = useState<ExnovaCaptureStatus>({
    state: 'idle',
    message: 'Captura desativada.',
    capturedCount: 0,
    enabled: false,
  });
  const [exnovaStakeShieldStatus, setExnovaStakeShieldStatus] = useState<ExnovaStakeShieldStatus>({
    state: 'disabled',
    message: 'Aguardando sincronização da trava de valor.',
    enabled: false,
  });

  const handleLogout = () => {
    if (isAntiFuriaActive) {
      alert(
        '🔒 Trava Anti-Fúria ATIVADA!\n\n' +
        'Você NÃO pode sair da sua conta enquanto a Trava Anti-Fúria (Stop Loss ou Overtrading) estiver ativa no dia.\n\nEncerre as operações de hoje e proteja seu capital!'
      );
      return;
    }
    logoutUser();
    setCurrentUser(null);
  };

  // User-Scoped LocalStorage Keys
  const userEmailKey = currentUser?.email?.toLowerCase().trim() || 'default';
  const TRADES_STORAGE_KEY = `trader_journal_trades_${userEmailKey}`;
  const SETTINGS_STORAGE_KEY = `trader_journal_settings_${userEmailKey}`;
  const CAPITAL_STORAGE_KEY = `trader_journal_capital_txs_${userEmailKey}`;
  const DELETED_TRADES_KEY = `${TRADES_STORAGE_KEY}_deleted`;
  const DELETED_CAPITAL_KEY = `${CAPITAL_STORAGE_KEY}_deleted`;

  // 1. Trades State (Sync Initial Hydration to Eliminate 0/Empty State Flash & Timezone Fix)
  const [trades, setTrades] = useState<Trade[]>(() => {
    try {
      const savedTrades = localStorage.getItem(TRADES_STORAGE_KEY);

      if (savedTrades && savedTrades !== 'undefined' && savedTrades !== 'null') {
        const parsed = JSON.parse(savedTrades);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const deleted = readDeletedIds(DELETED_TRADES_KEY);
          const valid = parsed.filter((t: any) => !/^tr-0\d{2}$/.test(t.id) && t.id !== 'tr-024' && !deleted.has(String(t.id)));
          return sortAndSanitizeTrades(valid);
        }
      }
      if (userEmailKey === 'oswamitrader@gmail.com') {
        const legacySaved = localStorage.getItem('trader_journal_trades_v2') || localStorage.getItem('trader_journal_trades_v1');
        if (legacySaved && legacySaved !== 'undefined' && legacySaved !== 'null') {
          const parsed = JSON.parse(legacySaved);
          if (Array.isArray(parsed)) {
            const deleted = readDeletedIds(DELETED_TRADES_KEY);
            const valid = parsed.filter((t: any) => !/^tr-0\d{2}$/.test(t.id) && t.id !== 'tr-024' && !deleted.has(String(t.id)));
            return sortAndSanitizeTrades(valid);
          }
        }
      }
    } catch {}
    return [];
  });

  // 2. Risk Settings State
  const [settings, setSettings] = useState<RiskSettings>(() => {
    try {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings && savedSettings !== 'undefined' && savedSettings !== 'null') {
        return { ...DEFAULT_RISK_SETTINGS, ...JSON.parse(savedSettings) };
      }
    } catch {}
    return DEFAULT_RISK_SETTINGS;
  });

  // 3. Capital Transactions State (com resgate de chaves legadas e escopadas)
  const [capitalTransactions, setCapitalTransactions] = useState<CapitalTransaction[]>(() => {
    try {
      const savedTxs = localStorage.getItem(CAPITAL_STORAGE_KEY);
      if (savedTxs && savedTxs !== 'undefined' && savedTxs !== 'null') {
        const parsed = JSON.parse(savedTxs);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed.some((tx: any) => tx && typeof tx === 'object' && tx.id)) {
            return parsed.filter((tx: any) => tx && typeof tx === 'object' && tx.id && !readDeletedIds(DELETED_CAPITAL_KEY).has(String(tx.id)));
          }
      }
    } catch {}
    return [];
  });
  const tradesRef = useRef(trades);
  const settingsRef = useRef(settings);
  const capitalTransactionsRef = useRef(capitalTransactions);

  useEffect(() => { tradesRef.current = trades; }, [trades]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { capitalTransactionsRef.current = capitalTransactions; }, [capitalTransactions]);
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);

  // Flag para rastrear quando os dados iniciais foram hidratados
  const [isDataLoaded, setIsDataLoaded] = useState(true);

  // Re-hydrate user-isolated data whenever currentUser changes
  useEffect(() => {
    if (!currentUser) return;

    // Load user's isolated trades
    try {
      const savedTrades = localStorage.getItem(TRADES_STORAGE_KEY);
      let loadedTrades: Trade[] = [];

      if (savedTrades && savedTrades !== 'undefined' && savedTrades !== 'null') {
        const parsed = JSON.parse(savedTrades);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const deleted = readDeletedIds(DELETED_TRADES_KEY);
          loadedTrades = parsed.filter((t) => !/^tr-0\d{2}$/.test(t.id) && t.id !== 'tr-024' && !deleted.has(String(t.id)));
        }
      }

      // Se for o Admin e o storage escopado estiver vazio, resgata do armazenamento legado
      if (loadedTrades.length === 0 && currentUser.email.toLowerCase() === 'oswamitrader@gmail.com') {
        const legacySaved = localStorage.getItem('trader_journal_trades_v2') || localStorage.getItem('trader_journal_trades_v1');
        if (legacySaved && legacySaved !== 'undefined' && legacySaved !== 'null') {
          const parsed = JSON.parse(legacySaved);
          if (Array.isArray(parsed)) {
            const deleted = readDeletedIds(DELETED_TRADES_KEY);
            loadedTrades = parsed.filter((t) => !/^tr-0\d{2}$/.test(t.id) && t.id !== 'tr-024' && !deleted.has(String(t.id)));
          }
        }
      }

      setTrades(sortAndSanitizeTrades(loadedTrades));
    } catch {}

    // Load user's isolated risk settings
    try {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings && savedSettings !== 'undefined' && savedSettings !== 'null') {
        setSettings({ ...DEFAULT_RISK_SETTINGS, ...JSON.parse(savedSettings) });
      } else { setSettings(DEFAULT_RISK_SETTINGS); }
    } catch {}

    // Load user's isolated capital transactions (com fallback para chaves legadas)
    try {
      const savedTxs = localStorage.getItem(CAPITAL_STORAGE_KEY);
      let loadedCap: CapitalTransaction[] = [];
      if (savedTxs && savedTxs !== 'undefined' && savedTxs !== 'null') {
        const parsed = JSON.parse(savedTxs);
        if (Array.isArray(parsed) && parsed.length > 0) loadedCap = parsed.filter((tx: CapitalTransaction) => tx && typeof tx === 'object' && tx.id && !readDeletedIds(DELETED_CAPITAL_KEY).has(String(tx.id)));
      }
      setCapitalTransactions(loadedCap);
    } catch {}

    setIsDataLoaded(true);
  }, [currentUser?.email]);

  const [clearedNotificationIds, setClearedNotificationIds] = useState<string[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});

  // 2.5 Global Currency State
  const [currency, setCurrency] = useState<CurrencyCode>(() => getGlobalCurrency());

  const handleCurrencyChange = (newCurrency: CurrencyCode) => {
    setGlobalCurrency(newCurrency);
    setCurrency(newCurrency);
  };

  // Save to LocalStorage ONLY after data has been initial-loaded
  useEffect(() => {
    if (!currentUser || !isDataLoaded) return;
    try {
      localStorage.setItem(CAPITAL_STORAGE_KEY, JSON.stringify(capitalTransactions));
    } catch (e) {
      console.error(e);
    }
  }, [capitalTransactions, CAPITAL_STORAGE_KEY, currentUser, isDataLoaded]);

  useEffect(() => {
    if (!currentUser || !isDataLoaded) return;
    try {
      localStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(trades));
    } catch (e) {
      console.error(e);
    }
  }, [trades, TRADES_STORAGE_KEY, currentUser, isDataLoaded]);

  useEffect(() => {
    if (!currentUser || !isDataLoaded) return;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error(e);
    }
  }, [settings, SETTINGS_STORAGE_KEY, currentUser, isDataLoaded]);

  // 3. Modals and Views
  const [blockedDomains, setBlockedDomains] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('trader_journal_blocked_domains_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Falha ao carregar domínios salvos do storage:', e);
    }
    return DEFAULT_BLOCKED_DOMAINS;
  });
  const [activeView, setActiveView] = useState<ActiveView>('all');
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAiMentorOpen, setIsAiMentorOpen] = useState(false);
  const [isKellyCalculatorOpen, setIsKellyCalculatorOpen] = useState(false);
  const [isStakePlannerOpen, setIsStakePlannerOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPdfReportOpen, setIsPdfReportOpen] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isAntiFuriaModalOpen, setIsAntiFuriaModalOpen] = useState(false);
  const [supabaseHealth, setSupabaseHealth] = useState<SupabaseHealthResult>({
    status: 'connecting',
    message: 'Verificando conexão com o Supabase...',
  });

  const refreshSupabaseStatus = async () => {
    setSupabaseHealth((prev) => ({ ...prev, status: 'connecting' }));
    const health = await checkSupabaseConnection();
    setSupabaseHealth(health);
    return health;
  };

  // Mantém desktop e web conciliados pela nuvem, mesmo quando Realtime não está habilitado.
  useEffect(() => {
    const email = currentUser?.email?.toLowerCase().trim();
    if (!email) return;

    let isMounted = true;
    let syncInFlight = false;

    const synchronize = async () => {
      if (!isMounted || syncInFlight) return;
      syncInFlight = true;
      try {
        const health = await checkSupabaseConnection();
        if (!isMounted) return;
        setSupabaseHealth(health);
        if (health.status !== 'connected') return;

        if (await applyJournalReset(email)) {
          tradesRef.current = [];
          capitalTransactionsRef.current = [];
          setTrades([]);
          setCapitalTransactions([]);
        }
        const [tradesResult, settingsResult, capitalResult] = await Promise.all([
          fetchTradesFromSupabase(email),
          fetchRiskSettingsFromSupabase(email),
          fetchCapitalTransactionsFromSupabase(email),
        ]);
        if (!isMounted) return;
        if (tradesResult.error) throw new Error(`Operações: ${tradesResult.error}`);
        if (settingsResult.error) throw new Error(`Configurações: ${settingsResult.error}`);
        if (capitalResult.error) throw new Error(`Movimentações: ${capitalResult.error}`);

        const deletedRecords = await fetchDeletedRecordIds(email);
        if (deletedRecords.error) throw new Error(`Exclusões sincronizadas: ${deletedRecords.error}`);
        const locallyDeletedTrades = readDeletedIds(DELETED_TRADES_KEY);
        const locallyDeletedCapital = readDeletedIds(DELETED_CAPITAL_KEY);

        // Reúne os dados por ID e usa a data de atualização para resolver alterações concorrentes.
        const cloudTrades = tradesResult.data || [];
        const cloudTradeMap = new Map<string, Trade>();
        cloudTrades.forEach((trade) => cloudTradeMap.set(trade.id, trade));
        const localDirtyTrades: Trade[] = [];
        const mergedTradeMap = new Map<string, Trade>(cloudTradeMap);
        const activeLocalTrades = tradesRef.current.filter((trade) =>
          !deletedRecords.tradeIds.has(trade.id) && !locallyDeletedTrades.has(trade.id)
        );
        activeLocalTrades.forEach((trade) => mergedTradeMap.set(trade.id, trade));
        for (const localTrade of activeLocalTrades) {
          const cloudTrade = cloudTradeMap.get(localTrade.id);
          const localUpdatedAt = localTrade.updatedAt ? Date.parse(localTrade.updatedAt) : 0;
          const cloudUpdatedAt = cloudTrade?.updatedAt ? Date.parse(cloudTrade.updatedAt) : 0;
          if (!cloudTrade || localUpdatedAt > cloudUpdatedAt) {
            localDirtyTrades.push(localTrade);
            mergedTradeMap.set(localTrade.id, localTrade);
          } else {
            mergedTradeMap.set(localTrade.id, cloudTrade);
          }
        }
        const mergedTrades = sortAndSanitizeTrades(Array.from(mergedTradeMap.values()));
        if (JSON.stringify(tradesRef.current) !== JSON.stringify(mergedTrades)) setTrades(mergedTrades);
        if (localDirtyTrades.length > 0) {
          const upload = await syncAllTradesToSupabase(localDirtyTrades, email);
          if (upload.error) throw new Error(`Envio de operações: ${upload.error}`);
        }

        const cloudCapital = capitalResult.data || [];
        const cloudCapitalIds = new Set(cloudCapital.map((tx) => tx.id));
        const activeLocalCapital = capitalTransactionsRef.current.filter((tx) =>
          !deletedRecords.capitalIds.has(tx.id) && !locallyDeletedCapital.has(tx.id)
        );
        const localOnlyCapital = activeLocalCapital.filter((tx) => !cloudCapitalIds.has(tx.id));
        const mergedCapitalMap = new Map<string, CapitalTransaction>();
        activeLocalCapital.forEach((tx) => mergedCapitalMap.set(tx.id, tx));
        cloudCapital.forEach((tx) => mergedCapitalMap.set(tx.id, tx));
        const mergedCapital = Array.from(mergedCapitalMap.values()).sort((a, b) => b.date.localeCompare(a.date));
        if (JSON.stringify(capitalTransactionsRef.current) !== JSON.stringify(mergedCapital)) setCapitalTransactions(mergedCapital);
        if (localOnlyCapital.length > 0) {
          const upload = await syncAllCapitalTransactionsToSupabase(localOnlyCapital, email);
          if (upload.error) throw new Error(`Envio de movimentações: ${upload.error}`);
        }
        const purgeError = await purgeCloudRecordsDeletedByUser(email, deletedRecords.tradeIds, deletedRecords.capitalIds);
        if (purgeError) throw new Error(`Remoção de itens excluídos: ${purgeError}`);

        if (settingsResult.data) {
          const previous = settingsRef.current;
          const incoming = settingsResult.data;
          const localUpdatedAt = previous.updatedAt ? Date.parse(previous.updatedAt) : 0;
          const cloudUpdatedAt = incoming.updatedAt ? Date.parse(incoming.updatedAt) : 0;
          if (localUpdatedAt > cloudUpdatedAt) {
            const previousLockTime = previous.riskLockUntil ? new Date(previous.riskLockUntil).getTime() : 0;
            const cloudLockTime = incoming.riskLockUntil ? new Date(incoming.riskLockUntil).getTime() : 0;
            const keepActiveCloudLock = cloudLockTime > Date.now() && cloudLockTime > previousLockTime;
            const localSettingsToUpload = keepActiveCloudLock
              ? { ...previous, riskLockUntil: incoming.riskLockUntil, riskLockDurationDays: incoming.riskLockDurationDays }
              : previous;
            const upload = await saveRiskSettingsToSupabase(localSettingsToUpload, email);
            if (upload.error) throw new Error(`Envio de configurações: ${upload.error}`);
            if (keepActiveCloudLock && JSON.stringify(previous) !== JSON.stringify(localSettingsToUpload)) {
              setSettings(localSettingsToUpload);
            }
            if (isMounted) setSupabaseHealth({ status: 'connected', message: 'Configurações locais enviadas para a nuvem.' });
          } else {
            const previousLockTime = previous.riskLockUntil ? new Date(previous.riskLockUntil).getTime() : 0;
            const cloudLockTime = incoming.riskLockUntil ? new Date(incoming.riskLockUntil).getTime() : 0;
            const keepActiveLocalLock = previousLockTime > Date.now() && previousLockTime > cloudLockTime;
            const mergedSettings: RiskSettings = {
              ...DEFAULT_RISK_SETTINGS,
              ...incoming,
              riskLockUntil: keepActiveLocalLock ? previous.riskLockUntil : incoming.riskLockUntil,
              riskLockDurationDays: keepActiveLocalLock ? previous.riskLockDurationDays : incoming.riskLockDurationDays,
              permanentMobileBrokerLockEnabled: Boolean(previous.permanentMobileBrokerLockEnabled || incoming.permanentMobileBrokerLockEnabled),
              enforceBrokerStakeLock: Boolean(previous.enforceBrokerStakeLock || incoming.enforceBrokerStakeLock),
            };
            if (JSON.stringify(previous) !== JSON.stringify(mergedSettings)) setSettings(mergedSettings);
          }
        } else {
          const upload = await saveRiskSettingsToSupabase(settingsRef.current, email);
          if (upload.error) throw new Error(`Envio de configurações: ${upload.error}`);
        }

        if (isMounted) {
          setSupabaseHealth({ status: 'connected', message: `Sincronizado automaticamente às ${new Date().toLocaleTimeString()}.` });
        }
      } catch (error: any) {
        if (isMounted) {
          setSupabaseHealth({ status: 'error', message: error?.message || 'Falha na sincronização automática com a nuvem.' });
        }
        console.warn('Falha na sincronização automática:', error);
      } finally {
        syncInFlight = false;
      }
    };

    const channelName = `realtime_app_${email.replace(/[^a-z0-9]/g, '_')}`;
    const realtimeChannel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, synchronize)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'risk_settings' }, synchronize)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'management_settings' }, synchronize)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deleted_records' }, synchronize)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'capital_transactions' }, synchronize)
      .on('broadcast', { event: 'SYNC_MUTATION' }, synchronize)
      .subscribe((status) => {
        if (!isMounted) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSupabaseHealth({ status: 'error', message: 'Canal em tempo real indisponível; tentando sincronizar automaticamente.' });
        }
      });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') synchronize();
    };
    const onWindowFocus = () => synchronize();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);
    const pollInterval = window.setInterval(synchronize, 5000);
    synchronize();

    return () => {
      isMounted = false;
      window.clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
      supabase.removeChannel(realtimeChannel);
    };
  }, [currentUser?.email]);

  // 4. Computed Analytics Engine
  const netCapitalTransactions = useMemo(() => {
    return capitalTransactions.reduce((acc, tx) => {
      // Transações canceladas não afetam o saldo líquido da banca
      if (tx.status === 'CANCELED') return acc;
      const amt = Number(tx.amount) || 0;
      const fee = Number(tx.fee) || 0;
      if (tx.type === 'DEPOSIT') {
        return acc + (amt - fee);
      } else {
        return acc - (amt + fee);
      }
    }, 0);
  }, [capitalTransactions]);

  const metrics = useMemo(() => {
    const rawMetrics = calculateMetrics(trades, settings);
    return {
      ...rawMetrics,
      currentCapital: rawMetrics.currentCapital + netCapitalTransactions,
    };
  }, [trades, settings, netCapitalTransactions]);

  const dailyPerformance = useMemo(
    () => getDailyPerformances(trades, settings.initialCapital),
    [trades, settings.initialCapital]
  );

  const weeklyPerformance = useMemo(
    () => getWeeklyPerformances(trades, settings),
    [trades, settings]
  );

  const monthlyPerformance = useMemo(
    () => getMonthlyPerformances(trades),
    [trades]
  );

  // Today's stats — must match the ACTUAL calendar date in local timezone
  const todayStr = getLocalDateStr();

  const todayPerformance = useMemo<DayPerformance | undefined>(() => {
    if (dailyPerformance.length === 0) return undefined;
    return dailyPerformance.find((d) => d.date === todayStr);
  }, [dailyPerformance, todayStr]);

  const selectedDayPerformance = useMemo<DayPerformance | undefined>(() => {
    if (!selectedDayDate) return undefined;
    return dailyPerformance.find((d) => d.date === selectedDayDate);
  }, [selectedDayDate, dailyPerformance]);

  // Daily PnL calculation for Real Account (Anti-Fúria protection)
  const todayRealPnl = useMemo(() => {
    const todayRealTrades = trades.filter((t) => {
      const isToday = t.date === todayStr;
      const isReal = t.accountType !== 'DEMO' && t.isReal !== false;
      return isToday && isReal;
    });
    return todayRealTrades.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0);
  }, [trades, todayStr]);

  const todayPnl = todayPerformance?.pnl || 0;
  const todayTradesCount = todayPerformance?.tradesCount || 0;
  const stakeStreak = useMemo(() => {
    const ordered = trades.filter((trade) => trade.date === todayStr).slice().sort((a, b) => (b.time || '').localeCompare(a.time || ''));
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    for (const trade of ordered) {
      if (trade.result === 'GAIN' && consecutiveLosses === 0) consecutiveWins += 1;
      else if (trade.result === 'LOSS' && consecutiveWins === 0) consecutiveLosses += 1;
      else break;
    }
    return { consecutiveWins, consecutiveLosses };
  }, [trades, todayStr]);
  
  // Anti-Fúria lock triggers if REAL account daily loss or total daily loss reaches limit
  const isStopHit =
    settings.dailyLossLimit > 0 &&
    ((todayRealPnl < 0 && todayRealPnl <= -settings.dailyLossLimit + 0.001) ||
     (todayPnl < 0 && todayPnl <= -settings.dailyLossLimit + 0.001));

  // Overtrading lock triggers if daily trades count reaches maxTradesPerDay limit
  const isMaxTradesHit =
    settings.maxTradesPerDay > 0 && todayTradesCount > 0 && todayTradesCount >= settings.maxTradesPerDay;

  // Combined Anti-Fúria Lock State
  const isAntiFuriaActive = isStopHit || isMaxTradesHit;

  // Real-time synchronization bridge with the Anti-Fúria Chrome Extension
  useEffect(() => {
    try {
      window.postMessage(
        {
          type: 'ANTI_FURIA_SYNC',
          isStopHit: isStopHit,
          isMaxTradesHit: isMaxTradesHit,
          maxTradesPerDay: settings.maxTradesPerDay,
          todayPnl,
          dailyLossLimit: settings.dailyLossLimit,
          winRate: metrics.winRate,
          profitFactor: metrics.profitFactor,
          todayTradesCount,
          currentCapital: metrics.currentCapital,
          maxDrawdownPercent: metrics.maxDrawdownPercent,
          blockedDomains: blockedDomains,
          enforceBrokerStakeLock: settings.enforceBrokerStakeLock,
          fixedStakeAmount: settings.fixedStakeAmount,
          sorosLevel1Stake: settings.sorosLevel1Stake,
          sorosLevel2Stake: settings.sorosLevel2Stake,
          sorosLevel3Stake: settings.sorosLevel3Stake,
          martingaleLevel1Stake: settings.martingaleLevel1Stake,
          martingaleLevel2Stake: settings.martingaleLevel2Stake,
          managementStyle: settings.managementStyle,
        },
        '*'
      );
      localStorage.setItem(
        'trader_anti_furia_state_v1',
        JSON.stringify({
          isStopHit: isStopHit,
          isMaxTradesHit: isMaxTradesHit,
          maxTradesPerDay: settings.maxTradesPerDay,
          todayPnl,
          dailyLossLimit: settings.dailyLossLimit,
          winRate: metrics.winRate,
          profitFactor: metrics.profitFactor,
          todayTradesCount,
          currentCapital: metrics.currentCapital,
          blockedDomains: blockedDomains,
          enforceBrokerStakeLock: settings.enforceBrokerStakeLock,
          fixedStakeAmount: settings.fixedStakeAmount,
          sorosLevel1Stake: settings.sorosLevel1Stake,
          sorosLevel2Stake: settings.sorosLevel2Stake,
          sorosLevel3Stake: settings.sorosLevel3Stake,
          martingaleLevel1Stake: settings.martingaleLevel1Stake,
          martingaleLevel2Stake: settings.martingaleLevel2Stake,
          managementStyle: settings.managementStyle,
          updatedAt: Date.now(),
        })
      );
      localStorage.setItem(
        'trader_journal_blocked_domains_v1',
        JSON.stringify(blockedDomains)
      );
      // Sync with server endpoint
      fetch('/api/extension/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isStopHit: isStopHit,
          isMaxTradesHit: isMaxTradesHit,
          maxTradesPerDay: settings.maxTradesPerDay,
          todayPnl,
          dailyLossLimit: settings.dailyLossLimit,
          winRate: metrics.winRate,
          profitFactor: metrics.profitFactor,
          todayTradesCount,
          currentCapital: metrics.currentCapital,
          blockedDomains: blockedDomains,
        }),
      }).catch(() => {});
      // Sync with Electron Main process & Windows Daemon
      if (typeof window !== 'undefined' && (window as any).electronAPI?.syncLockState) {
        (window as any).electronAPI.syncLockState({
          isStopHit: isStopHit,
          isMaxTradesHit: isMaxTradesHit,
          maxTradesPerDay: settings.maxTradesPerDay,
          todayPnl,
          dailyLossLimit: settings.dailyLossLimit,
          winRate: metrics.winRate,
          profitFactor: metrics.profitFactor,
          todayTradesCount,
          currentCapital: metrics.currentCapital,
          blockedDomains: blockedDomains,
          enforceBrokerStakeLock: settings.enforceBrokerStakeLock,
          fixedStakeAmount: settings.fixedStakeAmount,
          sorosLevel1Stake: settings.sorosLevel1Stake,
          sorosLevel2Stake: settings.sorosLevel2Stake,
          sorosLevel3Stake: settings.sorosLevel3Stake,
          martingaleLevel1Stake: settings.martingaleLevel1Stake,
          martingaleLevel2Stake: settings.martingaleLevel2Stake,
          managementStyle: settings.managementStyle,
          consecutiveWins: stakeStreak.consecutiveWins,
          consecutiveLosses: stakeStreak.consecutiveLosses,
        });
      }
    } catch (e) {
      console.warn('Falha ao sincronizar ponte Anti-Fúria:', e);
    }
  }, [
    isAntiFuriaActive,
    todayPnl,
    settings,
    metrics.winRate,
    todayTradesCount,
    blockedDomains,
    stakeStreak.consecutiveWins,
    stakeStreak.consecutiveLosses,
  ]);

  // Ouvinte de trades capturados automaticamente pela Extensão Chrome em tempo real
  useEffect(() => {
    const acceptCapturedTrade = (tradeData: Trade) => {
      if (!tradeData || !tradeData.id || !tradeData.date || !tradeData.asset || !Number.isFinite(Number(tradeData.pnl))) return;
      const capturedTrade: Trade = { ...tradeData, updatedAt: new Date().toISOString() };
      // OCR só envia operações completas; as antigas capturas DOM continuam sendo descartadas.
      if (
        capturedTrade.strategy?.includes('DOM') ||
        capturedTrade.notes?.includes('DOM') ||
        capturedTrade.id?.startsWith('dom-')
      ) return;

      const todayStr = getLocalDateStr();
      if (!capturedTrade.date || capturedTrade.date > todayStr) capturedTrade.date = todayStr;

      setTrades((prev) => {
        const resultToast = capturedTrade.id.startsWith('exnova-toast-');
        const isDuplicate = prev.some((t) =>
          t.id === capturedTrade.id ||
            (!resultToast &&
            t.date === capturedTrade.date &&
            t.time === capturedTrade.time &&
            t.asset === capturedTrade.asset &&
            t.pnl === capturedTrade.pnl &&
            t.type === capturedTrade.type)
        );
        if (isDuplicate) return prev;
        return sortAndSanitizeTrades([capturedTrade, ...prev]);
      });

      upsertTradeToSupabase(capturedTrade, currentUser?.email).catch(() => {});
    };

    const handleAutoCapturedMessage = (event: MessageEvent) => {
      if (
        event.data &&
        (event.data.type === 'AUTO_TRADE_CAPTURED' || event.data.type === 'TRADER_JOURNAL_AUTO_TRADE') &&
        event.data.trade
      ) {
        acceptCapturedTrade(event.data.trade as Trade);
      }
    };

    window.addEventListener('message', handleAutoCapturedMessage);
    const removeDesktopTradeListener = window.electronAPI?.onExnovaTradeCaptured?.((trade) => {
      acceptCapturedTrade(trade as Trade);
    });
    return () => {
      window.removeEventListener('message', handleAutoCapturedMessage);
      removeDesktopTradeListener?.();
    };
  }, [currentUser?.email]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.isDesktop || !api.getExnovaCaptureStatus) return;
    let mounted = true;
    api.getExnovaCaptureStatus().then((status) => {
      if (mounted) setExnovaCaptureStatus(status);
    }).catch(() => {});
    const unsubscribe = api.onExnovaCaptureStatus?.((status) => {
      if (mounted) setExnovaCaptureStatus(status);
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.isDesktop || !api.getExnovaStakeShieldStatus) return;
    let mounted = true;
    api.getExnovaStakeShieldStatus().then((status) => {
      if (mounted) setExnovaStakeShieldStatus(status);
    }).catch(() => {});
    const unsubscribe = api.onExnovaStakeShieldStatus?.((status) => {
      if (mounted) setExnovaStakeShieldStatus(status);
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const startExnovaCapture = () => {
    window.electronAPI?.startExnovaCapture?.()
      .then(setExnovaCaptureStatus)
      .catch((error) => {
        const message = String(error?.message || error || 'Falha ao iniciar captura.');
        const handlerMissing = /No handler registered for ['"]start-exnova-capture['"]/.test(message);
        setExnovaCaptureStatus({
          state: 'error',
          message: handlerMissing
            ? 'Esta versão do TradeLock Desktop não inclui o serviço de captura Exnova. Feche o app completamente e abra a versão atualizada do projeto.'
            : message,
          enabled: false,
        });
      });
  };

  const stopExnovaCapture = () => {
    window.electronAPI?.stopExnovaCapture?.()
      .then(setExnovaCaptureStatus)
      .catch((error) => setExnovaCaptureStatus({ state: 'error', message: String(error?.message || 'Falha ao pausar captura.'), enabled: false }));
  };

  // Handlers for CRUD
  const handleSaveTrade = (tradeData: Trade, bypassStopCheck = false) => {
    // 🔒 Anti-Fúria: Bloquear adição de NOVAS operações de Conta Real quando o Stop Loss ou Limite de Trades foi atingido
    const isNewTrade = !trades.some((t) => t.id === tradeData.id);
    const isRealAccount = tradeData.accountType !== 'DEMO' && tradeData.isReal !== false;
    if (isNewTrade && isRealAccount && isAntiFuriaActive && !bypassStopCheck) {
      const reason = isStopHit
        ? 'Seu Stop Loss diário de ' + formatCurrency(settings.dailyLossLimit) + ' foi atingido (P&L atual: ' + formatCurrency(todayPnl) + ').'
        : 'Você atingiu seu limite máximo de ' + settings.maxTradesPerDay + ' operações configuradas para hoje.';
      alert(
        '🔒 Trava Anti-Fúria ATIVADA!\n\n' +
        reason +
        '\n\nVocê NÃO pode registrar novas operações de Conta Real até o próximo dia. Encerre o dia e proteja seu capital!'
      );
      return;
    }

    const tradeToSave: Trade = { ...tradeData, updatedAt: new Date().toISOString() };
    setTrades((prev) => {
      const existsIndex = prev.findIndex((t) => t.id === tradeToSave.id);
      if (existsIndex >= 0) {
        const updated = [...prev];
        updated[existsIndex] = tradeToSave;
        return sortAndSanitizeTrades(updated);
      }
      return sortAndSanitizeTrades([tradeToSave, ...prev]);
    });

    // Sync to Supabase in background with userEmail scope
    upsertTradeToSupabase(tradeToSave, currentUser?.email).then((res) => {
      if (res.error) {
        console.warn('Erro ao salvar no Supabase:', res.error);
      }
    });
  };

  const handleImportTrades = (importedTrades: Trade[]) => {
    if (!importedTrades || importedTrades.length === 0) return;

    // 🔒 Anti-Fúria: Bloquear importação quando Trava Anti-Fúria estiver ativa
    if (isAntiFuriaActive) {
      const reason = isStopHit
        ? 'Seu Stop Loss diário foi atingido.'
        : 'Seu limite máximo de operações por dia foi atingido.';
      alert(
        '🔒 Trava Anti-Fúria ATIVADA!\n\n' +
        reason +
        ' A importação de novas operações está bloqueada até o próximo dia para proteger seu capital.'
      );
      return;
    }

    const stampedTrades = importedTrades.map((trade) => ({ ...trade, updatedAt: new Date().toISOString() }));
    setTrades((prev) => sortAndSanitizeTrades([...stampedTrades, ...prev]));
    // Sync each imported trade to Supabase in background with userEmail scope
    stampedTrades.forEach((trade) => {
      upsertTradeToSupabase(trade, currentUser?.email).catch((err) => {
        console.warn('Erro ao sincronizar trade importado:', err);
      });
    });
  };

  const handleDeleteTrade = (id: string) => {
    const targetTrade = trades.find((t) => t.id === id);
    if (targetTrade && isTradeProtected(targetTrade, isAntiFuriaActive)) {
      alert(
        '🔒 Ação Bloqueada pelo Sistema Anti-Fúria!\n\nOperações de Conta Real ou registradas durante ativação do Anti-Fúria são imutáveis e não podem ser excluídas para proteger sua gestão de risco.'
      );
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir esta operação do diário?')) {
      saveDeletedId(DELETED_TRADES_KEY, id);
      const remaining = tradesRef.current.filter((t) => t.id !== id);
      tradesRef.current = remaining;
      setTrades(remaining);
      deleteTradeFromSupabase(id, currentUser?.email).then((result) => {
        if (!result.success) console.warn('Falha ao confirmar exclusão da operação na nuvem:', result.error);
      }).catch((err) => {
        console.warn('Erro ao remover do Supabase:', err);
      });
    }
  };

  const handleDeleteMultipleTrades = (ids: string[]) => {
    if (!ids || ids.length === 0) return;

    const targetTrades = trades.filter((t) => ids.includes(t.id));
    const protectedCount = targetTrades.filter((t) => isTradeProtected(t, isAntiFuriaActive)).length;
    const deletableIds = targetTrades.filter((t) => !isTradeProtected(t, isAntiFuriaActive)).map((t) => t.id);

    if (protectedCount > 0) {
      alert(
        `🔒 Proteção Anti-Fúria Ativada:\n\n${protectedCount} operação(ões) foram preservadas e NÃO puderam ser excluídas para manter a integridade da sua trava de risco.`
      );
    }

    if (deletableIds.length === 0) return;

    if (
      window.confirm(`Deseja realmente excluir as ${deletableIds.length} operações selecionadas?`)
    ) {
      const idSet = new Set(deletableIds);
      deletableIds.forEach((id) => saveDeletedId(DELETED_TRADES_KEY, id));
      const remaining = tradesRef.current.filter((t) => !idSet.has(t.id));
      tradesRef.current = remaining;
      setTrades(remaining);
      deletableIds.forEach((id) => {
        deleteTradeFromSupabase(id, currentUser?.email).then((result) => {
          if (!result.success) console.warn('Falha ao confirmar exclusão da operação na nuvem:', result.error);
        }).catch((err) => {
          console.warn('Erro ao remover do Supabase:', err);
        });
      });
    }
  };

  const handleSaveSettings = (newSettings: RiskSettings) => {
    // 🔒 Proteção Anti-Fúria: Apenas impede AUMENTAR os limites se a respectiva trava foi atingida no dia
    if (isStopHit && newSettings.dailyLossLimit > settings.dailyLossLimit) {
      alert(
        '🔒 Proteção Anti-Fúria ATIVADA!\n\nSeu Stop Loss diário foi atingido. O limite de perda não pode ser alterado para um valor maior enquanto a trava estiver ativa.'
      );
      newSettings.dailyLossLimit = settings.dailyLossLimit;
    }

    if (isMaxTradesHit && newSettings.maxTradesPerDay > settings.maxTradesPerDay) {
      alert(
        '🔒 Proteção Anti-Fúria ATIVADA!\n\nSeu limite diário de operações foi atingido. O número máximo de operações não pode ser aumentado enquanto a trava estiver ativa.'
      );
      newSettings.maxTradesPerDay = settings.maxTradesPerDay;
    }

    const settingsToSave: RiskSettings = { ...newSettings, updatedAt: new Date().toISOString() };
    setSettings(settingsToSave);
    try {
      if (SETTINGS_STORAGE_KEY) {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsToSave));
      }
      localStorage.setItem('trader_journal_settings_v1', JSON.stringify(settingsToSave));
      localStorage.setItem('trader_journal_settings_default', JSON.stringify(settingsToSave));
    } catch (e) {
      console.warn('Erro ao salvar settings no localStorage:', e);
    }
    // Save to Supabase in background
    saveRiskSettingsToSupabase(settingsToSave, currentUser?.email).then((res) => {
      if (res.error) {
        console.warn('Erro ao salvar configurações no Supabase:', res.error);
      }
    });
  };

  const handleEditTrade = (trade: Trade) => {
    setEditingTrade(trade);
    setIsTradeModalOpen(true);
  };

  const handleOpenNewTrade = () => {
    // 🔒 Anti-Fúria: Bloquear abertura do modal de nova operação quando Stop Loss ou Limite de Trades foi atingido
    if (isAntiFuriaActive) {
      const reason = isStopHit
        ? 'Seu Stop Loss diário de ' + formatCurrency(settings.dailyLossLimit) + ' foi atingido (P&L atual: ' + formatCurrency(todayPnl) + ').'
        : 'Você atingiu seu limite máximo de ' + settings.maxTradesPerDay + ' operações configuradas para hoje.';
      alert(
        '🔒 Trava Anti-Fúria ATIVADA!\n\n' +
        reason +
        '\n\nVocê NÃO pode registrar novas operações até o próximo dia. Encerre o dia e proteja seu capital!'
      );
      return;
    }
    setEditingTrade(null);
    setIsTradeModalOpen(true);
  };

  const handleOpenNewTradeForDate = (targetDate: string) => {
    // 🔒 Anti-Fúria: Bloquear também para data específica usando fuso local
    const todayStr = getLocalDateStr();
    if (targetDate === todayStr && isAntiFuriaActive) {
      const reason = isStopHit
        ? 'Seu Stop Loss diário foi atingido.'
        : 'Seu limite diário de operações foi atingido.';
      alert(
        '🔒 Trava Anti-Fúria ATIVADA!\n\n' + reason + ' Você NÃO pode adicionar novas operações para hoje.'
      );
      return;
    }
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setEditingTrade({
      id: `trade-${Date.now()}`,
      date: targetDate,
      time: timeStr,
      asset: '',
      type: 'BUY',
      strategy: '',
      result: 'GAIN',
      pnl: 0,
      contractsOrQuantity: 0,
    });
    setIsTradeModalOpen(true);
  };

  const handleResetData = async () => {
    const protectedTrades = trades.filter((t) => isTradeProtected(t));

    if (protectedTrades.length > 0) {
      alert(
        `🔒 Proteção Anti-Fúria Ativada:\n\nSua conta possui ${protectedTrades.length} operação(ões) de Conta Real registradas. O Sistema Anti-Fúria preservou estas operações contra exclusão para que o histórico e os bloqueios de risco não sejam burlados.\n\nApenas operações manuais/demonstração foram limpas.`
      );
      setTrades(protectedTrades);
      setClearedNotificationIds([]);
      setDismissedAlerts({});
      return;
    }

    if (
      window.confirm(
        'Deseja realmente limpar todas as operações registradas no diário? Seus dados serão zerados localmente e na nuvem.'
      )
    ) {
      setTrades([]);
      setClearedNotificationIds([]);
      setDismissedAlerts({});
      try {
        localStorage.removeItem('trader_journal_trades_v1');
        localStorage.removeItem('trader_journal_trades_v2');
      } catch (e) {
        console.error(e);
      }
      if (supabaseHealth.status === 'connected') {
        try {
          const result = await clearAllTradesFromSupabase(currentUser?.email);
          if (!result.success) throw new Error(result.error || 'Falha ao limpar operações na nuvem.');
        } catch (e) {
          console.warn('Erro ao limpar Supabase:', e);
          alert(`As operações foram limpas localmente, mas a nuvem não confirmou a exclusão: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  };

  // Compute active real-time notifications for targets and risk limits
  const notifications = useMemo<NotificationAlert[]>(() => {
    const list: NotificationAlert[] = [];
    const todayPnl = todayPerformance?.pnl || 0;
    const tradesCount = todayPerformance?.tradesCount || 0;
    const dailyTarget = settings?.dailyProfitTarget ?? 500;
    const dailyLoss = settings?.dailyLossLimit ?? 300;
    const maxTrades = settings?.maxTradesPerDay ?? 5;

    if (dailyTarget > 0 && todayPnl > 0 && todayPnl >= dailyTarget) {
      list.push({
        id: 'notif-target-hit',
        type: 'TARGET_REACHED',
        title: 'Meta Diária Batida! 🎉',
        message: `Parabéns! Você alcançou ${formatCurrency(todayPnl)}, superando sua meta de ${formatCurrency(dailyTarget)}. Considere proteger seus ganhos.`,
        timestamp: 'Hoje',
        date: todayPerformance?.date || '',
        severity: 'success',
      });
    } else if (dailyTarget > 0 && todayPnl > 0 && todayPnl >= dailyTarget * 0.8) {
      list.push({
        id: 'notif-target-80',
        type: 'INFO',
        title: '🎯 80% da Meta Atingida!',
        message: `Você alcançou ${formatCurrency(todayPnl)} (${Math.round((todayPnl / dailyTarget) * 100)}% da meta de ${formatCurrency(dailyTarget)}). Mantenha a autodisciplina!`,
        timestamp: 'Hoje',
        date: todayPerformance?.date || '',
        severity: 'info',
      });
    }

    if (dailyLoss > 0 && todayPnl < 0 && todayPnl <= -dailyLoss) {
      list.push({
        id: 'notif-loss-limit',
        type: 'LOSS_LIMIT_REACHED',
        title: 'Stop Diário Atingido ⚠️',
        message: `Limite de perda diário de ${formatCurrency(dailyLoss)} atingido (${formatCurrency(todayPnl)}). Encerre o dia para proteger seu capital.`,
        timestamp: 'Hoje',
        date: todayPerformance?.date || '',
        severity: 'error',
      });
    } else if (dailyLoss > 0 && todayPnl < 0 && todayPnl <= -dailyLoss * 0.8) {
      list.push({
        id: 'notif-loss-80',
        type: 'WARNING_NEAR_STOP',
        title: '⚠️ 80% do Limite de Perda!',
        message: `Atenção: Sua perda atingiu ${formatCurrency(Math.abs(todayPnl))} (${Math.round((Math.abs(todayPnl) / dailyLoss) * 100)}% do limite de ${formatCurrency(dailyLoss)}). Proteja seu capital!`,
        timestamp: 'Hoje',
        date: todayPerformance?.date || '',
        severity: 'warning',
      });
    }

    if (maxTrades > 0 && tradesCount > 0 && tradesCount >= maxTrades) {
      list.push({
        id: 'notif-overtrading',
        type: 'WARNING_NEAR_STOP',
        title: 'Alerta de Overtrading ⏱️',
        message: `Você realizou ${tradesCount} operações hoje, atingindo o limite de ${maxTrades} trades recomendados por dia.`,
        timestamp: 'Hoje',
        date: todayPerformance?.date || '',
        severity: 'warning',
      });
    }

    if ((metrics?.currentDrawdownPercent ?? 0) >= 8) {
      list.push({
        id: 'notif-drawdown',
        type: 'DRAWDOWN_ALERT',
        title: 'Drawdown Elevado 📉',
        message: `Drawdown acumulado atual em ${(metrics?.currentDrawdownPercent ?? 0).toFixed(1)}%. Reduza a mão para preservar o patrimônio.`,
        timestamp: 'Recente',
        date: todayPerformance?.date || '',
        severity: 'warning',
      });
    }

    return list.filter((n) => !clearedNotificationIds.includes(n.id));
  }, [todayPerformance, settings, metrics?.currentDrawdownPercent, clearedNotificationIds]);

  const handleClearNotifications = () => {
    setClearedNotificationIds(notifications.map((n) => n.id));
  };

  const handleAddCapitalTransaction = (tx: CapitalTransaction) => {
    setCapitalTransactions((prev) => {
      const updated = [tx, ...prev.filter((t) => t.id !== tx.id)];
      try {
        localStorage.setItem(CAPITAL_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    if (currentUser?.email) {
      upsertCapitalTransactionToSupabase(tx, currentUser.email).catch((err) => {
        console.warn('Erro ao salvar movimentação de capital no Supabase:', err);
      });
    }
  };

  const handleAddMultipleCapitalTransactions = (newTxs: CapitalTransaction[]) => {
    if (!newTxs || newTxs.length === 0) return;
    setCapitalTransactions((prev) => {
      const map = new Map<string, CapitalTransaction>();
      prev.forEach((t) => map.set(t.id, t));
      newTxs.forEach((t) => map.set(t.id, t));
      const updated = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
      try {
        localStorage.setItem(CAPITAL_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    if (currentUser?.email) {
      syncAllCapitalTransactionsToSupabase(newTxs, currentUser.email).catch((err) => {
        console.warn('Erro ao sincronizar movimentações no Supabase:', err);
      });
    }
  };

  const handleDeleteCapitalTransaction = (id: string) => {
    saveDeletedId(DELETED_CAPITAL_KEY, id);
    const updated = capitalTransactionsRef.current.filter((t) => t.id !== id);
    capitalTransactionsRef.current = updated;
    setCapitalTransactions(updated);
    if (currentUser?.email) {
      deleteCapitalTransactionFromSupabase(id, currentUser.email).then((result) => {
        if (!result.success) console.warn('Falha ao confirmar exclusão da movimentação na nuvem:', result.error);
      }).catch((err) => {
        console.warn('Erro ao remover movimentação de capital no Supabase:', err);
      });
    }
  };

  const handleDeleteMultipleCapitalTransactions = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    ids.forEach((id) => saveDeletedId(DELETED_CAPITAL_KEY, id));
    const updated = capitalTransactionsRef.current.filter((t) => !ids.includes(t.id));
    capitalTransactionsRef.current = updated;
    setCapitalTransactions(updated);
    if (currentUser?.email) {
      ids.forEach((id) => {
        deleteCapitalTransactionFromSupabase(id, currentUser.email).then((result) => {
          if (!result.success) console.warn('Falha ao confirmar exclusão da movimentação na nuvem:', result.error);
        }).catch((err) => {
          console.warn('Erro ao remover movimentação de capital no Supabase:', err);
        });
      });
    }
  };

  const handleDismissAlert = (alertKey: string) => {
    setDismissedAlerts((prev) => ({ ...prev, [alertKey]: true }));
  };

  if (!currentUser) {
    const savedStateStr = typeof window !== 'undefined' ? localStorage.getItem('trader_anti_furia_state_v1') : null;
    let isLoggedOutLockActive = false;
    let loggedOutPnl = 0;
    let loggedOutLimit = 30;

    if (savedStateStr) {
      try {
        const parsed = JSON.parse(savedStateStr);
        const todayStr = getLocalDateStr();
        const updatedDate = parsed.updatedAt ? getLocalDateStr(parsed.updatedAt) : '';
        if (updatedDate === todayStr && (parsed.isStopHit || parsed.isMaxTradesHit)) {
          isLoggedOutLockActive = true;
          loggedOutPnl = parsed.todayPnl || 0;
          loggedOutLimit = parsed.dailyLossLimit || 30;
        }
      } catch (e) {}
    }

    return (
      <>
        {isLoggedOutLockActive && (
          <div
            id="anti-furia-status-bridge"
            data-stophit="true"
            data-max-trades-hit="true"
            data-user-active="true"
            data-sub-status="ACTIVE"
            data-today-pnl={loggedOutPnl}
            data-loss-limit={loggedOutLimit}
            style={{ display: 'none' }}
          />
        )}
        <LoginScreen onLoginSuccess={(user) => setCurrentUser(user)} />
      </>
    );
  }

  // 🔒 Bloqueio de Acesso por Assinatura Suspensa / Inadimplência
  const isSubscriptionBlocked =
    currentUser.role === 'CLIENT' &&
    (currentUser.active === false ||
      currentUser.subscriptionStatus === 'OVERDUE' ||
      currentUser.subscriptionStatus === 'INACTIVE');

  if (isSubscriptionBlocked) {
    const whatsappNum = (currentUser.whatsapp || '11999999999').replace(/\D/g, '');
    const waMessage = encodeURIComponent(
      `Olá! Meu nome é ${currentUser.name} (${currentUser.email}). Gostaria de regularizar minha assinatura do TradeLock para liberar meu acesso.`
    );

    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 text-slate-100 selection:bg-rose-500 selection:text-white">
        {/* DOM Bridge para sincronizar o bloqueio de assinatura com a extensão Chrome */}
        <div
          id="anti-furia-status-bridge"
          data-stophit="true"
          data-user-active="false"
          data-sub-status={currentUser.subscriptionStatus || 'OVERDUE'}
          data-user-role={currentUser.role}
          data-today-pnl={todayPnl}
          data-loss-limit={settings.dailyLossLimit}
          data-winrate={metrics.winRate}
          data-profit-factor={metrics.profitFactor}
          data-trades-count={todayPerformance?.tradesCount || 0}
          data-capital={metrics.currentCapital}
          style={{ display: 'none' }}
        />
        <div className="rounded-3xl border-2 border-rose-600 bg-black p-8 sm:p-10 text-center max-w-lg shadow-[0_0_60px_rgba(225,29,72,0.4)] space-y-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-400 mx-auto shadow-lg">
            <Lock className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <span className="rounded-full bg-rose-600/30 px-3.5 py-1 text-[10px] font-extrabold text-rose-300 border border-rose-500/40 uppercase font-mono tracking-wider">
              ACESSO SUSPENSO — ASSINATURA INADIMPLENTE
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white font-mono uppercase tracking-tight mt-3">
              Plano Bloqueado pela Administração
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
              Olá, <strong className="text-white">{currentUser.name}</strong>! Seu acesso à plataforma e ao bloqueador de corretoras foi suspenso devido à pendência no plano de assinatura.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-black p-4 text-left text-xs space-y-2 font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Status da Conta:</span>
              <span className="text-rose-400 font-bold uppercase">
                {currentUser.subscriptionStatus === 'OVERDUE' ? 'EM ATRASO (INADIMPLENTE)' : 'DESATIVADO'}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Vencimento do Plano:</span>
              <span className="text-white font-bold">
                {currentUser.subscriptionExpiresAt
                  ? currentUser.subscriptionExpiresAt.split('-').reverse().join('/')
                  : 'Vencido'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a
              href={`https://wa.me/55${whatsappNum}?text=${waMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs shadow-lg shadow-emerald-950/50 transition"
            >
              <span>💬 Regularizar no WhatsApp</span>
            </a>
            <button
              onClick={handleLogout}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-bold text-xs transition"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'ADMIN_CLIENTS' && currentUser) {
    return (
      <AdminUserManagementPage
        currentUser={currentUser}
        onBackToDashboard={() => setCurrentView('JOURNAL')}
      />
    );
  }

  if (currentView === 'ANTI_FURIA' && currentUser) {
    return (
      <AntiFuriaExtensionPage
        onBackToDashboard={() => setCurrentView('JOURNAL')}
        isStopHit={isStopHit}
        isMaxTradesHit={isMaxTradesHit}
        maxTradesPerDay={settings.maxTradesPerDay}
        todayPnl={todayPnl}
        dailyLossLimit={settings.dailyLossLimit}
        winRate={metrics.winRate}
        profitFactor={metrics.profitFactor}
        todayTradesCount={todayPerformance?.tradesCount || 0}
        currentCapital={metrics.currentCapital}
        currentUser={currentUser}
        blockedDomains={blockedDomains}
        onUpdateBlockedDomains={(newDomains) => setBlockedDomains(newDomains)}
        exnovaCaptureStatus={exnovaCaptureStatus}
        exnovaStakeShieldStatus={exnovaStakeShieldStatus}
        onStartExnovaCapture={startExnovaCapture}
        onStopExnovaCapture={stopExnovaCapture}
      />
    );
  }

  if (currentView === 'RISK_MANAGEMENT' && currentUser) {
    return (
      <RiskManagementPage
        settings={settings}
        currentCapital={metrics.currentCapital}
        todayPnl={todayPnl}
        todayTradesCount={todayPerformance?.tradesCount || 0}
        isStopHit={isStopHit}
        isMaxTradesHit={isMaxTradesHit}
        onSaveSettings={handleSaveSettings}
        onBackToJournal={() => setCurrentView('JOURNAL')}
      />
    );
  }

  if (currentView === 'CAPITAL_MANAGEMENT' && currentUser) {
    return (
      <CapitalHistoryModal
        isOpen={true}
        onClose={() => setCurrentView('JOURNAL')}
        transactions={capitalTransactions}
        onAddTransaction={handleAddCapitalTransaction}
        onAddMultipleTransactions={handleAddMultipleCapitalTransactions}
        onDeleteTransaction={handleDeleteCapitalTransaction}
        onDeleteMultipleTransactions={handleDeleteMultipleCapitalTransactions}
        currentCapital={metrics.currentCapital}
        initialCapital={settings.initialCapital}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-emerald-500 selection:text-white pb-16">
      {/* Top Navigation */}
      <Navbar
        metrics={metrics}
        settings={settings}
        notifications={notifications}
        todayPnl={todayPnl}
        todayTradesCount={todayPerformance?.tradesCount || 0}
        currentCapital={metrics.currentCapital}
        supabaseStatus={supabaseHealth.status}
        supabaseMessage={supabaseHealth.message}
        currentCurrency={currency}
        currentUser={currentUser}
        onCurrencyChange={handleCurrencyChange}
        onOpenNewTrade={handleOpenNewTrade}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenSettings={() => setCurrentView('RISK_MANAGEMENT')}
        onOpenAiMentor={() => setIsAiMentorOpen(true)}
        onOpenKellyCalculator={() => setIsKellyCalculatorOpen(true)}
        onOpenStakePlanner={() => setIsStakePlannerOpen(true)}
        onOpenSupabase={() => setIsSupabaseModalOpen(true)}
        onOpenAntiFuria={() => setCurrentView('ANTI_FURIA')}
        onOpenPdfReport={() => setIsPdfReportOpen(true)}
        onOpenAdminManagement={() => setCurrentView('ADMIN_CLIENTS')}
        onLogout={handleLogout}
        onClearNotifications={handleClearNotifications}
        onResetData={handleResetData}
      />

      {/* Invisible DOM Bridge for Chrome Extension Content Scripts */}
      <div
        id="anti-furia-status-bridge"
        data-stophit={isStopHit ? 'true' : 'false'}
        data-max-trades-hit={isMaxTradesHit ? 'true' : 'false'}
        data-max-trades={settings.maxTradesPerDay || 5}
        data-user-active={currentUser?.active !== false ? 'true' : 'false'}
        data-sub-status={currentUser?.subscriptionStatus || 'ACTIVE'}
        data-user-role={currentUser?.role || 'CLIENT'}
        data-today-pnl={todayPnl}
        data-loss-limit={settings.dailyLossLimit}
        data-winrate={metrics.winRate}
        data-profit-factor={metrics.profitFactor}
        data-trades-count={todayPerformance?.tradesCount || 0}
        data-capital={metrics.currentCapital}
        data-blocked-domains={JSON.stringify(blockedDomains)}
        data-enforce-stake-lock={settings.enforceBrokerStakeLock ? 'true' : 'false'}
        data-fixed-stake={settings.fixedStakeAmount || 50}
        data-soros-l1={settings.sorosLevel1Stake || 93.5}
        data-soros-l2={settings.sorosLevel2Stake || 174.8}
        data-soros-l3={settings.sorosLevel3Stake || 326.9}
        data-mg-l1={settings.martingaleLevel1Stake || 100}
        data-mg-l2={settings.martingaleLevel2Stake || 200}
        data-mgmt-style={settings.managementStyle || 'MAO_FIXA'}
        style={{ display: 'none' }}
      />

      {/* Main Container */}
      <main className="w-full max-w-[1920px] mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-28 lg:pb-12 space-y-5 sm:space-y-6">
        {/* Supabase Notice Banner if tables not created yet */}
        {supabaseHealth.status === 'table_missing' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
              <span>
                <strong>Supabase Conectado!</strong> Falta apenas executar o script SQL no painel do Supabase para criar as tabelas e ativar a sincronização na nuvem.
              </span>
            </div>
            <button
              onClick={() => setIsSupabaseModalOpen(true)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition shadow-sm shrink-0 text-xs"
            >
              Copiar Script SQL & Ativar
            </button>
          </div>
        )}

        {/* Dynamic Risk & Target Alert Banners (Confetti on Target, Warning on Loss Limit) */}
        <RiskAlertBanner
          todayPnl={todayPnl}
          todayTradesCount={todayPerformance?.tradesCount || 0}
          settings={settings}
          dismissedAlerts={dismissedAlerts}
          onDismiss={handleDismissAlert}
          onOpenSettings={() => setCurrentView('RISK_MANAGEMENT')}
          onOpenAntiFuria={() => setCurrentView('ANTI_FURIA')}
        />

        {/* View Switcher Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-black/80 p-2.5 sm:p-3 backdrop-blur-sm">
          {/* Tabs (Horizontally scrollable on narrow mobile screens) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto max-w-full">
            <button
              onClick={() => setActiveView('all')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition ${
                activeView === 'all'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Painel Completo</span>
            </button>

            <button
              onClick={() => setActiveView('charts')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition ${
                activeView === 'charts'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BarChart2 className="h-4 w-4" />
              <span>Gráficos & Risco</span>
            </button>

            <button
              onClick={() => setActiveView('calendar')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition ${
                activeView === 'calendar'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <CalendarIcon className="h-4 w-4" />
              <span>Calendário Mensal</span>
            </button>

            <button
              onClick={() => setActiveView('weekly')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition ${
                activeView === 'weekly'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <CalendarRange className="h-4 w-4" />
              <span>Resumos Semanais</span>
            </button>

            <button
              onClick={() => setActiveView('trades')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition ${
                activeView === 'trades'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ListFilter className="h-4 w-4" />
              <span>Diário ({trades.length})</span>
            </button>
          </div>

          {/* Quick CTAs (Desktop / Tablet) */}
          <div className="hidden sm:flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setIsAiMentorOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-teal-500/40 bg-teal-950/30 px-3.5 py-1.5 text-xs font-bold text-teal-300 hover:bg-teal-900/40 transition"
            >
              <Brain className="h-3.5 w-3.5 text-teal-400" />
              <span>Auditoria IA</span>
            </button>

            <button
              onClick={handleOpenNewTrade}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-900/30 hover:bg-emerald-500 transition"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Novo Trade</span>
            </button>
          </div>
        </div>

        {/* Essential KPI Cards (Capital, Assertividade, Drawdown, Rentabilidade, Fator de Lucro) */}
        <KpiCards
          metrics={metrics}
          settings={settings}
          todayPerformance={todayPerformance}
          dailyPerformance={dailyPerformance}
          dailyProfitTarget={settings.dailyProfitTarget}
          onOpenCapitalModal={() => setCurrentView('CAPITAL_MANAGEMENT')}
          onOpenKellyCalculator={() => setIsKellyCalculatorOpen(true)}
        />

        {/* Conditional View Sections */}

        {/* VIEW: ALL (FULL DASHBOARD) */}
        {activeView === 'all' && (
          <div className="space-y-6">
            {/* Charts Section */}
            <PerformanceCharts
              dailyData={dailyPerformance}
              trades={trades}
              metrics={metrics}
              settings={settings}
              onSelectDay={(date) => setSelectedDayDate(date)}
            />

            {/* Monthly Calendar with Asset and Strategy Filters */}
            <MonthlyCalendar
              trades={trades}
              onSelectDay={(date) => setSelectedDayDate(date)}
            />

            {/* Weekly Performance Summaries */}
            <WeeklyPerformancePanel
              weeklyData={weeklyPerformance}
              settings={settings}
            />

            {/* Complete Trade Ledger */}
            <TradeList
              trades={trades}
              onOpenNewTrade={handleOpenNewTrade}
              onOpenImportModal={() => setIsImportModalOpen(true)}
              onEditTrade={handleEditTrade}
              onDeleteTrade={handleDeleteTrade}
              onDeleteMultipleTrades={handleDeleteMultipleTrades}
              onResetData={handleResetData}
              isAntiFuriaActive={isAntiFuriaActive}
            />
          </div>
        )}

        {/* VIEW: CHARTS ONLY */}
        {activeView === 'charts' && (
          <div className="space-y-6">
            <PerformanceCharts
              dailyData={dailyPerformance}
              trades={trades}
              metrics={metrics}
              settings={settings}
              onSelectDay={(date) => setSelectedDayDate(date)}
            />
          </div>
        )}

        {/* VIEW: CALENDAR ONLY */}
        {activeView === 'calendar' && (
          <div className="space-y-6">
            <MonthlyCalendar
              trades={trades}
              onSelectDay={(date) => setSelectedDayDate(date)}
            />
          </div>
        )}

        {/* VIEW: WEEKLY SUMMARIES ONLY */}
        {activeView === 'weekly' && (
          <div className="space-y-6">
            <WeeklyPerformancePanel
              weeklyData={weeklyPerformance}
              settings={settings}
            />
          </div>
        )}

        {/* VIEW: TRADES LOG ONLY */}
        {activeView === 'trades' && (
          <div className="space-y-6">
            <TradeList
              trades={trades}
              onOpenNewTrade={handleOpenNewTrade}
              onOpenImportModal={() => setIsImportModalOpen(true)}
              onEditTrade={handleEditTrade}
              onDeleteTrade={handleDeleteTrade}
              onDeleteMultipleTrades={handleDeleteMultipleTrades}
              onResetData={handleResetData}
              isAntiFuriaActive={isAntiFuriaActive}
            />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Optimized for Android & iOS Touch Ergonomics) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-slate-800 bg-black/95 backdrop-blur-lg pb-safe">
        <div className="grid grid-cols-5 items-center h-16 px-1 max-w-md mx-auto">
          {/* 1. Painel */}
          <button
            onClick={() => setActiveView('all')}
            className={`flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-bold transition active:scale-95 ${
              activeView === 'all'
                ? 'text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>Painel</span>
          </button>

          {/* 2. Calendário */}
          <button
            onClick={() => setActiveView('calendar')}
            className={`flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-bold transition active:scale-95 ${
              activeView === 'calendar'
                ? 'text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarIcon className="h-5 w-5" />
            <span>Calendário</span>
          </button>

          {/* 3. Center FAB Button (+ Trade) */}
          <div className="flex items-center justify-center -mt-5">
            <button
              onClick={handleOpenNewTrade}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-950/80 active:scale-90 transition border border-emerald-400/30"
              title="Adicionar Nova Operação"
            >
              <PlusCircle className="h-6 w-6" />
            </button>
          </div>

          {/* 4. Diário / Operações */}
          <button
            onClick={() => setActiveView('trades')}
            className={`flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-bold transition active:scale-95 ${
              activeView === 'trades'
                ? 'text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListFilter className="h-5 w-5" />
            <span>Diário</span>
          </button>

          {/* 5. Mentor IA */}
          <button
            onClick={() => setIsAiMentorOpen(true)}
            className="flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-bold text-teal-400 hover:text-teal-300 transition active:scale-95"
          >
            <Brain className="h-5 w-5" />
            <span>Mentor IA</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      <TradeFormModal
        isOpen={isTradeModalOpen}
        onClose={() => {
          setIsTradeModalOpen(false);
          setEditingTrade(null);
        }}
        onSave={handleSaveTrade}
        editingTrade={editingTrade}
      />

      <RiskSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
        isStopHit={isStopHit}
        isMaxTradesHit={isMaxTradesHit}
        isAntiFuriaActive={isAntiFuriaActive}
      />

      <DayDetailModal
        date={selectedDayDate}
        trades={trades}
        dayPerformance={selectedDayPerformance}
        onClose={() => setSelectedDayDate(null)}
        onOpenNewTradeForDate={(date) => {
          setSelectedDayDate(null);
          handleOpenNewTradeForDate(date);
        }}
        onEditTrade={(t) => {
          setSelectedDayDate(null);
          handleEditTrade(t);
        }}
        onDeleteTrade={(id) => {
          handleDeleteTrade(id);
        }}
        onDeleteMultipleTrades={handleDeleteMultipleTrades}
        isAntiFuriaActive={isAntiFuriaActive}
      />

      <AiTraderMentorModal
        isOpen={isAiMentorOpen}
        onClose={() => setIsAiMentorOpen(false)}
        metrics={metrics}
        settings={settings}
        trades={trades}
      />

      <SupabaseSyncModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        health={supabaseHealth}
        onRefreshHealth={refreshSupabaseStatus}
        trades={trades}
        settings={settings}
        onTradesLoadedFromCloud={(cloudTrades) => setTrades(cloudTrades)}
      />

      <KellyCalculatorModal
        isOpen={isKellyCalculatorOpen}
        onClose={() => setIsKellyCalculatorOpen(false)}
        metrics={metrics}
        currentCapital={metrics.currentCapital}
      />

      <StakePlannerModal
        isOpen={isStakePlannerOpen}
        onClose={() => setIsStakePlannerOpen(false)}
        initialCapital={metrics.currentCapital}
        trades={trades}
        metrics={metrics}
        settings={settings}
      />

      <ImportTradesModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportTrades={handleImportTrades}
      />

      <PDFReportModal
        isOpen={isPdfReportOpen}
        onClose={() => setIsPdfReportOpen(false)}
        trades={trades}
        metrics={metrics}
        settings={settings}
        dailyPerformance={dailyPerformance}
        monthlyPerformance={monthlyPerformance}
      />

      {/* Elemento de ponte DOM para a Extensão Anti-Fúria sincronizar instantaneamente via content script */}
      <div
        id="trader-anti-furia-status-bridge"
        style={{ display: 'none' }}
        data-is-stop-hit={String(isStopHit)}
        data-is-max-trades-hit={String(isMaxTradesHit)}
        data-max-trades-per-day={String(settings.maxTradesPerDay)}
        data-today-pnl={String(todayPnl)}
        data-loss-limit={String(settings.dailyLossLimit)}
        data-winrate={String(metrics.winRate)}
        data-profit-factor={String(metrics.profitFactor)}
        data-trades-count={String(todayTradesCount)}
        data-capital={String(metrics.currentCapital)}
        data-enforce-stake-lock={String(Boolean(settings.enforceBrokerStakeLock))}
        data-fixed-stake={String(settings.fixedStakeAmount || 50)}
        data-soros-l1={String(settings.sorosLevel1Stake || 93.5)}
        data-soros-l2={String(settings.sorosLevel2Stake || 174.8)}
        data-soros-l3={String(settings.sorosLevel3Stake || 326.9)}
        data-mg-l1={String(settings.martingaleLevel1Stake || 100)}
        data-mg-l2={String(settings.martingaleLevel2Stake || 200)}
        data-mgmt-style={settings.managementStyle || 'MAO_FIXA'}
        data-blocked-domains={JSON.stringify(blockedDomains)}
        data-user-active={String(currentUser?.active ?? true)}
        data-sub-status={currentUser?.subscriptionStatus || 'ACTIVE'}
        data-user-role={currentUser?.role || 'CLIENT'}
      />
    </div>
  );
}

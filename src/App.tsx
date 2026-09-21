import React, { useState, useMemo, useEffect } from 'react';
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
import { AntiFuriaExtensionModal } from './components/AntiFuriaExtensionModal';
import { CapitalHistoryModal } from './components/CapitalHistoryModal';
import { KellyCalculatorModal } from './components/KellyCalculatorModal';
import { StakePlannerModal } from './components/StakePlannerModal';
import { ImportTradesModal } from './components/ImportTradesModal';
import { PDFReportModal } from './components/PDFReportModal';
import { LoginScreen } from './components/LoginScreen';
import { AdminUserManagementModal } from './components/AdminUserManagementModal';
import { getCurrentSession, logoutUser } from './utils/auth';
import { SystemUser } from './types';
import {
  supabase,
  checkSupabaseConnection,
  fetchTradesFromSupabase,
  fetchRiskSettingsFromSupabase,
  fetchCapitalTransactionsFromSupabase,
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

export default function App() {
  // 0. Auth State
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => getCurrentSession());
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
  };

  // User-Scoped LocalStorage Keys
  const userEmailKey = currentUser?.email?.toLowerCase().trim() || 'default';
  const TRADES_STORAGE_KEY = `trader_journal_trades_${userEmailKey}`;
  const SETTINGS_STORAGE_KEY = `trader_journal_settings_${userEmailKey}`;
  const CAPITAL_STORAGE_KEY = `trader_journal_capital_txs_${userEmailKey}`;

  // 1. Trades State
  const [trades, setTrades] = useState<Trade[]>([]);

  // 2. Risk Settings State
  const [settings, setSettings] = useState<RiskSettings>(DEFAULT_RISK_SETTINGS);

  // 3. Capital Transactions State
  const [capitalTransactions, setCapitalTransactions] = useState<CapitalTransaction[]>([]);
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);

  // Flag para rastrear quando os dados iniciais foram hidratados
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Re-hydrate user-isolated data whenever currentUser changes
  useEffect(() => {
    if (!currentUser) return;
    setIsDataLoaded(false);

    // Load user's isolated trades
    try {
      const savedTrades = localStorage.getItem(TRADES_STORAGE_KEY);
      let loadedTrades: Trade[] = [];

      if (savedTrades && savedTrades !== 'undefined' && savedTrades !== 'null') {
        const parsed = JSON.parse(savedTrades);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedTrades = parsed.filter((t) => !/^tr-0\d{2}$/.test(t.id) && t.id !== 'tr-024');
        }
      }

      // Se for o Admin e o storage escopado estiver vazio, resgata do armazenamento legado
      if (loadedTrades.length === 0 && currentUser.email.toLowerCase() === 'oswamitrader@gmail.com') {
        const legacySaved = localStorage.getItem('trader_journal_trades_v2') || localStorage.getItem('trader_journal_trades_v1');
        if (legacySaved && legacySaved !== 'undefined' && legacySaved !== 'null') {
          const parsed = JSON.parse(legacySaved);
          if (Array.isArray(parsed)) {
            loadedTrades = parsed.filter((t) => !/^tr-0\d{2}$/.test(t.id) && t.id !== 'tr-024');
          }
        }
      }

      setTrades(loadedTrades);
    } catch {
      setTrades([]);
    }

    // Load user's isolated risk settings
    try {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings && savedSettings !== 'undefined' && savedSettings !== 'null') {
        setSettings({ ...DEFAULT_RISK_SETTINGS, ...JSON.parse(savedSettings) });
      } else if (currentUser.email.toLowerCase() === 'oswamitrader@gmail.com') {
        const legacySettings = localStorage.getItem('trader_journal_settings_v1');
        if (legacySettings) setSettings({ ...DEFAULT_RISK_SETTINGS, ...JSON.parse(legacySettings) });
        else setSettings(DEFAULT_RISK_SETTINGS);
      } else {
        setSettings(DEFAULT_RISK_SETTINGS);
      }
    } catch {
      setSettings(DEFAULT_RISK_SETTINGS);
    }

    // Load user's isolated capital transactions
    try {
      const savedTxs = localStorage.getItem(CAPITAL_STORAGE_KEY);
      if (savedTxs && savedTxs !== 'undefined' && savedTxs !== 'null') {
        setCapitalTransactions(JSON.parse(savedTxs));
      } else {
        setCapitalTransactions([]);
      }
    } catch {
      setCapitalTransactions([]);
    }

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

  // Initial Supabase connection check & load data per currentUser
  useEffect(() => {
    let isMounted = true;

    const initSupabase = async () => {
      try {
        const health = await checkSupabaseConnection();
        if (!isMounted) return;
        setSupabaseHealth(health);

        if (health.status === 'connected' && currentUser?.email) {
          // 1. Carrega trades do Supabase para o usuário logado
          const cloudTrades = await fetchTradesFromSupabase(currentUser.email);
          if (!isMounted) return;

          if (cloudTrades.data && cloudTrades.data.length > 0) {
            setTrades(cloudTrades.data);
            localStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(cloudTrades.data));
          } else {
            // 2. Se a nuvem ainda não tem os trades do usuário, faz upload dos trades locais existentes para o Supabase
            const localSaved =
              localStorage.getItem(TRADES_STORAGE_KEY) ||
              (currentUser.email.toLowerCase() === 'oswamitrader@gmail.com'
                ? localStorage.getItem('trader_journal_trades_v2') || localStorage.getItem('trader_journal_trades_v1')
                : null);

            if (localSaved) {
              try {
                const parsed = JSON.parse(localSaved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const validLocal = parsed.filter((t) => !/^tr-0\d{2}$/.test(t.id) && t.id !== 'tr-024');
                  if (validLocal.length > 0) {
                    setTrades(validLocal);
                    localStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(validLocal));
                    syncAllTradesToSupabase(validLocal, currentUser.email);
                  }
                }
              } catch (e) {}
            }
          }

          const cloudSettings = await fetchRiskSettingsFromSupabase(currentUser.email);
          if (!isMounted) return;
          if (cloudSettings.data) {
            setSettings(cloudSettings.data);
          }

          // 3. Carrega movimentações de capital do Supabase
          const cloudCapital = await fetchCapitalTransactionsFromSupabase(currentUser.email);
          if (!isMounted) return;
          if (cloudCapital.data && cloudCapital.data.length > 0) {
            setCapitalTransactions(cloudCapital.data);
            localStorage.setItem(CAPITAL_STORAGE_KEY, JSON.stringify(cloudCapital.data));
          } else if (capitalTransactions.length > 0) {
            syncAllCapitalTransactionsToSupabase(capitalTransactions, currentUser.email);
          }
        }
      } catch (err) {
        console.warn('Erro ao inicializar Supabase:', err);
      }
    };

    if (currentUser) {
      initSupabase();
    }

    // Inscreve em tempo real nas alterações da tabela public.trades e system_users
    const tradesChannel = supabase
      .channel('realtime:public:trades')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trades' },
        async () => {
          if (currentUser?.email) {
            const res = await fetchTradesFromSupabase(currentUser.email);
            if (res.data) {
              setTrades(res.data);
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(tradesChannel);
    };
  }, [currentUser?.email]);

  // 4. Computed Analytics Engine
  const netCapitalTransactions = useMemo(() => {
    return capitalTransactions.reduce((acc, tx) => {
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
  
  // Anti-Fúria lock triggers if REAL account daily loss or total daily loss reaches limit
  const isStopHit =
    settings.dailyLossLimit > 0 &&
    (todayRealPnl <= -settings.dailyLossLimit + 0.001 || todayPnl <= -settings.dailyLossLimit + 0.001);

  // Overtrading lock triggers if daily trades count reaches maxTradesPerDay limit
  const isMaxTradesHit =
    settings.maxTradesPerDay > 0 && todayTradesCount >= settings.maxTradesPerDay;

  // Combined Anti-Fúria Lock State
  const isAntiFuriaActive = isStopHit || isMaxTradesHit;

  // Real-time synchronization bridge with the Anti-Fúria Chrome Extension
  useEffect(() => {
    try {
      window.postMessage(
        {
          type: 'ANTI_FURIA_SYNC',
          isStopHit: isAntiFuriaActive,
          todayPnl,
          dailyLossLimit: settings.dailyLossLimit,
          winRate: metrics.winRate,
          profitFactor: metrics.profitFactor,
          todayTradesCount,
          currentCapital: metrics.currentCapital,
          maxDrawdownPercent: metrics.maxDrawdownPercent,
        },
        '*'
      );
      localStorage.setItem(
        'trader_anti_furia_state_v1',
        JSON.stringify({
          isStopHit: isAntiFuriaActive,
          todayPnl,
          dailyLossLimit: settings.dailyLossLimit,
          winRate: metrics.winRate,
          profitFactor: metrics.profitFactor,
          todayTradesCount,
          currentCapital: metrics.currentCapital,
          updatedAt: Date.now(),
        })
      );
      // Sync with server endpoint
      fetch('/api/extension/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isStopHit: isAntiFuriaActive,
          todayPnl,
          dailyLossLimit: settings.dailyLossLimit,
          winRate: metrics.winRate,
          profitFactor: metrics.profitFactor,
          todayTradesCount,
          currentCapital: metrics.currentCapital,
        }),
      }).catch(() => {});
    } catch (e) {
      console.warn('Falha ao sincronizar ponte Anti-Fúria:', e);
    }
  }, [
    isAntiFuriaActive,
    todayPnl,
    settings.dailyLossLimit,
    metrics.winRate,
    todayTradesCount,
  ]);

  // Ouvinte de trades capturados automaticamente pela Extensão Chrome em tempo real
  useEffect(() => {
    const handleAutoCapturedMessage = (event: MessageEvent) => {
      if (
        event.data &&
        (event.data.type === 'AUTO_TRADE_CAPTURED' || event.data.type === 'TRADER_JOURNAL_AUTO_TRADE') &&
        event.data.trade
      ) {
        const capturedTrade: Trade = event.data.trade;
        // Ignora capturas de DOM imprecisas geradas por mutação visual da página da corretora
        if (
          capturedTrade.strategy?.includes('DOM') ||
          capturedTrade.notes?.includes('DOM') ||
          capturedTrade.id?.startsWith('dom-')
        ) {
          return;
        }

        setTrades((prev) => {
          const isDuplicate = prev.some(
            (t) =>
              t.id === capturedTrade.id ||
              (t.date === capturedTrade.date &&
                t.time === capturedTrade.time &&
                t.asset === capturedTrade.asset &&
                t.pnl === capturedTrade.pnl &&
                t.type === capturedTrade.type)
          );
          if (isDuplicate) return prev;
          return [capturedTrade, ...prev];
        });

        upsertTradeToSupabase(capturedTrade, currentUser?.email).catch(() => {});
      }
    };

    window.addEventListener('message', handleAutoCapturedMessage);
    return () => window.removeEventListener('message', handleAutoCapturedMessage);
  }, [currentUser?.email]);

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

    setTrades((prev) => {
      const existsIndex = prev.findIndex((t) => t.id === tradeData.id);
      if (existsIndex >= 0) {
        const updated = [...prev];
        updated[existsIndex] = tradeData;
        return updated;
      }
      return [tradeData, ...prev];
    });

    // Sync to Supabase in background with userEmail scope
    upsertTradeToSupabase(tradeData, currentUser?.email).then((res) => {
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

    setTrades((prev) => [...importedTrades, ...prev]);
    // Sync each imported trade to Supabase in background with userEmail scope
    importedTrades.forEach((trade) => {
      upsertTradeToSupabase(trade, currentUser?.email).catch((err) => {
        console.warn('Erro ao sincronizar trade importado:', err);
      });
    });
  };

  const handleDeleteTrade = (id: string) => {
    const targetTrade = trades.find((t) => t.id === id);
    if (targetTrade && isTradeProtected(targetTrade)) {
      alert(
        '🔒 Ação Bloqueada pelo Sistema Anti-Fúria!\n\nOperações de Conta Real capturadas pelas corretoras são imutáveis e não podem ser excluídas para impedir a burla da Trava Anti-Fúria e proteger sua gestão de risco.'
      );
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir esta operação do diário?')) {
      setTrades((prev) => prev.filter((t) => t.id !== id));
      deleteTradeFromSupabase(id).catch((err) => {
        console.warn('Erro ao remover do Supabase:', err);
      });
    }
  };

  const handleDeleteMultipleTrades = (ids: string[]) => {
    if (!ids || ids.length === 0) return;

    const targetTrades = trades.filter((t) => ids.includes(t.id));
    const protectedCount = targetTrades.filter((t) => isTradeProtected(t)).length;
    const deletableIds = targetTrades.filter((t) => !isTradeProtected(t)).map((t) => t.id);

    if (protectedCount > 0) {
      alert(
        `🔒 Proteção Anti-Fúria Ativada:\n\n${protectedCount} operação(ões) de Conta Real foram preservadas e NÃO puderam ser excluídas para manter a integridade da sua trava de risco.`
      );
    }

    if (deletableIds.length === 0) return;

    if (
      window.confirm(`Deseja realmente excluir as ${deletableIds.length} operações selecionadas?`)
    ) {
      const idSet = new Set(deletableIds);
      setTrades((prev) => prev.filter((t) => !idSet.has(t.id)));
      deletableIds.forEach((id) => {
        deleteTradeFromSupabase(id).catch((err) => {
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

    setSettings(newSettings);
    // Save to Supabase in background
    saveRiskSettingsToSupabase(newSettings, currentUser?.email).then((res) => {
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
          await clearAllTradesFromSupabase();
        } catch (e) {
          console.warn('Erro ao limpar Supabase:', e);
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

    if (todayPnl >= dailyTarget) {
      list.push({
        id: 'notif-target-hit',
        type: 'TARGET_REACHED',
        title: 'Meta Diária Batida! 🎉',
        message: `Parabéns! Você alcançou ${formatCurrency(todayPnl)}, superando sua meta de ${formatCurrency(dailyTarget)}. Considere proteger seus ganhos.`,
        timestamp: 'Hoje',
        date: todayPerformance?.date || '',
        severity: 'success',
      });
    } else if (todayPnl >= dailyTarget * 0.8) {
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

    if (todayPnl <= -dailyLoss) {
      list.push({
        id: 'notif-loss-limit',
        type: 'LOSS_LIMIT_REACHED',
        title: 'Stop Diário Atingido ⚠️',
        message: `Limite de perda diário de ${formatCurrency(dailyLoss)} atingido (${formatCurrency(todayPnl)}). Encerre o dia para proteger seu capital.`,
        timestamp: 'Hoje',
        date: todayPerformance?.date || '',
        severity: 'error',
      });
    } else if (todayPnl <= -dailyLoss * 0.8) {
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

    if (tradesCount >= maxTrades) {
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
    setCapitalTransactions((prev) => [tx, ...prev]);
    if (currentUser?.email) {
      upsertCapitalTransactionToSupabase(tx, currentUser.email).catch((err) => {
        console.warn('Erro ao salvar movimentação de capital no Supabase:', err);
      });
    }
  };

  const handleDeleteCapitalTransaction = (id: string) => {
    setCapitalTransactions((prev) => prev.filter((t) => t.id !== id));
    if (currentUser?.email) {
      deleteCapitalTransactionFromSupabase(id, currentUser.email).catch((err) => {
        console.warn('Erro ao remover movimentação de capital no Supabase:', err);
      });
    }
  };

  const handleDismissAlert = (alertKey: string) => {
    setDismissedAlerts((prev) => ({ ...prev, [alertKey]: true }));
  };

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={(user) => setCurrentUser(user)} />;
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
        currentCurrency={currency}
        currentUser={currentUser}
        onCurrencyChange={handleCurrencyChange}
        onOpenNewTrade={handleOpenNewTrade}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenAiMentor={() => setIsAiMentorOpen(true)}
        onOpenKellyCalculator={() => setIsKellyCalculatorOpen(true)}
        onOpenStakePlanner={() => setIsStakePlannerOpen(true)}
        onOpenSupabase={() => setIsSupabaseModalOpen(true)}
        onOpenAntiFuria={() => setIsAntiFuriaModalOpen(true)}
        onOpenPdfReport={() => setIsPdfReportOpen(true)}
        onOpenAdminManagement={() => setIsAdminModalOpen(true)}
        onLogout={handleLogout}
        onClearNotifications={handleClearNotifications}
        onResetData={handleResetData}
      />

      {/* Invisible DOM Bridge for Chrome Extension Content Scripts */}
      <div
        id="anti-furia-status-bridge"
        data-stophit={isStopHit ? 'true' : 'false'}
        data-today-pnl={todayPnl}
        data-loss-limit={settings.dailyLossLimit}
        data-winrate={metrics.winRate}
        data-profit-factor={metrics.profitFactor}
        data-trades-count={todayPerformance?.tradesCount || 0}
        data-capital={metrics.currentCapital}
        style={{ display: 'none' }}
      />

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-28 lg:pb-12 space-y-5 sm:space-y-6">
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
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenAntiFuria={() => setIsAntiFuriaModalOpen(true)}
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
          onOpenCapitalModal={() => setIsCapitalModalOpen(true)}
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
      />

      <AiTraderMentorModal
        isOpen={isAiMentorOpen}
        onClose={() => setIsAiMentorOpen(false)}
        metrics={metrics}
        settings={settings}
        trades={trades}
      />

      <CapitalHistoryModal
        isOpen={isCapitalModalOpen}
        onClose={() => setIsCapitalModalOpen(false)}
        transactions={capitalTransactions}
        onAddTransaction={(tx) => setCapitalTransactions((prev) => [tx, ...prev])}
        onDeleteTransaction={(id) => setCapitalTransactions((prev) => prev.filter((t) => t.id !== id))}
        currentCapital={metrics.currentCapital}
        initialCapital={settings.initialCapital}
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

      <AntiFuriaExtensionModal
        isOpen={isAntiFuriaModalOpen}
        onClose={() => setIsAntiFuriaModalOpen(false)}
        isStopHit={isStopHit}
        todayPnl={todayPnl}
        dailyLossLimit={settings.dailyLossLimit}
        winRate={metrics.winRate}
        profitFactor={metrics.profitFactor}
        todayTradesCount={todayPerformance?.tradesCount || 0}
        currentCapital={metrics.currentCapital}
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

      <AdminUserManagementModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
}

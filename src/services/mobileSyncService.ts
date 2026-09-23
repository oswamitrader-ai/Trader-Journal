import { supabase } from '../lib/supabase';
import { getLocalDateStr } from '../utils/calculations';

export interface MobileLockState {
  isStopHit: boolean;
  isMaxTradesHit: boolean;
  isUserActive: boolean;
  subscriptionStatus: 'ACTIVE' | 'OVERDUE' | 'INACTIVE';
  userRole: 'ADMIN' | 'CLIENT';
  userEmail: string;
  isLockActive: boolean;
  reason: string | null;
  todayPnl: number;
  totalTodayPnl: number; // Inclui DEMO + Real
  dailyLossLimit: number;
  dailyProfitTarget: number;
  maxTradesPerDay: number;
  todayTradesCount: number;
  todayRealTradesCount: number;
  gainCount: number;
  lossCount: number;
  winRate: number;
  profitFactor: number;
  isRealtimeConnected: boolean;
}

export type NativeLockCallback = (state: MobileLockState) => void;

class MobileSyncService {
  private currentState: MobileLockState = {
    isStopHit: false,
    isMaxTradesHit: false,
    isUserActive: true,
    subscriptionStatus: 'ACTIVE',
    userRole: 'CLIENT',
    userEmail: 'oswamitrader@gmail.com',
    isLockActive: false,
    reason: null,
    todayPnl: 0,
    totalTodayPnl: 0,
    dailyLossLimit: 60,
    dailyProfitTarget: 70,
    maxTradesPerDay: 4,
    todayTradesCount: 0,
    todayRealTradesCount: 0,
    gainCount: 0,
    lossCount: 0,
    winRate: 0,
    profitFactor: 0,
    isRealtimeConnected: false,
  };

  private listeners: Set<NativeLockCallback> = new Set();
  private tradesChannel: any = null;
  private usersChannel: any = null;

  constructor() {
    const savedEmail = typeof window !== 'undefined' ? localStorage.getItem('tradelock_user_email') || 'oswamitrader@gmail.com' : 'oswamitrader@gmail.com';
    this.setUserEmail(savedEmail);
  }

  public subscribe(callback: NativeLockCallback): () => void {
    this.listeners.add(callback);
    callback(this.currentState);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public getState(): MobileLockState {
    return { ...this.currentState };
  }

  public setUserEmail(email: string): void {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    this.currentState.userEmail = cleanEmail;
    if (typeof window !== 'undefined') {
      localStorage.setItem('tradelock_user_email', cleanEmail);
    }
    this.fetchDataAndSubscribe(cleanEmail);
  }

  public updateState(partial: Partial<MobileLockState>): void {
    const updated = { ...this.currentState, ...partial };

    const isSubscriptionBlocked = !updated.isUserActive || updated.subscriptionStatus !== 'ACTIVE';
    const isAntiFuriaActive = updated.isStopHit || updated.isMaxTradesHit;
    
    updated.isLockActive = isSubscriptionBlocked || isAntiFuriaActive;
    
    if (isSubscriptionBlocked) {
      updated.reason = 'Plano de Assinatura Inativo ou Suspenso';
    } else if (updated.isStopHit) {
      updated.reason = 'Stop Loss Diário Atingido (Trava Anti-Fúria)';
    } else if (updated.isMaxTradesHit) {
      updated.reason = 'Limite Máximo de Operações Diárias Atingido';
    } else {
      updated.reason = null;
    }

    this.currentState = updated;
    this.notifyNativeBridge(updated);
    this.listeners.forEach((fn) => fn(updated));
  }

  public async fetchDataAndSubscribe(email: string): Promise<void> {
    if (!email) return;

    try {
      // 1. Fetch user subscription status
      const { data: userData } = await supabase
        .from('system_users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (userData) {
        this.updateState({
          isUserActive: userData.active !== false,
          subscriptionStatus: userData.subscription_status || 'ACTIVE',
          userRole: userData.role === 'ADMIN' ? 'ADMIN' : 'CLIENT',
        });
      }

      // 2. Fetch risk settings by ID ('settings_' + email) with fallback to default_settings
      const settingsId = `settings_${email}`;
      let { data: settingsData } = await supabase
        .from('risk_settings')
        .select('*')
        .eq('id', settingsId)
        .maybeSingle();

      if (!settingsData) {
        const { data: defData } = await supabase
          .from('risk_settings')
          .select('*')
          .eq('id', 'default_settings')
          .maybeSingle();
        settingsData = defData;
      }

      const dailyLossLimit = settingsData?.dailyLossLimit ?? settingsData?.daily_loss_limit ?? 60;
      const dailyProfitTarget = settingsData?.dailyProfitTarget ?? settingsData?.daily_profit_target ?? 70;
      const maxTradesPerDay = settingsData?.maxTradesPerDay ?? settingsData?.max_trades_per_day ?? 4;

      // 3. Fetch today's trades
      const todayStr = getLocalDateStr();
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_email', email)
        .eq('date', todayStr);

      if (tradesError) {
        console.warn('[MobileSyncService] Erro ao buscar trades:', tradesError.message);
      }

      let allTrades: any[] = trades || [];
      if (allTrades.length === 0 && typeof window !== 'undefined') {
        const userKey = email.toLowerCase().trim();
        const localSaved = localStorage.getItem(`trader_journal_trades_${userKey}`) || localStorage.getItem('trader_journal_trades_v2') || localStorage.getItem('trader_journal_trades_v1');
        if (localSaved) {
          try {
            const parsed = JSON.parse(localSaved);
            if (Array.isArray(parsed)) {
              allTrades = parsed.filter((t: any) => t.date === todayStr);
            }
          } catch (e) {}
        }
      }

      const todayRealTrades = allTrades.filter(t => t.accountType !== 'DEMO' && t.isReal !== false && t.account_type !== 'DEMO');
      const todayPnl = todayRealTrades.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0);
      const totalTodayPnl = allTrades.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0);
      const effectivePnl = todayRealTrades.length > 0 ? todayPnl : totalTodayPnl;
      const todayTradesCount = allTrades.length;
      const todayRealTradesCount = todayRealTrades.length;
      
      const gainCount = todayRealTrades.filter(t => t.result === 'GAIN' || Number(t.pnl) > 0).length;
      const lossCount = todayRealTrades.filter(t => t.result === 'LOSS' || Number(t.pnl) < 0).length;
      const winRate = todayRealTrades.length > 0 ? Math.round((gainCount / todayRealTrades.length) * 100) : 0;

      // Profit Factor = soma dos ganhos / |soma das perdas|
      const totalGains = todayRealTrades.filter(t => Number(t.pnl) > 0).reduce((s, t) => s + Number(t.pnl), 0);
      const totalLosses = Math.abs(todayRealTrades.filter(t => Number(t.pnl) < 0).reduce((s, t) => s + Number(t.pnl), 0));
      const profitFactor = totalLosses > 0 ? parseFloat((totalGains / totalLosses).toFixed(2)) : (totalGains > 0 ? 999 : 0);

      const isStopHit = dailyLossLimit > 0 && (todayPnl <= -dailyLossLimit || effectivePnl <= -dailyLossLimit) && (todayPnl < 0 || effectivePnl < 0);
      const isMaxTradesHit = maxTradesPerDay > 0 && todayTradesCount >= maxTradesPerDay;

      console.log(`[MobileSyncService] Dados carregados: PnL Real=${todayPnl}, Total=${totalTodayPnl}, Trades=${todayTradesCount}, StopLoss=${dailyLossLimit}`);

      this.updateState({
        todayPnl: effectivePnl,
        totalTodayPnl,
        dailyLossLimit,
        dailyProfitTarget,
        maxTradesPerDay,
        todayTradesCount,
        todayRealTradesCount,
        gainCount,
        lossCount,
        winRate,
        profitFactor,
        isStopHit,
        isMaxTradesHit,
        isRealtimeConnected: true,
      });

      // 4. Setup Supabase Realtime Channels
      this.subscribeRealtime(email);
    } catch (err) {
      console.warn('Erro ao carregar dados do Supabase no mobileSyncService:', err);
    }
  }

  private subscribeRealtime(email: string): void {
    if (this.tradesChannel) supabase.removeChannel(this.tradesChannel);
    if (this.usersChannel) supabase.removeChannel(this.usersChannel);

    this.tradesChannel = supabase
      .channel(`mobile_trades_${email}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trades', filter: `user_email=eq.${email}` },
        () => {
          this.fetchDataAndSubscribe(email);
        }
      )
      .subscribe();

    this.usersChannel = supabase
      .channel(`mobile_users_${email}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_users', filter: `email=eq.${email}` },
        (payload: any) => {
          if (payload.new) {
            this.updateState({
              isUserActive: payload.new.active !== false,
              subscriptionStatus: payload.new.subscription_status || 'ACTIVE',
              userRole: payload.new.role === 'ADMIN' ? 'ADMIN' : 'CLIENT',
            });
          }
        }
      )
      .subscribe();
  }

  private notifyNativeBridge(state: MobileLockState): void {
    if (typeof window === 'undefined') return;

    const androidBridge = (window as any).TradeLockAndroidBridge;
    if (androidBridge && typeof androidBridge.onLockStateChanged === 'function') {
      try {
        androidBridge.onLockStateChanged(JSON.stringify(state));
      } catch (err) {
        console.warn('Erro ao comunicar com a Ponte Nativa Android:', err);
      }
    }

    const iosBridge = (window as any).webkit?.messageHandlers?.TradeLockiOSBridge;
    if (iosBridge && typeof iosBridge.postMessage === 'function') {
      try {
        iosBridge.postMessage(state);
      } catch (err) {
        console.warn('Erro ao comunicar com a Ponte Nativa iOS:', err);
      }
    }
  }
}

export const mobileSyncService = new MobileSyncService();

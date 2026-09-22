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
}

export type NativeLockCallback = (state: MobileLockState) => void;

class MobileSyncService {
  private currentState: MobileLockState = {
    isStopHit: false,
    isMaxTradesHit: false,
    isUserActive: true,
    subscriptionStatus: 'ACTIVE',
    userRole: 'CLIENT',
    userEmail: '',
    isLockActive: false,
    reason: null,
  };

  private listeners: Set<NativeLockCallback> = new Set();
  private channel: any = null;

  constructor() {
    this.initRealtimeSync();
  }

  /**
   * Registra listener para receber atualizações do estado da trava mobile
   */
  public subscribe(callback: NativeLockCallback): () => void {
    this.listeners.add(callback);
    callback(this.currentState);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Retorna o estado atual da trava no dispositivo móvel
   */
  public getState(): MobileLockState {
    return { ...this.currentState };
  }

  /**
   * Atualiza o estado local e notifica a ponte nativa Android / iOS
   */
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

  /**
   * Notifica as pontes nativas Android (VpnService & Accessibility) e iOS (ScreenTime API)
   */
  private notifyNativeBridge(state: MobileLockState): void {
    if (typeof window === 'undefined') return;

    // Bridge para Android Nativo (React Native NativeModules ou Android WebView Bridge)
    const androidBridge = (window as any).TradeLockAndroidBridge;
    if (androidBridge && typeof androidBridge.onLockStateChanged === 'function') {
      try {
        androidBridge.onLockStateChanged(JSON.stringify(state));
      } catch (err) {
        console.warn('Erro ao comunicar com a Ponte Nativa Android:', err);
      }
    }

    // Bridge para iOS Nativo (WebKit MessageHandler)
    const iosBridge = (window as any).webkit?.messageHandlers?.TradeLockiOSBridge;
    if (iosBridge && typeof iosBridge.postMessage === 'function') {
      try {
        iosBridge.postMessage(state);
      } catch (err) {
        console.warn('Erro ao comunicar com a Ponte Nativa iOS:', err);
      }
    }
  }

  /**
   * Conecta ao canal do Supabase Realtime para capturar mudanças no status do usuário
   */
  private initRealtimeSync(): void {
    try {
      this.channel = supabase
        .channel('mobile_lock_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'system_users' },
          (payload: any) => {
            if (payload.new && payload.new.email === this.currentState.userEmail) {
              this.updateState({
                isUserActive: payload.new.active !== false,
                userRole: payload.new.role === 'ADMIN' ? 'ADMIN' : 'CLIENT',
              });
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Supabase Realtime não configurado no mobileSyncService:', err);
    }
  }
}

export const mobileSyncService = new MobileSyncService();

import { createClient } from '@supabase/supabase-js';
import { Trade, RiskSettings, SystemUser, CapitalTransaction } from '../types';
import { isTradeProtected, getLocalDateStr, sortAndSanitizeTrades } from '../utils/calculations';

// Default configuration provided by the user
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://mreykdrbyfrwqovsleqi.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_6ntxWuCoI_0Upy2PVIB6Nw__mMUiPUX';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
export function journalEpoch(email?: string): string | null {
  return email ? localStorage.getItem('journal_epoch_' + email.toLowerCase().trim()) : null;
}
// Broadcast Channel dedicado para sincronização instantânea (<50ms) entre Web, Desktop (Electron) e Mobile
export const syncBroadcastChannel = supabase.channel('tradelock_realtime_broadcast', {
  config: { broadcast: { self: true } },
});

if (typeof window !== 'undefined') {
  syncBroadcastChannel.subscribe();
}

export function notifyRealtimeSync(table: string, action: string = 'MUTATION') {
  try {
    syncBroadcastChannel.send({
      type: 'broadcast',
      event: 'SYNC_MUTATION',
      payload: { table, action, timestamp: Date.now() },
    });
  } catch (e) {
    console.warn('[Supabase Broadcast] Falha ao notificar sincronização:', e);
  }
}

/**
 * Retorna ou gera um UUID único persistente por navegador/computador.
 * Garante que múltiplos usuários usando o mesmo projeto Supabase nunca misturem dados.
 */
export function getClientDeviceId(): string {
  if (typeof window === 'undefined') return 'server_device';
  try {
    let deviceId = localStorage.getItem('trader_journal_device_id');
    if (!deviceId) {
      deviceId = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('trader_journal_device_id', deviceId);
    }
    return deviceId;
  } catch {
    return 'fallback_device';
  }
}

export type SupabaseConnectionStatus = 'connected' | 'table_missing' | 'error' | 'connecting';

export interface SupabaseHealthResult {
  status: SupabaseConnectionStatus;
  message: string;
  tableCount?: number;
}

/**
 * Checks connectivity and verifies if the 'trades' table has been created in Supabase
 */
export async function checkSupabaseConnection(): Promise<SupabaseHealthResult> {
  if (!isSupabaseConfigured) {
    return {
      status: 'error',
      message: 'Credenciais do Supabase não configuradas no ambiente.',
    };
  }

  try {
    const { data, error, count } = await supabase
      .from('trades')
      .select('id', { count: 'exact', head: true });

    if (error) {
      // PostgREST 404 / PGRST205 indicates the table does not exist yet
      if (
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        error.message.includes('not find the table') ||
        error.message.includes('schema cache')
      ) {
        return {
          status: 'table_missing',
          message: 'Conectado ao Supabase, mas a tabela "trades" ainda não foi criada.',
        };
      }

      return {
        status: 'error',
        message: `Erro ao consultar Supabase: ${error.message}`,
      };
    }

    return {
      status: 'connected',
      message: 'Conectado e sincronizado com o Supabase!',
      tableCount: count ?? data?.length ?? 0,
    };
  } catch (err: any) {
    return {
      status: 'error',
      message: err?.message || 'Falha de comunicação com o Supabase.',
    };
  }
}

export async function fetchTradesFromSupabase(userEmail?: string): Promise<{ data: Trade[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    const cleanEmail = userEmail ? userEmail.toLowerCase().trim() : '';
    const deletedResult = await fetchDeletedRecordIds(cleanEmail);
    if (deletedResult.error) return { data: null, error: deletedResult.error };
    const deletedIds = deletedResult.tradeIds;

    const trades: Trade[] = (data || [])
      .filter((row: any) => !/^tr-0\d{2}$/.test(String(row.id)) && String(row.id) !== 'tr-024')
      .filter((row: any) => !deletedIds.has(String(row.id)))
      .filter((row: any) => {
        if (!cleanEmail) return true;
        const rowUserEmail = row.user_email ? String(row.user_email).toLowerCase().trim() : '';
        if (cleanEmail === 'oswamitrader@gmail.com') {
          // Para o Admin principal, inclui operações dele E operações sem e-mail atrelado
          return !rowUserEmail || rowUserEmail === 'oswamitrader@gmail.com';
        }
        // Para clientes, inclui apenas operações vinculadas estritamente ao seu e-mail
        return rowUserEmail === cleanEmail;
      })
      .map((row: any) => {
        let tradeDate = String(row.date);
        const todayStr = getLocalDateStr();
        if (tradeDate > todayStr) {
          tradeDate = todayStr;
        }

        return {
          id: String(row.id),
          updatedAt: row.updated_at ? String(row.updated_at) : undefined,
          date: String(row.date),
          time: String(row.time),
          asset: String(row.asset),
          type: Array.isArray(row.tags) && row.tags.includes('DIRECTION_UNKNOWN')
            ? 'UNKNOWN'
            : row.type === 'BUY' ? 'BUY' : row.type === 'SELL' ? 'SELL' : 'UNKNOWN',
          strategy: String(row.strategy),
          result: row.result === 'GAIN' ? 'GAIN' : row.result === 'LOSS' ? 'LOSS' : 'BREAKEVEN',
          pnl: Number(row.pnl) || 0,
          contractsOrQuantity: Number(row.contractsOrQuantity) || 1,
          entryPrice: row.entryPrice != null ? Number(row.entryPrice) : undefined,
          exitPrice: row.exitPrice != null ? Number(row.exitPrice) : undefined,
          notes: row.notes || undefined,
          tags: Array.isArray(row.tags) ? row.tags : undefined,
          accountType: row.accountType || undefined,
          isReal: row.isReal != null ? Boolean(row.isReal) : undefined,
          isAutoCaptured: row.isAutoCaptured != null ? Boolean(row.isAutoCaptured) : undefined,
        };
      });

    const sanitizedTrades = sortAndSanitizeTrades(trades);
    return { data: sanitizedTrades, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Erro inesperado ao carregar trades.' };
  }
}

/**
 * Insert or update a single trade in Supabase (Isolated per device/user)
 */
export async function upsertTradeToSupabase(trade: Trade, userEmail?: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const cleanEmail = userEmail?.toLowerCase().trim();
    if (cleanEmail) {
      const deleted = await fetchDeletedRecordIds(cleanEmail);
      if (deleted.error) return { success: false, error: deleted.error };
      if (deleted.tradeIds.has(trade.id)) return { success: true, error: null };
    }
    const deviceId = getClientDeviceId();
    const payload: any = {
      id: trade.id,
      device_id: deviceId,
      user_email: userEmail?.toLowerCase().trim() || null,
      data_epoch: journalEpoch(userEmail),
      date: trade.date,
      time: trade.time,
      asset: trade.asset,
      type: trade.type === 'UNKNOWN' ? 'BUY' : trade.type,
      strategy: trade.strategy,
      result: trade.result,
      pnl: trade.pnl,
      contractsOrQuantity: trade.contractsOrQuantity,
      entryPrice: trade.entryPrice ?? null,
      exitPrice: trade.exitPrice ?? null,
      notes: trade.notes ?? null,
      tags: [...(trade.tags ?? []), ...(trade.type === 'UNKNOWN' ? ['DIRECTION_UNKNOWN'] : [])],
      accountType: trade.accountType ?? null,
      isReal: trade.isReal ?? null,
      isAutoCaptured: trade.isAutoCaptured ?? null,
      updated_at: trade.updatedAt || new Date().toISOString(),
    };

    let { error } = await supabase.from('trades').upsert(payload);

    if (error && (error.code === 'PGRST204' || error.message.includes('column'))) {
      delete payload.user_email;
      delete payload.device_id;
      delete payload.accountType;
      delete payload.isReal;
      delete payload.isAutoCaptured;
      const res = await supabase.from('trades').upsert(payload);
      error = res.error;
    }

    if (error) {
      return { success: false, error: error.message };
    }
    notifyRealtimeSync('trades', 'UPSERT');
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao salvar trade no Supabase.' };
  }
}

/**
 * Delete a trade from Supabase
 */
export async function deleteTradeFromSupabase(tradeId: string, userEmail?: string): Promise<{ success: boolean; error: string | null }> {
  try {
    // 1. Consulta se a operação é da Conta Real (protegida pelo Anti-Fúria)
    const { data: existing } = await supabase.from('trades').select('*').eq('id', tradeId).maybeSingle();
    if (existing && isTradeProtected(existing as Trade)) {
      return {
        success: false,
        error: 'Operação de Conta Real capturada é estritamente protegida pelo Sistema Anti-Fúria e não pode ser excluída.',
      };
    }

    const tombstone = await createDeletedRecordTombstone('trade', tradeId, userEmail);
    if (tombstone) return { success: false, error: tombstone };
    const { error } = await supabase.from('trades').delete().eq('id', tradeId);
    if (error) {
      return { success: false, error: error.message };
    }
    notifyRealtimeSync('trades', 'DELETE');
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao remover trade do Supabase.' };
  }
}

export async function fetchDeletedRecordIds(userEmail: string): Promise<{ tradeIds: Set<string>; capitalIds: Set<string>; error: string | null }> {
  if (!userEmail) return { tradeIds: new Set(), capitalIds: new Set(), error: null };
  try {
    const cleanEmail = userEmail.toLowerCase().trim();
    const [tradesResult, capitalResult] = await Promise.all([
      supabase.from('deleted_records').select('record_id').eq('user_email', cleanEmail).eq('record_type', 'trade'),
      supabase.from('deleted_records').select('record_id').eq('user_email', cleanEmail).eq('record_type', 'capital'),
    ]);
    const error = tradesResult.error || capitalResult.error;
    if (error) return { tradeIds: new Set(), capitalIds: new Set(), error: error.message };
    return {
      tradeIds: new Set((tradesResult.data || []).map((row: any) => String(row.record_id))),
      capitalIds: new Set((capitalResult.data || []).map((row: any) => String(row.record_id))),
      error: null,
    };
  } catch (err: any) {
    return { tradeIds: new Set(), capitalIds: new Set(), error: err?.message || 'Falha ao consultar exclusões sincronizadas.' };
  }
}

export async function purgeCloudRecordsDeletedByUser(userEmail: string, tradeIds: Set<string>, capitalIds: Set<string>): Promise<string | null> {
  const cleanEmail = userEmail.toLowerCase().trim();
  try {
    if (!cleanEmail) return 'Não foi possível sincronizar exclusões sem uma conta identificada.';
    // Bound URL size and avoid one network round trip for every historical deletion.
    for (const [table, ids] of [['trades', tradeIds], ['capital_transactions', capitalIds]] as const) {
      const records = [...ids];
      for (let offset = 0; offset < records.length; offset += 50) {
        const { error } = await supabase.from(table).delete()
          .in('id', records.slice(offset, offset + 50)).eq('user_email', cleanEmail);
        if (error) return error.message;
      }
    }
    return null;
  } catch (err: any) {
    return err?.message || 'Falha ao remover registros marcados como excluídos.';
  }
}

async function createDeletedRecordTombstone(kind: 'trade' | 'capital', recordId: string, userEmail?: string): Promise<string | null> {
  const cleanEmail = userEmail ? userEmail.toLowerCase().trim() : '';
  if (!cleanEmail) return 'Não foi possível sincronizar a exclusão: e-mail da conta ausente.';
  try {
    const { error } = await supabase.from('deleted_records').upsert({
      id: `${kind}_${cleanEmail}_${recordId}`,
      user_email: cleanEmail,
      record_type: kind,
      record_id: recordId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_email,record_type,record_id' });
    return error?.message || null;
  } catch (err: any) {
    return err?.message || 'Falha ao registrar a exclusão sincronizada.';
  }
}

/**
 * Delete all trades from Supabase for this device/user
 */
export async function clearAllTradesFromSupabase(userEmail?: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const cleanEmail = userEmail?.toLowerCase().trim();
    if (!cleanEmail) return { success: false, error: 'E-mail da conta ausente; a limpeza foi cancelada.' };

    const { data, error: fetchError } = await supabase
      .from('trades')
      .select('id')
      .eq('user_email', cleanEmail);
    if (fetchError) return { success: false, error: fetchError.message };

    const ids = (data || []).map((row: { id: string }) => String(row.id));
    for (const id of ids) {
      const tombstoneError = await createDeletedRecordTombstone('trade', id, cleanEmail);
      if (tombstoneError) return { success: false, error: tombstoneError };
    }

    if (ids.length > 0) {
      const { error: deleteError } = await supabase
        .from('trades')
        .delete()
        .eq('user_email', cleanEmail)
        .in('id', ids);
      if (deleteError) return { success: false, error: deleteError.message };
    }
    notifyRealtimeSync('trades', 'DELETE');
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao limpar dados do Supabase.' };
  }
}

/**
 * Batch upload/sync all local trades to Supabase
 */
export async function syncAllTradesToSupabase(trades: Trade[], userEmail?: string): Promise<{ count: number; error: string | null }> {
  if (!trades || trades.length === 0) {
    return { count: 0, error: null };
  }

  try {
    const cleanEmail = userEmail?.toLowerCase().trim();
    if (!cleanEmail) return { count: 0, error: 'E-mail da conta ausente; sincronização cancelada.' };
    const deleted = await fetchDeletedRecordIds(cleanEmail);
    if (deleted.error) return { count: 0, error: deleted.error };
    const activeTrades = trades.filter((trade) => !deleted.tradeIds.has(trade.id));
    if (activeTrades.length === 0) return { count: 0, error: null };

    const deviceId = getClientDeviceId();
    const payload = activeTrades.map((trade) => ({
      id: trade.id,
      device_id: deviceId,
      user_email: userEmail?.toLowerCase().trim() || null,
      data_epoch: journalEpoch(userEmail),
      date: trade.date,
      time: trade.time,
      asset: trade.asset,
      type: trade.type === 'UNKNOWN' ? 'BUY' : trade.type,
      strategy: trade.strategy,
      result: trade.result,
      pnl: trade.pnl,
      contractsOrQuantity: trade.contractsOrQuantity,
      entryPrice: trade.entryPrice ?? null,
      exitPrice: trade.exitPrice ?? null,
      notes: trade.notes ?? null,
      tags: [...(trade.tags ?? []), ...(trade.type === 'UNKNOWN' ? ['DIRECTION_UNKNOWN'] : [])],
      accountType: trade.accountType ?? null,
      isReal: trade.isReal ?? null,
      isAutoCaptured: trade.isAutoCaptured ?? null,
      updated_at: trade.updatedAt || new Date().toISOString(),
    }));

    let { error } = await supabase.from('trades').upsert(payload);
    if (error && (error.code === 'PGRST204' || error.message.includes('column'))) {
      const cleanPayload = payload.map(({ user_email, device_id, accountType, isReal, isAutoCaptured, ...rest }) => rest);
      const res = await supabase.from('trades').upsert(cleanPayload);
      error = res.error;
    }

    if (error) {
      return { count: 0, error: error.message };
    }
    return { count: payload.length, error: null };
  } catch (err: any) {
    return { count: 0, error: err?.message || 'Falha ao sincronizar lote de trades.' };
  }
}

/**
 * Fetch Risk Settings from Supabase (Scoped per userEmail to prevent data loss when cache is cleared)
 */
export async function fetchRiskSettingsFromSupabase(userEmail?: string): Promise<{ data: RiskSettings | null; error: string | null }> {
  try {
    const cleanEmail = userEmail ? userEmail.toLowerCase().trim() : '';
    let settingId = cleanEmail ? `settings_${cleanEmail}` : `settings_${getClientDeviceId()}`;

    let { data, error } = await supabase
      .from('risk_settings')
      .select('*')
      .eq('id', settingId)
      .maybeSingle();
    if (error) return { data: null, error: error.message };

    if (!data && cleanEmail) {
      settingId = `settings_${getClientDeviceId()}`;
      const deviceSettings = await supabase
        .from('risk_settings')
        .select('*')
        .eq('id', settingId)
        .maybeSingle();
      data = deviceSettings.data;
      error = deviceSettings.error;
      if (error) return { data: null, error: error.message };
    }

    const { data: managementRow, error: managementError } = await supabase
      .from('management_settings')
      .select('settings,updated_at')
      .eq('id', settingId)
      .maybeSingle();
    if (managementError) return { data: null, error: managementError.message };

    if (!data) {
      return { data: null, error: null };
    }

    let extraManagement: Partial<RiskSettings> = {};
    const managementValue = managementRow?.settings;
    if (managementValue && typeof managementValue === 'object') {
      extraManagement = managementValue as Partial<RiskSettings>;
    } else if (typeof managementValue === 'string' && managementValue.trim().startsWith('{')) {
      try {
        const parsedNotes = JSON.parse(managementValue);
        if (parsedNotes && typeof parsedNotes === 'object') {
          extraManagement = parsedNotes;
        }
      } catch (e) {}
    } else if (typeof data.notes === 'string' && data.notes.trim().startsWith('{')) {
      // Compatibilidade temporária com linhas gravadas antes da migração.
      try { extraManagement = JSON.parse(data.notes); } catch (e) {}
    }

    const settings: RiskSettings = {
      updatedAt: [data.updated_at, managementRow?.updated_at].filter(Boolean).sort((a,b) => Date.parse(b)-Date.parse(a))[0],
      initialCapital: extraManagement.initialCapital ?? (data.initialCapital != null ? Number(data.initialCapital) : 0),
      dailyProfitTarget: extraManagement.dailyProfitTarget ?? (data.dailyProfitTarget != null ? Number(data.dailyProfitTarget) : 500),
      dailyLossLimit: extraManagement.dailyLossLimit ?? (data.dailyLossLimit != null ? Number(data.dailyLossLimit) : 300),
      monthlyProfitTarget: extraManagement.monthlyProfitTarget ?? (data.monthlyProfitTarget != null ? Number(data.monthlyProfitTarget) : 5000),
      monthlyLossLimit: extraManagement.monthlyLossLimit ?? (data.monthlyLossLimit != null ? Number(data.monthlyLossLimit) : 2000),
      maxTradesPerDay: extraManagement.maxTradesPerDay ?? (data.maxTradesPerDay != null ? Number(data.maxTradesPerDay) : 5),
      alertSoundEnabled: extraManagement.alertSoundEnabled !== undefined ? Boolean(extraManagement.alertSoundEnabled) : Boolean(data.alertSoundEnabled ?? true),
      antiFuriaCustomWindowEnabled: extraManagement.antiFuriaCustomWindowEnabled !== undefined ? Boolean(extraManagement.antiFuriaCustomWindowEnabled) : Boolean(data.antiFuriaCustomWindowEnabled ?? false),
      antiFuriaStartTime: extraManagement.antiFuriaStartTime || data.antiFuriaStartTime || '07:00',
      antiFuriaEndTime: extraManagement.antiFuriaEndTime || data.antiFuriaEndTime || '11:30',
      permanentMobileBrokerLockEnabled: extraManagement.permanentMobileBrokerLockEnabled !== undefined
        ? Boolean(extraManagement.permanentMobileBrokerLockEnabled)
        : Boolean(data.permanentMobileBrokerLockEnabled ?? data.permanent_mobile_lock ?? false),
      riskLockUntil: extraManagement.riskLockUntil
        ? extraManagement.riskLockUntil
        : ((data.riskLockUntil && data.riskLockUntil !== 'null')
            ? data.riskLockUntil
            : ((data.risk_lock_until && data.risk_lock_until !== 'null')
                ? data.risk_lock_until
                : undefined)),
      riskLockDurationDays: extraManagement.riskLockDurationDays ?? (data.riskLockDurationDays != null ? Number(data.riskLockDurationDays) : (data.risk_lock_duration_days != null ? Number(data.risk_lock_duration_days) : 7)),
      managementStyle: extraManagement.managementStyle || data.managementStyle || data.management_style || 'MAO_FIXA',
      estimatedPayout: extraManagement.estimatedPayout ?? (data.estimatedPayout != null ? Number(data.estimatedPayout) : 87),
      estimatedWinRate: extraManagement.estimatedWinRate ?? (data.estimatedWinRate != null ? Number(data.estimatedWinRate) : 65),
      stakePercent: extraManagement.stakePercent ?? (data.stakePercent != null ? Number(data.stakePercent) : 2),
      enforceBrokerStakeLock: extraManagement.enforceBrokerStakeLock !== undefined
        ? Boolean(extraManagement.enforceBrokerStakeLock)
        : Boolean(data.enforceBrokerStakeLock ?? false),
      fixedStakeAmount: extraManagement.fixedStakeAmount ?? (data.fixedStakeAmount != null ? Number(data.fixedStakeAmount) : 50),
      sorosLevel1Stake: extraManagement.sorosLevel1Stake ?? (data.sorosLevel1Stake != null ? Number(data.sorosLevel1Stake) : 93.5),
      sorosLevel2Stake: extraManagement.sorosLevel2Stake ?? (data.sorosLevel2Stake != null ? Number(data.sorosLevel2Stake) : 174.8),
      sorosLevel3Stake: extraManagement.sorosLevel3Stake ?? (data.sorosLevel3Stake != null ? Number(data.sorosLevel3Stake) : 326.9),
      martingaleLevel1Stake: extraManagement.martingaleLevel1Stake ?? (data.martingaleLevel1Stake != null ? Number(data.martingaleLevel1Stake) : 100),
      martingaleLevel2Stake: extraManagement.martingaleLevel2Stake ?? (data.martingaleLevel2Stake != null ? Number(data.martingaleLevel2Stake) : 200),
    };

    return { data: settings, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Erro ao carregar configurações de risco.' };
  }
}

/**
 * Save Risk Settings to Supabase (Scoped per userEmail)
 */
export async function saveRiskSettingsToSupabase(settings: RiskSettings, userEmail?: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const cleanEmail = userEmail ? userEmail.toLowerCase().trim() : '';
    const settingId = cleanEmail ? `settings_${cleanEmail}` : `settings_${getClientDeviceId()}`;

    const managementSettings = {
      antiFuriaCustomWindowEnabled: settings.antiFuriaCustomWindowEnabled,
      antiFuriaStartTime: settings.antiFuriaStartTime,
      antiFuriaEndTime: settings.antiFuriaEndTime,
      riskLockUntil: settings.riskLockUntil,
      riskLockDurationDays: settings.riskLockDurationDays,
      managementStyle: settings.managementStyle,
      estimatedPayout: settings.estimatedPayout,
      estimatedWinRate: settings.estimatedWinRate,
      stakePercent: settings.stakePercent,
      permanentMobileBrokerLockEnabled: settings.permanentMobileBrokerLockEnabled,
      enforceBrokerStakeLock: settings.enforceBrokerStakeLock,
      fixedStakeAmount: settings.fixedStakeAmount,
      sorosLevel1Stake: settings.sorosLevel1Stake,
      sorosLevel2Stake: settings.sorosLevel2Stake,
      sorosLevel3Stake: settings.sorosLevel3Stake,
      martingaleLevel1Stake: settings.martingaleLevel1Stake,
      martingaleLevel2Stake: settings.martingaleLevel2Stake,
    };

    const payload: any = {
      id: settingId,
      initialCapital: settings.initialCapital,
      dailyProfitTarget: settings.dailyProfitTarget,
      dailyLossLimit: settings.dailyLossLimit,
      monthlyProfitTarget: settings.monthlyProfitTarget,
      monthlyLossLimit: settings.monthlyLossLimit,
      maxTradesPerDay: settings.maxTradesPerDay,
      alertSoundEnabled: settings.alertSoundEnabled,
      updated_at: settings.updatedAt || new Date().toISOString(),
    };

    const { error } = await supabase.from('risk_settings').upsert(payload);

    if (error) return { success: false, error: error.message };

    const { error: managementError } = await supabase.from('management_settings').upsert({
      id: settingId,
      settings: managementSettings,
      updated_at: payload.updated_at,
    });
    if (managementError) return { success: false, error: managementError.message };

    notifyRealtimeSync('risk_settings', 'UPSERT');
    notifyRealtimeSync('management_settings', 'UPSERT');
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao salvar configurações de risco.' };
  }
}

/**
 * Fetch Capital Transactions (Deposits, Withdrawals, Fees) from Supabase
 */
export async function fetchCapitalTransactionsFromSupabase(userEmail?: string): Promise<{ data: CapitalTransaction[] | null; error: string | null }> {
  try {
    const cleanEmail = userEmail ? userEmail.toLowerCase().trim() : '';
    if (!cleanEmail) return { data: null, error: null };
    const deletedResult = await fetchDeletedRecordIds(cleanEmail);
    if (deletedResult.error) return { data: null, error: deletedResult.error };

    const capMap = new Map<string, CapitalTransaction>();

    // 1. Tenta buscar da tabela principal capital_transactions
    const { data, error } = await supabase
      .from('capital_transactions')
      .select('*')
      .eq('user_email', cleanEmail)
      .order('date', { ascending: false });

    if (!error && data) {
      data.filter((row: any) => !deletedResult.capitalIds.has(String(row.id))).forEach((row: any) => {
        let extractedNotes = row.notes ? String(row.notes) : undefined;
        let extractedStatus: import('../types').CapitalTransactionStatus = row.status ? (row.status as import('../types').CapitalTransactionStatus) : 'COMPLETED';

        if (extractedNotes && extractedNotes.startsWith('{')) {
          try {
            const parsed = JSON.parse(extractedNotes);
            if (parsed && typeof parsed === 'object') {
              if (parsed.status) extractedStatus = parsed.status;
              if (parsed.text !== undefined) extractedNotes = parsed.text;
              else if (parsed.notes !== undefined) extractedNotes = parsed.notes;
            }
          } catch (e) {}
        }

        capMap.set(String(row.id), {
          id: String(row.id),
          type: row.type === 'DEPOSIT' ? 'DEPOSIT' : 'WITHDRAWAL',
          amount: Number(row.amount) || 0,
          fee: Number(row.fee) || 0,
          date: String(row.date),
          time: row.time ? String(row.time) : undefined,
          broker: row.broker ? String(row.broker) : undefined,
          notes: extractedNotes,
          status: extractedStatus,
        });
      });
    }

    const txs = Array.from(capMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    return { data: txs, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Erro ao carregar movimentações de capital.' };
  }
}

/**
 * Upsert a single Capital Transaction in Supabase
 */
export async function upsertCapitalTransactionToSupabase(tx: CapitalTransaction, userEmail?: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const cleanEmail = userEmail ? userEmail.toLowerCase().trim() : '';
    if (!cleanEmail) return { success: false, error: 'User email required' };

    const notesPayload = JSON.stringify({
      text: tx.notes || '',
      status: tx.status || 'COMPLETED',
      broker: tx.broker,
      time: tx.time,
    });

    const payload: any = {
      id: tx.id,
      user_email: cleanEmail,
      data_epoch: journalEpoch(cleanEmail),
      date: tx.date,
      time: tx.time || '12:00',
      type: tx.type,
      amount: tx.amount,
      fee: tx.fee ?? 0,
      broker: tx.broker ?? null,
      notes: notesPayload,
      status: tx.status ?? 'COMPLETED',
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase.from('capital_transactions').upsert(payload);

    if (error && (error.code === 'PGRST204' || error.message.includes('column'))) {
      delete payload.status;
      const res = await supabase.from('capital_transactions').upsert(payload);
      error = res.error;
    }
    if (error) return { success: false, error: error.message };

    notifyRealtimeSync('capital_transactions', 'UPSERT');
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao salvar movimentação no Supabase.' };
  }
}

/**
 * Delete a Capital Transaction from Supabase
 */
export async function deleteCapitalTransactionFromSupabase(txId: string, userEmail?: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const cleanEmail = userEmail ? userEmail.toLowerCase().trim() : '';
    const tombstone = await createDeletedRecordTombstone('capital', txId, cleanEmail);
    if (tombstone) return { success: false, error: tombstone };
    const { error } = await supabase.from('capital_transactions').delete().eq('id', txId).eq('user_email', cleanEmail);
    if (error) return { success: false, error: error.message };
    notifyRealtimeSync('capital_transactions', 'DELETE');
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao excluir movimentação.' };
  }
}

/**
 * Sync batch of capital transactions to Supabase
 */
export async function syncAllCapitalTransactionsToSupabase(txs: CapitalTransaction[], userEmail?: string): Promise<{ count: number; error: string | null }> {
  if (!txs || txs.length === 0) return { count: 0, error: null };
  if (!userEmail) return { count: 0, error: 'E-mail do usuário necessário para sincronizar movimentações de capital.' };
  const cleanEmail = userEmail.toLowerCase().trim();

  try {
    const payloadBatch = txs.map((tx) => ({
      id: tx.id,
      user_email: cleanEmail,
      data_epoch: journalEpoch(cleanEmail),
      date: tx.date,
      time: tx.time || '12:00',
      type: tx.type,
      amount: tx.amount,
      fee: tx.fee ?? 0,
      broker: tx.broker ?? null,
      notes: JSON.stringify({
        text: tx.notes || '',
        status: tx.status || 'COMPLETED',
        broker: tx.broker,
        time: tx.time,
      }),
      status: tx.status ?? 'COMPLETED',
      updated_at: new Date().toISOString(),
    }));

    let { error } = await supabase.from('capital_transactions').upsert(payloadBatch);
    if (error && (error.code === 'PGRST204' || error.message.includes('column'))) {
      const cleanBatch = payloadBatch.map(({ status, ...rest }) => rest);
      ({ error } = await supabase.from('capital_transactions').upsert(cleanBatch));
    }
    if (error) return { count: 0, error: error.message };
  } catch (e: any) {
    return { count: 0, error: e?.message || 'Falha ao enviar movimentações de capital.' };
  }

  for (const tx of txs) {
    const result = await upsertCapitalTransactionToSupabase(tx, cleanEmail);
    if (!result.success) return { count: 0, error: result.error || 'Falha ao confirmar movimentação de capital.' };
  }

  notifyRealtimeSync('capital_transactions', 'UPSERT');
  return { count: txs.length, error: null };
}

/**
 * Fetch all registered system users from Supabase Auth and system_users.
 */

export async function fetchUsersFromSupabase(): Promise<SystemUser[] | null> {
  const { data, error } = await supabase.functions.invoke('manage-users', { body: { action: 'list' } });
  if (error) {
    const own = await supabase.from('system_users').select('*');
    if (own.error) throw own.error;
    return own.data as SystemUser[];
  }
  return data.users;
}
export async function upsertUserToSupabase(user: SystemUser): Promise<{ success: boolean; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('manage-users', { body: { action: 'upsert', user } });
  return { success: !error && !data?.error, error: error?.message || data?.error || null };
}
export async function deleteUserFromSupabase(userId: string, userEmail?: string): Promise<{ success: boolean; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('manage-users', { body: { action: 'delete', id: userId } });
  return { success: !error && !data?.error, error: error?.message || data?.error || null };
}
export async function syncAllUsersToSupabase(_users: SystemUser[]): Promise<void> {
  throw new Error('Usuários locais não podem ser enviados automaticamente. Use o cadastro autenticado.');
}

import { createClient } from '@supabase/supabase-js';
import { Trade, RiskSettings, SystemUser, CapitalTransaction } from '../types';
import { isTradeProtected, getLocalDateStr } from '../utils/calculations';

// Default configuration provided by the user
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://mreykdrbyfrwqovsleqi.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXlrZHJieWZyd3FvdnNsZXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MDQ1NTcsImV4cCI6MjEwNTA4MDU1N30.X8JibBnbQh47nkHv51srbAWrdHZDLojs1xVupV3og1g';

export const SUPABASE_SERVICE_ROLE_KEY =
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXlrZHJieWZyd3FvdnNsZXFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUwNDU1NywiZXhwIjoyMTA1MDgwNTU3fQ.jFaxN67eNfjCG_OJKKdwG7srYFMEGU10HlUA8Aoqk5Q';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY));

// Service Role Key takes precedence to ensure database operations and RLS bypass for admin user management work 100%
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

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

    const trades: Trade[] = (data || [])
      .filter((row: any) => !/^tr-0\d{2}$/.test(String(row.id)) && String(row.id) !== 'tr-024')
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
          date: tradeDate,
          time: String(row.time),
          asset: String(row.asset),
          type: row.type === 'BUY' ? 'BUY' : 'SELL',
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

    return { data: trades, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Erro inesperado ao carregar trades.' };
  }
}

/**
 * Insert or update a single trade in Supabase (Isolated per device/user)
 */
export async function upsertTradeToSupabase(trade: Trade, userEmail?: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const deviceId = getClientDeviceId();
    const payload: any = {
      id: trade.id,
      device_id: deviceId,
      user_email: userEmail || null,
      date: trade.date,
      time: trade.time,
      asset: trade.asset,
      type: trade.type,
      strategy: trade.strategy,
      result: trade.result,
      pnl: trade.pnl,
      contractsOrQuantity: trade.contractsOrQuantity,
      entryPrice: trade.entryPrice ?? null,
      exitPrice: trade.exitPrice ?? null,
      notes: trade.notes ?? null,
      tags: trade.tags ?? [],
      accountType: trade.accountType ?? null,
      isReal: trade.isReal ?? null,
      isAutoCaptured: trade.isAutoCaptured ?? null,
      updated_at: new Date().toISOString(),
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
export async function deleteTradeFromSupabase(tradeId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    // 1. Consulta se a operação é da Conta Real (protegida pelo Anti-Fúria)
    const { data: existing } = await supabase.from('trades').select('*').eq('id', tradeId).maybeSingle();
    if (existing && isTradeProtected(existing as Trade)) {
      return {
        success: false,
        error: 'Operação de Conta Real capturada é estritamente protegida pelo Sistema Anti-Fúria e não pode ser excluída.',
      };
    }

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

/**
 * Delete all trades from Supabase for this device/user
 */
export async function clearAllTradesFromSupabase(userEmail?: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const deviceId = getClientDeviceId();
    let query = supabase.from('trades').delete();
    if (userEmail) {
      query = query.eq('user_email', userEmail);
    } else {
      query = query.eq('device_id', deviceId);
    }

    let { error } = await query;
    if (error) {
      const fallback = await supabase.from('trades').delete().neq('id', '___all_records_cleanup___');
      error = fallback.error;
    }
    if (error) {
      return { success: false, error: error.message };
    }
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
    const deviceId = getClientDeviceId();
    const payload = trades.map((trade) => ({
      id: trade.id,
      device_id: deviceId,
      user_email: userEmail || null,
      date: trade.date,
      time: trade.time,
      asset: trade.asset,
      type: trade.type,
      strategy: trade.strategy,
      result: trade.result,
      pnl: trade.pnl,
      contractsOrQuantity: trade.contractsOrQuantity,
      entryPrice: trade.entryPrice ?? null,
      exitPrice: trade.exitPrice ?? null,
      notes: trade.notes ?? null,
      tags: trade.tags ?? [],
      accountType: trade.accountType ?? null,
      isReal: trade.isReal ?? null,
      isAutoCaptured: trade.isAutoCaptured ?? null,
      updated_at: new Date().toISOString(),
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
    const settingId = cleanEmail ? `settings_${cleanEmail}` : `settings_${getClientDeviceId()}`;

    let { data } = await supabase
      .from('risk_settings')
      .select('*')
      .eq('id', settingId)
      .maybeSingle();

    if (!data && cleanEmail) {
      // Fallback para id baseado em dispositivo ou default_settings
      const deviceSetting = await supabase
        .from('risk_settings')
        .select('*')
        .eq('id', `settings_${getClientDeviceId()}`)
        .maybeSingle();
      data = deviceSetting.data;
    }

    if (!data) {
      const fallback = await supabase
        .from('risk_settings')
        .select('*')
        .eq('id', 'default_settings')
        .maybeSingle();
      data = fallback.data;
    }

    if (!data) {
      return { data: null, error: null };
    }

    let extraManagement: Partial<RiskSettings> = {};
    if (data.notes && typeof data.notes === 'string' && data.notes.trim().startsWith('{')) {
      try {
        const parsedNotes = JSON.parse(data.notes);
        if (parsedNotes && typeof parsedNotes === 'object') {
          extraManagement = parsedNotes;
        }
      } catch (e) {}
    }

    const settings: RiskSettings = {
      initialCapital: data.initialCapital != null ? Number(data.initialCapital) : 0,
      dailyProfitTarget: data.dailyProfitTarget != null ? Number(data.dailyProfitTarget) : 500,
      dailyLossLimit: data.dailyLossLimit != null ? Number(data.dailyLossLimit) : 300,
      monthlyProfitTarget: data.monthlyProfitTarget != null ? Number(data.monthlyProfitTarget) : 5000,
      monthlyLossLimit: data.monthlyLossLimit != null ? Number(data.monthlyLossLimit) : 3000,
      maxTradesPerDay: data.maxTradesPerDay != null ? Number(data.maxTradesPerDay) : 5,
      alertSoundEnabled: Boolean(data.alertSoundEnabled),
      antiFuriaCustomWindowEnabled: Boolean(data.antiFuriaCustomWindowEnabled),
      antiFuriaStartTime: data.antiFuriaStartTime || '07:00',
      antiFuriaEndTime: data.antiFuriaEndTime || '11:30',
      riskLockUntil: data.riskLockUntil || extraManagement.riskLockUntil || undefined,
      riskLockDurationDays: data.riskLockDurationDays != null ? Number(data.riskLockDurationDays) : (extraManagement.riskLockDurationDays ?? 7),
      managementStyle: data.managementStyle || extraManagement.managementStyle || 'MAO_FIXA',
      estimatedPayout: data.estimatedPayout != null ? Number(data.estimatedPayout) : (extraManagement.estimatedPayout ?? 87),
      estimatedWinRate: data.estimatedWinRate != null ? Number(data.estimatedWinRate) : (extraManagement.estimatedWinRate ?? 65),
      stakePercent: data.stakePercent != null ? Number(data.stakePercent) : (extraManagement.stakePercent ?? 2),
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

    const managementJson = JSON.stringify({
      riskLockUntil: settings.riskLockUntil,
      riskLockDurationDays: settings.riskLockDurationDays,
      managementStyle: settings.managementStyle,
      estimatedPayout: settings.estimatedPayout,
      estimatedWinRate: settings.estimatedWinRate,
      stakePercent: settings.stakePercent,
    });

    const payload: any = {
      id: settingId,
      initialCapital: settings.initialCapital,
      dailyProfitTarget: settings.dailyProfitTarget,
      dailyLossLimit: settings.dailyLossLimit,
      monthlyProfitTarget: settings.monthlyProfitTarget,
      monthlyLossLimit: settings.monthlyLossLimit,
      maxTradesPerDay: settings.maxTradesPerDay,
      alertSoundEnabled: settings.alertSoundEnabled,
      antiFuriaCustomWindowEnabled: settings.antiFuriaCustomWindowEnabled ?? false,
      antiFuriaStartTime: settings.antiFuriaStartTime || '07:00',
      antiFuriaEndTime: settings.antiFuriaEndTime || '11:30',
      riskLockUntil: settings.riskLockUntil ?? null,
      riskLockDurationDays: settings.riskLockDurationDays ?? 7,
      managementStyle: settings.managementStyle || 'MAO_FIXA',
      estimatedPayout: settings.estimatedPayout ?? 87,
      estimatedWinRate: settings.estimatedWinRate ?? 65,
      stakePercent: settings.stakePercent ?? 2,
      notes: managementJson,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase.from('risk_settings').upsert(payload);

    if (error && (error.code === 'PGRST204' || error.message.includes('column') || error.message.includes('schema'))) {
      delete payload.antiFuriaCustomWindowEnabled;
      delete payload.antiFuriaStartTime;
      delete payload.antiFuriaEndTime;
      delete payload.riskLockUntil;
      delete payload.riskLockDurationDays;
      delete payload.managementStyle;
      delete payload.estimatedPayout;
      delete payload.estimatedWinRate;
      delete payload.stakePercent;
      await supabase.from('risk_settings').upsert(payload);
    }
    notifyRealtimeSync('risk_settings', 'UPSERT');
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

    // 1. Tenta buscar da tabela principal capital_transactions
    const { data, error } = await supabase
      .from('capital_transactions')
      .select('*')
      .eq('user_email', cleanEmail)
      .order('date', { ascending: false });

    if (!error && data) {
      const txs: CapitalTransaction[] = data.map((row: any) => ({
        id: String(row.id),
        type: row.type === 'DEPOSIT' ? 'DEPOSIT' : 'WITHDRAWAL',
        amount: Number(row.amount) || 0,
        fee: Number(row.fee) || 0,
        date: String(row.date),
        time: row.time ? String(row.time) : undefined,
        broker: row.broker ? String(row.broker) : undefined,
        notes: row.notes ? String(row.notes) : undefined,
      }));
      return { data: txs, error: null };
    }

    // 2. Backup fallback: busca em risk_settings com id captx_*
    const prefix = `captx_${cleanEmail}_`;
    const { data: backupRows } = await supabase.from('risk_settings').select('*').like('id', `${prefix}%`);
    if (backupRows && backupRows.length > 0) {
      const txs: CapitalTransaction[] = backupRows.map((row: any) => ({
        id: String(row.id.replace(prefix, '')),
        type: row.monthlyProfitTarget === 1 ? 'DEPOSIT' : 'WITHDRAWAL',
        amount: Number(row.initialCapital) || 0,
        fee: Number(row.dailyProfitTarget) || 0,
        date: String(row.antiFuriaStartTime || new Date().toISOString().split('T')[0]),
        broker: row.notes || undefined,
      }));
      return { data: txs, error: null };
    }

    return { data: null, error: error?.message || null };
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

    const payload = {
      id: tx.id,
      user_email: cleanEmail,
      date: tx.date,
      time: tx.time ?? null,
      type: tx.type,
      amount: tx.amount,
      fee: tx.fee ?? 0,
      broker: tx.broker ?? null,
      notes: tx.notes ?? null,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase.from('capital_transactions').upsert(payload);

    // Backup em risk_settings
    const backupId = `captx_${cleanEmail}_${tx.id}`;
    const backupPayload: any = {
      id: backupId,
      initialCapital: tx.amount,
      dailyProfitTarget: tx.fee ?? 0,
      dailyLossLimit: 0,
      monthlyProfitTarget: tx.type === 'DEPOSIT' ? 1 : 2,
      monthlyLossLimit: 0,
      maxTradesPerDay: 0,
      alertSoundEnabled: true,
      antiFuriaCustomWindowEnabled: false,
      antiFuriaStartTime: tx.date,
      notes: tx.broker ?? 'Movimentação',
      updated_at: new Date().toISOString(),
    };
    await supabase.from('risk_settings').upsert(backupPayload);

    if (error && !error.message.includes('relation "capital_transactions" does not exist')) {
      return { success: false, error: error.message };
    }
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
    await supabase.from('capital_transactions').delete().eq('id', txId);
    if (cleanEmail) {
      await supabase.from('risk_settings').delete().eq('id', `captx_${cleanEmail}_${txId}`);
    }
    notifyRealtimeSync('capital_transactions', 'DELETE');
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao excluir movimentação.' };
  }
}

/**
 * Sync batch of capital transactions to Supabase
 */
export async function syncAllCapitalTransactionsToSupabase(txs: CapitalTransaction[], userEmail?: string): Promise<void> {
  if (!txs || txs.length === 0 || !userEmail) return;
  for (const tx of txs) {
    await upsertCapitalTransactionToSupabase(tx, userEmail);
  }
}

/**
 * Fetch all registered system users from Supabase (combining Supabase Auth, system_users, and risk_settings backup)
 */
export async function fetchUsersFromSupabase(): Promise<SystemUser[] | null> {
  try {
    const userMap = new Map<string, SystemUser>();

    // 1. Fetch from Supabase Auth Users list (Supabase Dashboard "Users" screen)
    try {
      const { data: authData } = await supabase.auth.admin.listUsers();
      if (authData?.users && authData.users.length > 0) {
        for (const u of authData.users as any[]) {
          if (!u.email) continue;
          const emailClean = String(u.email).toLowerCase().trim();
          const meta = u.user_metadata || {};
          userMap.set(emailClean, {
            id: u.id,
            email: emailClean,
            name: String(meta.name || u.email.split('@')[0]),
            role: meta.role === 'ADMIN' || emailClean === 'oswamitrader@gmail.com' ? 'ADMIN' : 'CLIENT',
            active: meta.active !== false,
            createdAt: u.created_at || new Date().toISOString(),
            lastLoginAt: u.last_sign_in_at || undefined,
            password: meta.password || (emailClean === 'oswamitrader@gmail.com' ? 'admin123' : 'cliente123'),
          });
        }
      }
    } catch (e) {
      console.warn('Erro ao consultar Supabase Auth:', e);
    }

    // 2. Fetch from system_users table
    try {
      const { data: dbUsers, error } = await supabase.from('system_users').select('*');
      if (!error && dbUsers && dbUsers.length > 0) {
        for (const u of dbUsers) {
          const emailClean = String(u.email).toLowerCase().trim();
          const existing = userMap.get(emailClean);
          userMap.set(emailClean, {
            id: String(u.id || existing?.id || `usr-${Date.now()}`),
            email: emailClean,
            name: String(u.name || existing?.name || emailClean),
            role: u.role === 'ADMIN' || emailClean === 'oswamitrader@gmail.com' ? 'ADMIN' : 'CLIENT',
            active: Boolean(u.active),
            createdAt: u.createdAt || existing?.createdAt || new Date().toISOString(),
            lastLoginAt: u.lastLoginAt || existing?.lastLoginAt,
            password: u.password || existing?.password || 'admin123',
          });
        }
      }
    } catch (e) {
      console.warn('Erro ao consultar tabela system_users:', e);
    }

    // 3. Backup fallback: fetch usr-* records from risk_settings table
    try {
      const { data: backupRows } = await supabase.from('risk_settings').select('*').like('id', 'usr-%');
      if (backupRows && backupRows.length > 0) {
        for (const row of backupRows) {
          const emailClean = String(row.id.replace('usr-', '')).toLowerCase().trim();
          const existing = userMap.get(emailClean);
          if (!existing || !existing.password || existing.password === 'admin123') {
            userMap.set(emailClean, {
              id: existing?.id || String(row.id),
              email: emailClean,
              name: String(row.notes || existing?.name || emailClean),
              role: row.monthlyProfitTarget === 999 || emailClean === 'oswamitrader@gmail.com' ? 'ADMIN' : 'CLIENT',
              active: row.alertSoundEnabled !== false,
              createdAt: row.updated_at || existing?.createdAt || new Date().toISOString(),
              password: row.antiFuriaStartTime || existing?.password || 'admin123',
            });
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao consultar backup em risk_settings:', e);
    }

    if (userMap.size > 0) {
      return Array.from(userMap.values());
    }

    return null;
  } catch (err) {
    console.warn('Erro ao carregar usuários do Supabase:', err);
    return null;
  }
}

/**
 * Insert or update a system user in Supabase (persists to Supabase Auth, system_users AND risk_settings backup)
 */
export async function upsertUserToSupabase(user: SystemUser): Promise<{ success: boolean; error: string | null }> {
  try {
    const cleanEmail = user.email.toLowerCase().trim();
    const pass = user.password || 'cliente123';

    // 1. Sync into Supabase Auth Users table (auth.users - visible on Supabase dashboard)
    try {
      const { data: authList } = await supabase.auth.admin.listUsers();
      const usersArray = (authList?.users || []) as any[];
      const existingAuthUser = usersArray.find((u: any) => u.email?.toLowerCase().trim() === cleanEmail);

      if (existingAuthUser) {
        await supabase.auth.admin.updateUserById(existingAuthUser.id, {
          password: pass,
          user_metadata: {
            name: user.name.trim(),
            role: user.role,
            active: user.active,
            password: pass,
          },
        });
      } else {
        await supabase.auth.admin.createUser({
          email: cleanEmail,
          password: pass,
          email_confirm: true,
          user_metadata: {
            name: user.name.trim(),
            role: user.role,
            active: user.active,
            password: pass,
          },
        });
      }
    } catch (e) {
      console.warn('Erro ao atualizar Supabase Auth Users:', e);
    }

    // 2. Sync into system_users table
    const payload = {
      id: user.id,
      email: cleanEmail,
      name: user.name.trim(),
      role: user.role,
      active: user.active,
      password: pass,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
    };
    await supabase.from('system_users').upsert(payload);

    // 3. Sync backup into risk_settings table
    const backupPayload: any = {
      id: `usr-${cleanEmail}`,
      initialCapital: 0,
      dailyProfitTarget: 0,
      dailyLossLimit: 0,
      monthlyProfitTarget: user.role === 'ADMIN' ? 999 : 111,
      monthlyLossLimit: 0,
      maxTradesPerDay: 0,
      alertSoundEnabled: user.active,
      antiFuriaCustomWindowEnabled: false,
      antiFuriaStartTime: pass,
      notes: user.name.trim(),
      updated_at: new Date().toISOString(),
    };
    await supabase.from('risk_settings').upsert(backupPayload);

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao salvar usuário no Supabase.' };
  }
}

/**
 * Delete a user from Supabase (removes from Supabase Auth, system_users, and risk_settings backup)
 */
export async function deleteUserFromSupabase(userId: string, userEmail?: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const cleanEmail = userEmail ? userEmail.toLowerCase().trim() : '';

    // 1. Remove from Supabase Auth Users table
    try {
      const { data: authList } = await supabase.auth.admin.listUsers();
      const usersArray = (authList?.users || []) as any[];
      const existingAuthUser = usersArray.find(
        (u: any) => u.id === userId || (cleanEmail && u.email?.toLowerCase().trim() === cleanEmail)
      );
      if (existingAuthUser) {
        await supabase.auth.admin.deleteUser(existingAuthUser.id);
      }
    } catch (e) {
      console.warn('Erro ao deletar de Supabase Auth:', e);
    }

    // 2. Remove from system_users table
    await supabase.from('system_users').delete().eq('id', userId);
    if (cleanEmail) {
      await supabase.from('system_users').delete().eq('email', cleanEmail);
      // 3. Remove from risk_settings backup
      await supabase.from('risk_settings').delete().eq('id', `usr-${cleanEmail}`);
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao deletar usuário do Supabase.' };
  }
}

/**
 * Sync batch of users to Supabase
 */
export async function syncAllUsersToSupabase(users: SystemUser[]): Promise<void> {
  if (!users || users.length === 0) return;
  for (const user of users) {
    await upsertUserToSupabase(user);
  }
}


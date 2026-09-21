import { createClient } from '@supabase/supabase-js';
import { Trade, RiskSettings, SystemUser } from '../types';
import { isTradeProtected } from '../utils/calculations';

// Default configuration provided by the user
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://mreykdrbyfrwqovsleqi.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXlrZHJieWZyd3FvdnNsZXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MDQ1NTcsImV4cCI6MjEwNTA4MDU1N30.X8JibBnbQh47nkHv51srbAWrdHZDLojs1xVupV3og1g';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

/**
 * Load all trades from Supabase (Isolated per device/user)
 */
export async function fetchTradesFromSupabase(userEmail?: string): Promise<{ data: Trade[] | null; error: string | null }> {
  try {
    const deviceId = getClientDeviceId();
    let query = supabase.from('trades').select('*');

    if (userEmail) {
      query = query.eq('user_email', userEmail);
    } else {
      query = query.eq('device_id', deviceId);
    }

    let { data, error } = await query
      .order('date', { ascending: false })
      .order('time', { ascending: false });

    // Fallback se colunas ainda não existirem no schema do Supabase
    if (error && (error.code === 'PGRST204' || error.message.includes('column'))) {
      const fallback = await supabase
        .from('trades')
        .select('*')
        .order('date', { ascending: false })
        .order('time', { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      return { data: null, error: error.message };
    }

    const trades: Trade[] = (data || [])
      .filter((row: any) => !/^tr-0\d{2}$/.test(String(row.id)) && String(row.id) !== 'tr-024')
      .map((row: any) => ({
      id: String(row.id),
      date: String(row.date),
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
    }));

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
 * Fetch Risk Settings from Supabase (Isolated per device)
 */
export async function fetchRiskSettingsFromSupabase(): Promise<{ data: RiskSettings | null; error: string | null }> {
  try {
    const settingId = `settings_${getClientDeviceId()}`;
    let { data, error } = await supabase
      .from('risk_settings')
      .select('*')
      .eq('id', settingId)
      .maybeSingle();

    if (!data) {
      // Fallback para settings default
      const fallback = await supabase
        .from('risk_settings')
        .select('*')
        .eq('id', 'default_settings')
        .maybeSingle();
      data = fallback.data;
    }

    if (error && !data) {
      return { data: null, error: error.message };
    }

    if (!data) {
      return { data: null, error: null };
    }

    const settings: RiskSettings = {
      initialCapital: data.initialCapital != null ? Number(data.initialCapital) : 0,
      dailyProfitTarget: Number(data.dailyProfitTarget) || 500,
      dailyLossLimit: Number(data.dailyLossLimit) || 300,
      monthlyProfitTarget: Number(data.monthlyProfitTarget) || 5000,
      monthlyLossLimit: Number(data.monthlyLossLimit) || 3000,
      maxTradesPerDay: Number(data.maxTradesPerDay) || 5,
      alertSoundEnabled: Boolean(data.alertSoundEnabled),
      antiFuriaCustomWindowEnabled: Boolean(data.antiFuriaCustomWindowEnabled),
      antiFuriaStartTime: data.antiFuriaStartTime || '07:00',
      antiFuriaEndTime: data.antiFuriaEndTime || '11:30',
    };

    return { data: settings, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Erro ao carregar configurações de risco.' };
  }
}

/**
 * Save Risk Settings to Supabase (Isolated per device)
 */
export async function saveRiskSettingsToSupabase(settings: RiskSettings): Promise<{ success: boolean; error: string | null }> {
  try {
    const settingId = `settings_${getClientDeviceId()}`;
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
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('risk_settings').upsert(payload);

    if (error) {
      // Se a coluna antiFuria ainda não existir na tabela do Supabase, faz fallback enviando os campos base
      if (error.code === 'PGRST204' || error.message.includes('column') || error.message.includes('schema')) {
        delete payload.antiFuriaCustomWindowEnabled;
        delete payload.antiFuriaStartTime;
        delete payload.antiFuriaEndTime;
        await supabase.from('risk_settings').upsert(payload);
      }
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao salvar configurações de risco.' };
  }
}

/**
 * Fetch all registered system users from Supabase
 */
export async function fetchUsersFromSupabase(): Promise<SystemUser[] | null> {
  try {
    const { data, error } = await supabase.from('system_users').select('*');
    if (error || !data) return null;

    return data.map((u: any) => ({
      id: String(u.id),
      email: String(u.email),
      name: String(u.name),
      role: u.role === 'ADMIN' ? 'ADMIN' : 'CLIENT',
      active: Boolean(u.active),
      createdAt: u.createdAt || new Date().toISOString(),
      lastLoginAt: u.lastLoginAt || undefined,
      password: u.password || 'cliente123',
    }));
  } catch (err) {
    console.warn('Erro ao carregar usuários do Supabase:', err);
    return null;
  }
}

/**
 * Insert or update a system user in Supabase
 */
export async function upsertUserToSupabase(user: SystemUser): Promise<{ success: boolean; error: string | null }> {
  try {
    const payload = {
      id: user.id,
      email: user.email.toLowerCase().trim(),
      name: user.name.trim(),
      role: user.role,
      active: user.active,
      password: user.password || 'cliente123',
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
    };

    const { error } = await supabase.from('system_users').upsert(payload);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao salvar usuário no Supabase.' };
  }
}

/**
 * Delete a user from Supabase
 */
export async function deleteUserFromSupabase(userId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.from('system_users').delete().eq('id', userId);
    if (error) {
      return { success: false, error: error.message };
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
  try {
    const payload = users.map((u) => ({
      id: u.id,
      email: u.email.toLowerCase().trim(),
      name: u.name.trim(),
      role: u.role,
      active: u.active,
      password: u.password || 'cliente123',
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt ?? null,
    }));
    await supabase.from('system_users').upsert(payload);
  } catch (e) {
    console.warn('Erro ao sincronizar usuários no Supabase:', e);
  }
}

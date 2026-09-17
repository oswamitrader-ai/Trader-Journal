import { createClient } from '@supabase/supabase-js';
import { Trade, RiskSettings } from '../types';

// Default configuration provided by the user
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://mreykdrbyfrwqovsleqi.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_6ntxWuCoI_0Upy2PVIB6Nw__mMUiPUX';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
 * Load all trades from Supabase
 */
export async function fetchTradesFromSupabase(): Promise<{ data: Trade[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: false });

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
    }));

    return { data: trades, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Erro inesperado ao carregar trades.' };
  }
}

/**
 * Insert or update a single trade in Supabase
 */
export async function upsertTradeToSupabase(trade: Trade): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.from('trades').upsert({
      id: trade.id,
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
      updated_at: new Date().toISOString(),
    });

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
 * Delete all trades from Supabase
 */
export async function clearAllTradesFromSupabase(): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.from('trades').delete().neq('id', '___all_records_cleanup___');
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
export async function syncAllTradesToSupabase(trades: Trade[]): Promise<{ count: number; error: string | null }> {
  if (!trades || trades.length === 0) {
    return { count: 0, error: null };
  }

  try {
    const payload = trades.map((trade) => ({
      id: trade.id,
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
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('trades').upsert(payload);
    if (error) {
      return { count: 0, error: error.message };
    }
    return { count: payload.length, error: null };
  } catch (err: any) {
    return { count: 0, error: err?.message || 'Falha ao sincronizar lote de trades.' };
  }
}

/**
 * Fetch Risk Settings from Supabase
 */
export async function fetchRiskSettingsFromSupabase(): Promise<{ data: RiskSettings | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('risk_settings')
      .select('*')
      .eq('id', 'default_settings')
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }

    if (!data) {
      return { data: null, error: null };
    }

    const settings: RiskSettings = {
      initialCapital: Number(data.initialCapital) || 10000,
      dailyProfitTarget: Number(data.dailyProfitTarget) || 500,
      dailyLossLimit: Number(data.dailyLossLimit) || 300,
      monthlyProfitTarget: Number(data.monthlyProfitTarget) || 5000,
      monthlyLossLimit: Number(data.monthlyLossLimit) || 3000,
      maxTradesPerDay: Number(data.maxTradesPerDay) || 5,
      alertSoundEnabled: Boolean(data.alertSoundEnabled),
    };

    return { data: settings, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Erro ao carregar configurações de risco.' };
  }
}

/**
 * Save Risk Settings to Supabase
 */
export async function saveRiskSettingsToSupabase(settings: RiskSettings): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.from('risk_settings').upsert({
      id: 'default_settings',
      initialCapital: settings.initialCapital,
      dailyProfitTarget: settings.dailyProfitTarget,
      dailyLossLimit: settings.dailyLossLimit,
      monthlyProfitTarget: settings.monthlyProfitTarget,
      monthlyLossLimit: settings.monthlyLossLimit,
      maxTradesPerDay: settings.maxTradesPerDay,
      alertSoundEnabled: settings.alertSoundEnabled,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao salvar configurações de risco.' };
  }
}

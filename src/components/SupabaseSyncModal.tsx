import React, { useState } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  ExternalLink,
  X,
  Code2,
  Trash2,
} from 'lucide-react';
import {
  SUPABASE_URL,
  SupabaseHealthResult,
  checkSupabaseConnection,
  syncAllTradesToSupabase,
  fetchTradesFromSupabase,
  clearAllTradesFromSupabase,
  saveRiskSettingsToSupabase,
} from '../lib/supabase';
import { Trade, RiskSettings } from '../types';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  health: SupabaseHealthResult;
  onRefreshHealth: () => void;
  trades: Trade[];
  settings: RiskSettings;
  onTradesLoadedFromCloud: (trades: Trade[]) => void;
}

const SQL_SCHEMA_SCRIPT = `-- SCHEMA DE CRIAÇÃO NO SUPABASE
-- Copie e cole este código no Supabase: SQL Editor -> New Query -> Run

-- 1. Tabela de Trades
CREATE TABLE IF NOT EXISTS public.trades (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  asset TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  strategy TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('GAIN', 'LOSS', 'BREAKEVEN')),
  pnl NUMERIC NOT NULL,
  "contractsOrQuantity" NUMERIC NOT NULL DEFAULT 1,
  "entryPrice" NUMERIC,
  "exitPrice" NUMERIC,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de trades" ON public.trades;
CREATE POLICY "Permitir leitura de trades" ON public.trades FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de trades" ON public.trades;
CREATE POLICY "Permitir inserção de trades" ON public.trades FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de trades" ON public.trades;
CREATE POLICY "Permitir atualização de trades" ON public.trades FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de trades" ON public.trades;
CREATE POLICY "Permitir exclusão de trades" ON public.trades FOR DELETE USING (true);

-- 2. Tabela de Configurações de Risco
CREATE TABLE IF NOT EXISTS public.risk_settings (
  id TEXT PRIMARY KEY DEFAULT 'default_settings',
  "initialCapital" NUMERIC NOT NULL DEFAULT 10000,
  "dailyProfitTarget" NUMERIC NOT NULL DEFAULT 500,
  "dailyLossLimit" NUMERIC NOT NULL DEFAULT 300,
  "monthlyProfitTarget" NUMERIC NOT NULL DEFAULT 5000,
  "monthlyLossLimit" NUMERIC NOT NULL DEFAULT 3000,
  "maxTradesPerDay" NUMERIC NOT NULL DEFAULT 5,
  "alertSoundEnabled" BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.risk_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de risk_settings" ON public.risk_settings;
CREATE POLICY "Permitir leitura de risk_settings" ON public.risk_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir gravação de risk_settings" ON public.risk_settings;
CREATE POLICY "Permitir gravação de risk_settings" ON public.risk_settings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de risk_settings" ON public.risk_settings;
CREATE POLICY "Permitir atualização de risk_settings" ON public.risk_settings FOR UPDATE USING (true);
`;

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
  health,
  onRefreshHealth,
  trades,
  settings,
  onTradesLoadedFromCloud,
}) => {
  const [copiedSql, setCopiedSql] = useState(false);
  const [isSyncingUp, setIsSyncingUp] = useState(false);
  const [isSyncingDown, setIsSyncingDown] = useState(false);
  const [isClearingCloud, setIsClearingCloud] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showSqlViewer, setShowSqlViewer] = useState(false);

  if (!isOpen) return null;

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SQL_SCHEMA_SCRIPT);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      // Fallback
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    }
  };

  const handlePushToCloud = async () => {
    setIsSyncingUp(true);
    setSyncFeedback(null);
    try {
      const tradesResult = await syncAllTradesToSupabase(trades);
      const settingsResult = await saveRiskSettingsToSupabase(settings);

      if (tradesResult.error) {
        setSyncFeedback({
          type: 'error',
          message: `Erro ao enviar trades: ${tradesResult.error}. Verifique se criou as tabelas no Supabase.`,
        });
      } else if (settingsResult.error) {
        setSyncFeedback({
          type: 'error',
          message: `Trades enviados, mas houve erro ao salvar configurações: ${settingsResult.error}`,
        });
      } else {
        setSyncFeedback({
          type: 'success',
          message: `Sucesso! ${tradesResult.count} operações e parâmetros de risco foram salvos no Supabase.`,
        });
        onRefreshHealth();
      }
    } catch (e: any) {
      setSyncFeedback({
        type: 'error',
        message: e?.message || 'Falha ao sincronizar dados.',
      });
    } finally {
      setIsSyncingUp(false);
    }
  };

  const handlePullFromCloud = async () => {
    setIsSyncingDown(true);
    setSyncFeedback(null);
    try {
      const result = await fetchTradesFromSupabase();
      if (result.error) {
        setSyncFeedback({
          type: 'error',
          message: `Erro ao baixar trades do Supabase: ${result.error}`,
        });
      } else if (result.data) {
        onTradesLoadedFromCloud(result.data);
        setSyncFeedback({
          type: 'success',
          message:
            result.data.length > 0
              ? `${result.data.length} operações foram baixadas do Supabase com sucesso!`
              : 'Conectado ao Supabase: banco 100% limpo (0 operações cadastradas). Diário sincronizado!',
        });
        onRefreshHealth();
      }
    } catch (e: any) {
      setSyncFeedback({
        type: 'error',
        message: e?.message || 'Falha ao baixar dados.',
      });
    } finally {
      setIsSyncingDown(false);
    }
  };

  const handleClearCloudTrades = async () => {
    if (!window.confirm('Tem certeza de que deseja apagar todas as operações gravadas no Supabase?')) {
      return;
    }
    setIsClearingCloud(true);
    setSyncFeedback(null);
    try {
      const res = await clearAllTradesFromSupabase();
      if (res.error) {
        setSyncFeedback({
          type: 'error',
          message: `Erro ao limpar banco: ${res.error}`,
        });
      } else {
        onTradesLoadedFromCloud([]);
        setSyncFeedback({
          type: 'success',
          message: 'Banco Supabase limpo com sucesso! Todas as operações foram removidas.',
        });
        onRefreshHealth();
      }
    } catch (e: any) {
      setSyncFeedback({
        type: 'error',
        message: e?.message || 'Erro ao limpar banco.',
      });
    } finally {
      setIsClearingCloud(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-black border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-black">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Conexão com Banco de Dados Supabase
              </h2>
              <p className="text-xs text-slate-400">
                Sincronização persistente de trades e regras de risco na nuvem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Status Box */}
          <div className="p-4 rounded-xl border bg-black border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Status da Conexão
              </span>
              <button
                onClick={onRefreshHealth}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Verificar agora
              </button>
            </div>

            <div className="flex items-start gap-3">
              {health.status === 'connected' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              {health.status === 'table_missing' && (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              )}
              {health.status === 'error' && (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              {health.status === 'connecting' && (
                <RefreshCw className="w-5 h-5 text-sky-400 animate-spin shrink-0 mt-0.5" />
              )}

              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  {health.status === 'connected' && 'Supabase Conectado & Operacional'}
                  {health.status === 'table_missing' && 'Conectado! Tabelas PostgreSQL Pendentes'}
                  {health.status === 'error' && 'Falha na Conexão'}
                  {health.status === 'connecting' && 'Verificando conexão com o Supabase...'}
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">{health.message}</p>
                <div className="text-[11px] font-mono text-slate-500 break-all pt-1">
                  URL: {SUPABASE_URL}
                </div>
              </div>
            </div>
          </div>

          {/* If table is missing: High Priority Call-to-action */}
          {health.status === 'table_missing' && (
            <div className="p-4 rounded-xl bg-amber-600 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-semibold text-sm">
                  <Code2 className="w-4 h-4" />
                  Como criar as tabelas no Supabase em 1 minuto:
                </div>
                <button
                  onClick={handleCopySql}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-xs transition shadow-sm"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSql ? 'Copiado!' : 'Copiar Script SQL'}
                </button>
              </div>

              <ol className="text-xs text-white space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>
                  Acesse o painel do seu projeto no{' '}
                    <a
                    href="https://supabase.com/dashboard/project/mreykdrbyfrwqovsleqi/sql"
                    target="_blank"
                    rel="noreferrer"
                    className="text-white hover:underline inline-flex items-center gap-1 font-bold"
                  >
                    Supabase SQL Editor <ExternalLink className="w-3 h-3 inline" />
                  </a>
                </li>
                <li>Clique em <strong>"New query"</strong>.</li>
                <li>Cole o script SQL copiado e clique no botão verde <strong>"Run"</strong>.</li>
                <li>Volte aqui e clique em <strong>"Verificar agora"</strong>. As tabelas estarão prontas para gravação!</li>
              </ol>

              <div>
                <button
                  onClick={() => setShowSqlViewer(!showSqlViewer)}
                  className="text-xs text-white hover:underline font-bold"
                >
                  {showSqlViewer ? 'Ocultar código SQL' : 'Visualizar código SQL completo'}
                </button>

                {showSqlViewer && (
                  <pre className="mt-2 p-3 bg-black rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {SQL_SCHEMA_SCRIPT}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Feedback banner */}
          {syncFeedback && (
            <div
              className={`p-3.5 rounded-xl text-xs font-bold leading-relaxed flex items-center justify-between shadow-sm ${
                syncFeedback.type === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-600 text-white'
              }`}
            >
              <span>{syncFeedback.message}</span>
              <button
                onClick={() => setSyncFeedback(null)}
                className="p-1 text-white/80 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={handlePushToCloud}
              disabled={isSyncingUp || health.status === 'error'}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-emerald-950/50"
            >
              {isSyncingUp ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <UploadCloud className="w-4 h-4" />
              )}
              {isSyncingUp ? 'Enviando dados...' : `Enviar Locais para Supabase (${trades.length})`}
            </button>

            <button
              onClick={handlePullFromCloud}
              disabled={isSyncingDown || health.status === 'error'}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-black disabled:text-slate-700 text-slate-200 font-semibold rounded-xl text-sm border border-slate-700 transition"
            >
              {isSyncingDown ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <DownloadCloud className="w-4 h-4" />
              )}
              {isSyncingDown ? 'Baixando...' : 'Carregar do Supabase'}
            </button>
          </div>

          {/* Purge Cloud Data button */}
          <div className="pt-1 flex justify-center">
            <button
              onClick={handleClearCloudTrades}
              disabled={isClearingCloud || health.status === 'error'}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition py-1 px-3 rounded-lg hover:bg-rose-600 font-bold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isClearingCloud ? 'Limpando...' : 'Limpar todas as operações no Supabase'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-black flex items-center justify-between text-xs text-slate-400">
          <span>Tabela: <strong className="text-slate-200">public.trades</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

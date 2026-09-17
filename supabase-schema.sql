-- ==============================================================================
-- SCHEMA DO BANCO DE DADOS SUPABASE - PAINEL DE GERENCIAMENTO TRADER
-- Projeto: https://mreykdrbyfrwqovsleqi.supabase.co
-- Copie e cole este script no painel do Supabase: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Criar tabela de Trades (Operações)
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

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para a chave publishable/anon
DROP POLICY IF EXISTS "Permitir leitura de trades" ON public.trades;
CREATE POLICY "Permitir leitura de trades"
  ON public.trades FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Permitir inserção de trades" ON public.trades;
CREATE POLICY "Permitir inserção de trades"
  ON public.trades FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de trades" ON public.trades;
CREATE POLICY "Permitir atualização de trades"
  ON public.trades FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de trades" ON public.trades;
CREATE POLICY "Permitir exclusão de trades"
  ON public.trades FOR DELETE
  USING (true);

-- 2. Criar tabela de Configurações de Risco (Risk Settings)
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
CREATE POLICY "Permitir leitura de risk_settings"
  ON public.risk_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Permitir gravação de risk_settings" ON public.risk_settings;
CREATE POLICY "Permitir gravação de risk_settings"
  ON public.risk_settings FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de risk_settings" ON public.risk_settings;
CREATE POLICY "Permitir atualização de risk_settings"
  ON public.risk_settings FOR UPDATE
  USING (true);

-- Inserir configuração padrão inicial caso não exista
INSERT INTO public.risk_settings (
  id,
  "initialCapital",
  "dailyProfitTarget",
  "dailyLossLimit",
  "monthlyProfitTarget",
  "monthlyLossLimit",
  "maxTradesPerDay",
  "alertSoundEnabled"
) VALUES (
  'default_settings',
  10000,
  500,
  300,
  5000,
  3000,
  5,
  true
) ON CONFLICT (id) DO NOTHING;

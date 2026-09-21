-- ==============================================================================
-- SCHEMA COMPLETO DO BANCO DE DADOS SUPABASE - PAINEL DE GERENCIAMENTO TRADER
-- Projeto: https://mreykdrbyfrwqovsleqi.supabase.co
-- Instruções: Copie todo este conteúdo, abra o painel do Supabase em
-- SQL Editor -> New Query -> cole este texto -> clique em RUN.
-- ==============================================================================

-- 1. Criar tabela de Usuários do Sistema (Admin e Clientes)
CREATE TABLE IF NOT EXISTS public.system_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'CLIENT' CHECK (role IN ('ADMIN', 'CLIENT')),
  active BOOLEAN NOT NULL DEFAULT true,
  password TEXT NOT NULL DEFAULT 'cliente123',
  "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  "lastLoginAt" TIMESTAMPTZ
);

ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de system_users" ON public.system_users;
CREATE POLICY "Permitir leitura de system_users" ON public.system_users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de system_users" ON public.system_users;
CREATE POLICY "Permitir inserção de system_users" ON public.system_users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de system_users" ON public.system_users;
CREATE POLICY "Permitir atualização de system_users" ON public.system_users FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de system_users" ON public.system_users;
CREATE POLICY "Permitir exclusão de system_users" ON public.system_users FOR DELETE USING (true);

-- Seed do usuário Administrador Padrão
INSERT INTO public.system_users (
  id,
  email,
  name,
  role,
  active,
  password,
  "createdAt"
) VALUES (
  'usr-admin-001',
  'oswamitrader@gmail.com',
  'Swami Trader (Admin)',
  'ADMIN',
  true,
  'admin123',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 2. Criar tabela de Trades (Operações)
CREATE TABLE IF NOT EXISTS public.trades (
  id TEXT PRIMARY KEY,
  user_email TEXT,
  device_id TEXT,
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
  "accountType" TEXT,
  "isReal" BOOLEAN,
  "isAutoCaptured" BOOLEAN,
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

-- Garantir adição de colunas em bancos legados
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS "accountType" TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS "isReal" BOOLEAN;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS "isAutoCaptured" BOOLEAN;

-- 3. Criar tabela de Configurações de Risco (Risk Settings)
CREATE TABLE IF NOT EXISTS public.risk_settings (
  id TEXT PRIMARY KEY DEFAULT 'default_settings',
  "initialCapital" NUMERIC NOT NULL DEFAULT 0,
  "dailyProfitTarget" NUMERIC NOT NULL DEFAULT 500,
  "dailyLossLimit" NUMERIC NOT NULL DEFAULT 300,
  "monthlyProfitTarget" NUMERIC NOT NULL DEFAULT 5000,
  "monthlyLossLimit" NUMERIC NOT NULL DEFAULT 3000,
  "maxTradesPerDay" NUMERIC NOT NULL DEFAULT 5,
  "alertSoundEnabled" BOOLEAN NOT NULL DEFAULT true,
  "antiFuriaCustomWindowEnabled" BOOLEAN DEFAULT false,
  "antiFuriaStartTime" TEXT DEFAULT '07:00',
  "antiFuriaEndTime" TEXT DEFAULT '11:30',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.risk_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de risk_settings" ON public.risk_settings;
CREATE POLICY "Permitir leitura de risk_settings" ON public.risk_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir gravação de risk_settings" ON public.risk_settings;
CREATE POLICY "Permitir gravação de risk_settings" ON public.risk_settings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de risk_settings" ON public.risk_settings;
CREATE POLICY "Permitir atualização de risk_settings" ON public.risk_settings FOR UPDATE USING (true);

-- Garantir adição de colunas em bancos legados
ALTER TABLE public.risk_settings ADD COLUMN IF NOT EXISTS "antiFuriaCustomWindowEnabled" BOOLEAN DEFAULT false;
ALTER TABLE public.risk_settings ADD COLUMN IF NOT EXISTS "antiFuriaStartTime" TEXT DEFAULT '07:00';
ALTER TABLE public.risk_settings ADD COLUMN IF NOT EXISTS "antiFuriaEndTime" TEXT DEFAULT '11:30';

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
  0,
  500,
  300,
  5000,
  3000,
  5,
  true
) ON CONFLICT (id) DO NOTHING;

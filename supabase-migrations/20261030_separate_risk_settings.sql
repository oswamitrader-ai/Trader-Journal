-- Separa configuracoes complementares, marcadores de exclusao e registros de backup
-- da tabela risk_settings. Copia os dados legados antes de remover as linhas/colunas.
BEGIN;

-- Garante as tabelas de destino antes de copiar os dados legados.
-- A versão anterior presumiu que system_users já existia e parou com 42P01.
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
DROP POLICY IF EXISTS "Permitir inserção de system_users" ON public.system_users;
DROP POLICY IF EXISTS "Permitir atualização de system_users" ON public.system_users;
DROP POLICY IF EXISTS "Permitir exclusão de system_users" ON public.system_users;
DROP POLICY IF EXISTS "System Users Own Row" ON public.system_users;
CREATE POLICY "System Users Own Row" ON public.system_users
  FOR SELECT USING (lower(email) = lower(auth.jwt() ->> 'email'));

CREATE TABLE IF NOT EXISTS public.capital_transactions (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL')),
  amount NUMERIC NOT NULL,
  fee NUMERIC DEFAULT 0,
  broker TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.capital_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Capital Transactions Own Rows" ON public.capital_transactions;
CREATE POLICY "Capital Transactions Own Rows" ON public.capital_transactions
  FOR ALL USING (lower(user_email) = lower(auth.jwt() ->> 'email'))
  WITH CHECK (lower(user_email) = lower(auth.jwt() ->> 'email'));

CREATE TABLE IF NOT EXISTS public.management_settings (
  id TEXT PRIMARY KEY,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.management_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Management Settings Access" ON public.management_settings;
DROP POLICY IF EXISTS "Management Settings Own Rows" ON public.management_settings;
CREATE POLICY "Management Settings Own Rows" ON public.management_settings
  FOR ALL USING (lower(substring(id FROM 10)) = lower(auth.jwt() ->> 'email'))
  WITH CHECK (lower(substring(id FROM 10)) = lower(auth.jwt() ->> 'email'));

CREATE TABLE IF NOT EXISTS public.deleted_records (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('trade', 'capital')),
  record_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_email, record_type, record_id)
);

ALTER TABLE public.deleted_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deleted Records Access" ON public.deleted_records;
DROP POLICY IF EXISTS "Deleted Records Own Rows" ON public.deleted_records;
CREATE POLICY "Deleted Records Own Rows" ON public.deleted_records
  FOR ALL USING (lower(user_email) = lower(auth.jwt() ->> 'email'))
  WITH CHECK (lower(user_email) = lower(auth.jwt() ->> 'email'));

-- Transfere o JSON antigo de notes e quaisquer colunas complementares já existentes.
DO $$
DECLARE
  legacy_row RECORD;
  legacy_json TEXT;
  management_json JSONB;
  row_json JSONB;
BEGIN
  FOR legacy_row IN
    SELECT * FROM public.risk_settings
    WHERE id LIKE 'settings\_%' ESCAPE '\'
  LOOP
    row_json := to_jsonb(legacy_row);
    legacy_json := row_json ->> 'notes';
    management_json := row_json - ARRAY[
      'id', 'initialCapital', 'dailyProfitTarget', 'dailyLossLimit',
      'monthlyProfitTarget', 'monthlyLossLimit', 'maxTradesPerDay',
      'alertSoundEnabled', 'antiFuriaCustomWindowEnabled',
      'antiFuriaStartTime', 'antiFuriaEndTime', 'updated_at', 'notes'
    ];

    IF legacy_json IS NOT NULL AND btrim(legacy_json) LIKE '{%' THEN
      BEGIN
        management_json := management_json || (legacy_json::jsonb - ARRAY[
          'initialCapital', 'dailyProfitTarget', 'dailyLossLimit',
          'monthlyProfitTarget', 'monthlyLossLimit', 'maxTradesPerDay',
          'alertSoundEnabled', 'antiFuriaCustomWindowEnabled',
          'antiFuriaStartTime', 'antiFuriaEndTime'
        ]);
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END IF;

    INSERT INTO public.management_settings (id, settings, updated_at)
    VALUES (legacy_row.id, jsonb_strip_nulls(COALESCE(management_json, '{}'::jsonb)), legacy_row.updated_at)
    ON CONFLICT (id) DO UPDATE
      SET settings = EXCLUDED.settings || public.management_settings.settings,
          updated_at = GREATEST(public.management_settings.updated_at, EXCLUDED.updated_at);
  END LOOP;
END $$;

-- Restaura movimentacoes antigas que existiam somente como backup em risk_settings.
WITH legacy_rows AS (
  SELECT
    r.*,
    to_jsonb(r) AS row_json,
    regexp_match(r.id, '^captx_(.+)_([^_]+)$') AS key_parts
  FROM public.risk_settings r
  WHERE r.id LIKE 'captx\_%' ESCAPE '\'
), decoded AS (
  SELECT
    key_parts[2] AS transaction_id,
    key_parts[1] AS user_email,
    COALESCE(NULLIF(row_json ->> 'antiFuriaStartTime', ''), to_char(now(), 'YYYY-MM-DD')) AS transaction_date,
    CASE WHEN COALESCE(row_json ->> 'notes', '') LIKE '{%' THEN
      CASE WHEN (row_json ->> 'notes')::jsonb ? 'time' THEN (row_json ->> 'notes')::jsonb ->> 'time' ELSE NULL END
    ELSE NULL END AS transaction_time,
    CASE WHEN row_json ->> 'monthlyProfitTarget' = '1' THEN 'DEPOSIT' ELSE 'WITHDRAWAL' END AS transaction_type,
    COALESCE(NULLIF(row_json ->> 'initialCapital', '')::numeric, 0) AS amount,
    COALESCE(NULLIF(row_json ->> 'dailyProfitTarget', '')::numeric, 0) AS fee,
    CASE WHEN COALESCE(row_json ->> 'notes', '') LIKE '{%' THEN
      CASE WHEN (row_json ->> 'notes')::jsonb ? 'broker' THEN (row_json ->> 'notes')::jsonb ->> 'broker' ELSE NULL END
    ELSE NULL END AS broker,
    row_json ->> 'notes' AS notes,
    row_json ->> 'updated_at' AS updated_at
  FROM legacy_rows
  WHERE key_parts IS NOT NULL AND row_json ->> 'monthlyProfitTarget' IN ('1', '2')
)
INSERT INTO public.capital_transactions (id, user_email, date, time, type, amount, fee, broker, notes, updated_at)
SELECT transaction_id, user_email, transaction_date, transaction_time, transaction_type,
       amount, fee, broker, notes, COALESCE(updated_at::timestamptz, now())
FROM decoded
ON CONFLICT (id) DO NOTHING;

-- Restaura contas legadas ausentes na tabela própria de usuários.
WITH legacy_users AS (
  SELECT id, to_jsonb(r) AS row_json
  FROM public.risk_settings r
  WHERE id LIKE 'usr-%' AND substr(id, 5) LIKE '%@%'
)
INSERT INTO public.system_users (id, email, name, role, active, password, "createdAt")
SELECT
  id,
  lower(substr(id, 5)),
  COALESCE(NULLIF(row_json ->> 'notes', ''), substr(id, 5)),
  CASE WHEN row_json ->> 'monthlyProfitTarget' = '999' THEN 'ADMIN' ELSE 'CLIENT' END,
  COALESCE((row_json ->> 'alertSoundEnabled')::boolean, true),
  COALESCE(NULLIF(row_json ->> 'antiFuriaStartTime', ''), 'cliente123'),
  COALESCE((row_json ->> 'updated_at')::timestamptz, now())
FROM legacy_users
ON CONFLICT DO NOTHING;

-- Move as exclusoes sincronizadas para uma tabela dedicada.
WITH legacy_tombstones AS (
  SELECT id, updated_at, regexp_match(id, '^deleted_(trade|capital)_(.+)_([^_]+)$') AS key_parts
  FROM public.risk_settings
  WHERE id LIKE 'deleted\_%' ESCAPE '\'
)
INSERT INTO public.deleted_records (id, user_email, record_type, record_id, updated_at)
SELECT id, key_parts[2], key_parts[1], key_parts[3], updated_at
FROM legacy_tombstones
WHERE key_parts IS NOT NULL
ON CONFLICT (user_email, record_type, record_id) DO NOTHING;

-- Remove os registros de outras entidades depois de copiar para suas tabelas próprias.
DELETE FROM public.risk_settings
WHERE id LIKE 'captx\_%' ESCAPE '\'
   OR (id LIKE 'usr-%' AND substr(id, 5) LIKE '%@%')
   OR id LIKE 'deleted\_%' ESCAPE '\'
   OR id = 'default_settings';

ALTER TABLE public.risk_settings ALTER COLUMN id DROP DEFAULT;

-- Mantem em risk_settings somente os campos que descrevem limites e regras de risco.
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS notes;
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS "riskLockUntil";
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS "riskLockDurationDays";
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS "managementStyle";
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS "estimatedPayout";
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS "estimatedWinRate";
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS "stakePercent";
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS "permanentMobileBrokerLockEnabled";
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS "enforceBrokerStakeLock";
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS "fixedStakeAmount";
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS "sorosLevel1Stake";
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS "sorosLevel2Stake";
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS "sorosLevel3Stake";
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS "martingaleLevel1Stake";
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS "martingaleLevel2Stake";
ALTER TABLE public.risk_settings DROP COLUMN IF EXISTS permanent_mobile_lock;

COMMIT;

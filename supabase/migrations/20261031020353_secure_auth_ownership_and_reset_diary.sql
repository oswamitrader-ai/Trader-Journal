
CREATE SCHEMA IF NOT EXISTS private;
ALTER TABLE public.system_users DROP COLUMN IF EXISTS password;
UPDATE auth.users SET raw_user_meta_data=raw_user_meta_data - 'password';
UPDATE auth.users SET raw_app_meta_data=coalesce(raw_app_meta_data,'{}') || '{"role":"ADMIN"}'::jsonb WHERE id='cd33aa2e-d83d-436b-a048-cc4f1d79937f';
INSERT INTO public.system_users(id,email,name,role,active,"createdAt")
SELECT id::text,lower(email),coalesce(raw_user_meta_data->>'name',email),case when raw_app_meta_data->>'role'='ADMIN' then 'ADMIN' else 'CLIENT' end,true,created_at FROM auth.users
ON CONFLICT(email) DO UPDATE SET id=excluded.id,role=excluded.role;
CREATE TABLE public.journal_resets(user_email text PRIMARY KEY,epoch text NOT NULL,reset_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.journal_resets ENABLE ROW LEVEL SECURITY;
INSERT INTO public.journal_resets VALUES ('oswamitrader@gmail.com',gen_random_uuid()::text,now());
ALTER TABLE public.trades ADD COLUMN data_epoch text;
ALTER TABLE public.capital_transactions ADD COLUMN data_epoch text;
INSERT INTO public.deleted_records(id,user_email,record_type,record_id)
SELECT 'trade_'||user_email||'_'||id,user_email,'trade',id FROM public.trades WHERE user_email='oswamitrader@gmail.com'
ON CONFLICT(user_email,record_type,record_id) DO NOTHING;
INSERT INTO public.deleted_records(id,user_email,record_type,record_id)
SELECT 'capital_'||user_email||'_'||id,user_email,'capital',id FROM public.capital_transactions WHERE user_email='oswamitrader@gmail.com'
ON CONFLICT(user_email,record_type,record_id) DO NOTHING;
DELETE FROM public.trades WHERE user_email='oswamitrader@gmail.com';
DELETE FROM public.capital_transactions WHERE user_email='oswamitrader@gmail.com';
DO $$ DECLARE p record; t text; predicate text; BEGIN
FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('trades','capital_transactions','deleted_records','risk_settings','management_settings','system_users','journal_resets')
LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename); END LOOP;
FOREACH t IN ARRAY ARRAY['trades','capital_transactions','deleted_records','risk_settings','management_settings','system_users','journal_resets'] LOOP
EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
EXECUTE format('REVOKE ALL ON public.%I FROM anon, service_role',t);
predicate := CASE WHEN t='system_users' THEN 'id = (select auth.uid())::text' WHEN t IN ('risk_settings','management_settings') THEN 'id = ''settings_'' || lower((select auth.jwt())->>''email'')' ELSE 'user_email = lower((select auth.jwt())->>''email'')' END;
EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
EXECUTE format('CREATE POLICY own_read ON public.%I FOR SELECT TO authenticated USING (%s)',t,predicate);
IF t NOT IN ('system_users','journal_resets') THEN
EXECUTE format('GRANT INSERT,UPDATE ON public.%I TO authenticated',t);
EXECUTE format('CREATE POLICY own_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',t,predicate);
EXECUTE format('CREATE POLICY own_update ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',t,predicate,predicate);
IF t <> 'deleted_records' THEN
EXECUTE format('GRANT DELETE ON public.%I TO authenticated',t);
EXECUTE format('CREATE POLICY own_delete ON public.%I FOR DELETE TO authenticated USING (%s)',t,predicate);
END IF; END IF; END LOOP; END $$;
REVOKE DELETE ON public.deleted_records FROM authenticated;
CREATE OR REPLACE FUNCTION private.guard_journal_write() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE expected text; kind text;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão autenticada obrigatória'; END IF;
SELECT epoch INTO expected FROM public.journal_resets WHERE user_email=NEW.user_email;
IF expected IS NOT NULL AND NEW.data_epoch IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Cópia anterior à limpeza. Sincronize novamente.'; END IF;
kind := CASE WHEN TG_TABLE_NAME='trades' THEN 'trade' ELSE 'capital' END;
IF EXISTS(SELECT 1 FROM public.deleted_records WHERE user_email=NEW.user_email AND record_type=kind AND record_id=NEW.id) THEN RAISE EXCEPTION 'Registro excluído permanentemente'; END IF;
RETURN NEW;
END $$;
CREATE TRIGGER guard_journal_write BEFORE INSERT OR UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION private.guard_journal_write();
CREATE TRIGGER guard_journal_write BEFORE INSERT OR UPDATE ON public.capital_transactions FOR EACH ROW EXECUTE FUNCTION private.guard_journal_write();
CREATE OR REPLACE FUNCTION private.sync_auth_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
INSERT INTO public.system_users(id,email,name,role,active,"createdAt")
VALUES(NEW.id::text,lower(NEW.email),coalesce(NEW.raw_user_meta_data->>'name',NEW.email),case when NEW.raw_app_meta_data->>'role'='ADMIN' then 'ADMIN' else 'CLIENT' end,coalesce((NEW.raw_app_meta_data->>'active')::boolean,true),NEW.created_at)
ON CONFLICT(email) DO UPDATE SET id=excluded.id,name=excluded.name,role=excluded.role,active=excluded.active;
RETURN NEW; END $$;
REVOKE ALL ON FUNCTION private.sync_auth_profile() FROM public,anon,authenticated;
CREATE TRIGGER sync_auth_profile AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION private.sync_auth_profile();
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM public,anon,authenticated;

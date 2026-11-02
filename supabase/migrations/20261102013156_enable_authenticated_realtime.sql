DO $$
DECLARE t text;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  CREATE PUBLICATION supabase_realtime;
 END IF;
 FOREACH t IN ARRAY ARRAY['trades','capital_transactions','risk_settings','management_settings','deleted_records','journal_resets','system_users'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
   EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
  END IF;
 END LOOP;
END $$;

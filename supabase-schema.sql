-- As migrações de segurança são administradas no servidor.
-- Este diagnóstico não altera políticas nem libera acesso público.
SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public';

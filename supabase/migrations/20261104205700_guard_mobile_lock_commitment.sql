create or replace function public.guard_mobile_lock_commitment()
returns trigger language plpgsql set search_path = '' as $$
declare deadline timestamptz;
begin
  if old.settings->>'permanentMobileBrokerLockEnabled' = 'true' then
    deadline := nullif(old.settings->>'riskLockUntil','')::timestamptz;
    if deadline > now() and (
      (new.settings->>'permanentMobileBrokerLockEnabled') is distinct from 'true'
      or coalesce(nullif(new.settings->>'riskLockUntil','')::timestamptz,'-infinity'::timestamptz) < deadline
    ) then
      raise exception 'O bloqueio do celular está protegido até %.', deadline;
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_mobile_lock_commitment before update of settings on public.management_settings
for each row execute function public.guard_mobile_lock_commitment();

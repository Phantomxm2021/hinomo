alter table public.profiles
  add column if not exists onboarding_welcome_seen_at timestamptz;

create or replace function public.mark_onboarding_welcome_seen()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  seen_at timestamptz := pg_catalog.now();
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  insert into public.profiles (id, onboarding_welcome_seen_at, updated_at)
  values (caller, seen_at, seen_at)
  on conflict (id) do update
    set onboarding_welcome_seen_at = coalesce(public.profiles.onboarding_welcome_seen_at, excluded.onboarding_welcome_seen_at),
        updated_at = case
          when public.profiles.onboarding_welcome_seen_at is null then excluded.updated_at
          else public.profiles.updated_at
        end;
end;
$$;

revoke all on function public.mark_onboarding_welcome_seen() from public, anon, authenticated;
grant execute on function public.mark_onboarding_welcome_seen() to authenticated;

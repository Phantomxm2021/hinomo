alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

-- Profiles that existed before the first-time flow was introduced must not
-- receive it retroactively. Profiles that already saw the earlier welcome
-- remain in progress and can finish the flow.
update public.profiles
set onboarding_completed_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
where onboarding_completed_at is null
  and onboarding_welcome_seen_at is null;

create or replace function private.complete_box_owner_onboarding()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  box_owner_id uuid;
begin
  select owner_id into box_owner_id
  from public.boxes
  where id = new.box_id;

  update public.profiles
  set onboarding_completed_at = coalesce(onboarding_completed_at, pg_catalog.now()),
      updated_at = case
        when onboarding_completed_at is null then pg_catalog.now()
        else updated_at
      end
  where id = box_owner_id;

  return new;
end;
$$;

drop trigger if exists items_complete_box_owner_onboarding on public.items;
create trigger items_complete_box_owner_onboarding
after insert on public.items
for each row execute function private.complete_box_owner_onboarding();

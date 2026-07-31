alter table public.venues
add column is_default boolean not null default false;

create unique index venues_one_default_per_owner
on public.venues(owner_id)
where is_default;

update public.venues as venues
set is_default = true
where lower(btrim(venues.name)) = lower('默认')
  and not exists (
    select 1 from public.venues as existing
    where existing.owner_id = venues.owner_id
      and existing.is_default
  );

insert into public.venues(owner_id, name, is_default)
select users.id, '默认', true
from auth.users as users
on conflict (owner_id) where is_default do nothing;

create or replace function public.create_default_venue_for_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.venues(owner_id, name, is_default)
  values (new.id, '默认', true)
  on conflict (owner_id) where is_default do nothing;
  return new;
end;
$$;

revoke all on function public.create_default_venue_for_user() from public, anon, authenticated;

create trigger auth_user_create_default_venue
after insert on auth.users
for each row execute function public.create_default_venue_for_user();

drop policy venues_insert_own on public.venues;
create policy venues_insert_own on public.venues
for insert to authenticated
with check (
  owner_id = auth.uid()
  and not is_default
);

drop policy venues_update_own on public.venues;
create policy venues_update_own on public.venues
for update to authenticated
using (
  owner_id = auth.uid()
  and not is_default
)
with check (
  owner_id = auth.uid()
  and not is_default
);

drop policy venues_delete_own on public.venues;
create policy venues_delete_own on public.venues
for delete to authenticated
using (
  owner_id = auth.uid()
  and not is_default
);

notify pgrst, 'reload schema';

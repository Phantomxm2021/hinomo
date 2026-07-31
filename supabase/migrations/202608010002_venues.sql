create table public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index venues_owner_name_unique
on public.venues (owner_id, lower(btrim(name)));
create index venues_owner_id_idx on public.venues(owner_id);

create trigger venues_set_updated_at
before update on public.venues
for each row execute function public.set_updated_at();

alter table public.venues enable row level security;

create policy venues_select_own on public.venues
for select to authenticated
using (owner_id = auth.uid());

create policy venues_insert_own on public.venues
for insert to authenticated
with check (owner_id = auth.uid());

create policy venues_update_own on public.venues
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy venues_delete_own on public.venues
for delete to authenticated
using (owner_id = auth.uid());

grant select, insert, update, delete on table public.venues to authenticated;

insert into public.venues (owner_id, name)
select distinct spaces.owner_id, '家里'
from public.spaces as spaces
on conflict do nothing;

alter table public.spaces
add column venue_id uuid references public.venues(id) on delete restrict;

update public.spaces as spaces
set venue_id = venues.id
from public.venues as venues
where venues.owner_id = spaces.owner_id
  and lower(btrim(venues.name)) = lower('家里')
  and spaces.venue_id is null;

alter table public.spaces
alter column venue_id set not null;

create index spaces_venue_id_idx on public.spaces(venue_id);

drop policy spaces_insert_own on public.spaces;
create policy spaces_insert_own on public.spaces
for insert to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.venues
    where venues.id = spaces.venue_id
      and venues.owner_id = auth.uid()
  )
);

drop policy spaces_update_own on public.spaces;
create policy spaces_update_own on public.spaces
for update to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.venues
    where venues.id = spaces.venue_id
      and venues.owner_id = auth.uid()
  )
);

drop function public.search_my_items(text);
create function public.search_my_items(p_query text)
returns table (
  item_id uuid,
  item_name text,
  quantity integer,
  box_id uuid,
  box_public_id uuid,
  box_name text,
  venue_name text,
  space_name text,
  location text
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  with search_pattern as (
    select
      '%' ||
      pg_catalog.replace(
        pg_catalog.replace(
          pg_catalog.replace(
            pg_catalog.lower(pg_catalog.btrim(p_query)),
            E'\\',
            E'\\\\'
          ),
          '%',
          E'\\%'
        ),
        '_',
        E'\\_'
      ) ||
      '%' as value
    where nullif(pg_catalog.btrim(p_query), '') is not null
  )
  select
    items.id as item_id,
    items.name as item_name,
    items.quantity,
    boxes.id as box_id,
    boxes.public_id as box_public_id,
    boxes.name as box_name,
    venues.name as venue_name,
    spaces.name as space_name,
    boxes.location
  from public.items as items
  cross join search_pattern
  join public.boxes as boxes on boxes.id = items.box_id
  join public.spaces as spaces on spaces.id = boxes.space_id
  join public.venues as venues on venues.id = spaces.venue_id
  where boxes.owner_id = auth.uid()
    and pg_catalog.lower(coalesce(items.name, '') || ' ' || coalesce(items.category, '') || ' ' || coalesce(items.description, ''))
      ilike search_pattern.value escape E'\\'
  order by items.updated_at desc, items.name
  limit 100;
$$;

revoke all on function public.search_my_items(text) from public;
grant execute on function public.search_my_items(text) to authenticated;

drop function public.get_public_box(uuid);
create function public.get_public_box(p_public_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  public_id uuid,
  box_code text,
  space_id uuid,
  name text,
  category text,
  location text,
  description text,
  visibility public.box_visibility,
  cover_object_key text,
  updated_at timestamptz,
  venue_name text,
  space_name text,
  items jsonb
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    boxes.id,
    boxes.owner_id,
    boxes.public_id,
    boxes.box_code,
    boxes.space_id,
    boxes.name,
    boxes.category,
    boxes.location,
    boxes.description,
    boxes.visibility,
    boxes.cover_object_key,
    boxes.updated_at,
    venues.name as venue_name,
    spaces.name as space_name,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', items.id,
          'name', items.name,
          'category', items.category,
          'quantity', items.quantity,
          'description', items.description,
          'image_object_key', items.image_object_key
        ) order by items.created_at
      ) filter (where items.id is not null),
      '[]'::jsonb
    ) as items
  from public.boxes as boxes
  join public.spaces as spaces on spaces.id = boxes.space_id
  join public.venues as venues on venues.id = spaces.venue_id
  left join public.items as items on items.box_id = boxes.id
  where boxes.public_id = p_public_id
    and boxes.visibility = 'public'::public.box_visibility
  group by boxes.id, venues.name, spaces.name;
$$;

revoke all on function public.get_public_box(uuid) from public;
grant execute on function public.get_public_box(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

create table if not exists public.space_layouts (
  space_id uuid primary key references public.spaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  x_percent smallint not null check (x_percent between 0 and 80),
  y_percent smallint not null check (y_percent between 0 and 90),
  width_percent smallint not null check (width_percent between 20 and 60),
  height_percent smallint not null check (height_percent between 10 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint space_layouts_horizontal_bounds check (x_percent + width_percent <= 100),
  constraint space_layouts_vertical_bounds check (y_percent + height_percent <= 100)
);

drop trigger if exists space_layouts_set_updated_at on public.space_layouts;
create trigger space_layouts_set_updated_at
before update on public.space_layouts
for each row execute function public.set_updated_at();

alter table public.space_layouts enable row level security;

drop policy if exists space_layouts_select_own on public.space_layouts;
create policy space_layouts_select_own on public.space_layouts
for select to authenticated
using (owner_id = auth.uid());

drop policy if exists space_layouts_insert_own on public.space_layouts;
create policy space_layouts_insert_own on public.space_layouts
for insert to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.spaces
    where spaces.id = space_layouts.space_id
      and spaces.owner_id = auth.uid()
  )
);

drop policy if exists space_layouts_update_own on public.space_layouts;
create policy space_layouts_update_own on public.space_layouts
for update to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.spaces
    where spaces.id = space_layouts.space_id
      and spaces.owner_id = auth.uid()
  )
);

revoke all on table public.space_layouts from public, anon, authenticated;
grant select, insert, update on table public.space_layouts to authenticated;

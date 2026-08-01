create type public.item_movement_action as enum ('take_out', 'return', 'move');

alter table public.items
add column stored_quantity integer;

update public.items
set stored_quantity = quantity;

alter table public.items
alter column stored_quantity set not null;

alter table public.items
add constraint items_stored_quantity_check
check (stored_quantity between 0 and quantity);

create function public.preserve_item_outstanding_quantity()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  outstanding_quantity integer;
begin
  if tg_op = 'INSERT' then
    new.stored_quantity := new.quantity;
    return new;
  end if;

  if new.quantity is distinct from old.quantity then
    outstanding_quantity := old.quantity - old.stored_quantity;

    if new.quantity < outstanding_quantity then
      raise exception using
        errcode = '22023',
        message = 'item quantity cannot be lower than the quantity currently taken out';
    end if;

    new.stored_quantity := new.quantity - outstanding_quantity;
  end if;

  return new;
end;
$$;

create trigger items_preserve_outstanding_quantity
before insert or update of quantity on public.items
for each row execute function public.preserve_item_outstanding_quantity();

create table public.item_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action public.item_movement_action not null,
  quantity integer not null check (quantity > 0),
  from_box_id uuid references public.boxes(id) on delete set null,
  to_box_id uuid references public.boxes(id) on delete set null,
  handler_label text check (handler_label is null or char_length(btrim(handler_label)) between 1 and 120),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index item_movements_item_created_at_idx
on public.item_movements(item_id, created_at desc);

create index item_movements_actor_id_idx
on public.item_movements(actor_id);

create function public.validate_item_movement_shape()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if (new.action = 'take_out'::public.item_movement_action and (new.from_box_id is null or new.to_box_id is not null))
    or (new.action = 'return'::public.item_movement_action and (new.from_box_id is not null or new.to_box_id is null))
    or (new.action = 'move'::public.item_movement_action and (new.from_box_id is null or new.to_box_id is null or new.from_box_id = new.to_box_id)) then
    raise exception using errcode = '22023', message = 'invalid item movement source or destination';
  end if;

  return new;
end;
$$;

create trigger item_movements_validate_shape
before insert on public.item_movements
for each row execute function public.validate_item_movement_shape();

alter table public.item_movements enable row level security;

create policy item_movements_select_own
on public.item_movements
for select to authenticated
using (
  exists (
    select 1
    from public.items as items
    join public.boxes as boxes on boxes.id = items.box_id
    where items.id = item_id
      and boxes.owner_id = auth.uid()
  )
);

-- Confirmed upload rows reference both item and box. Keep that relationship valid
-- when an item with an image moves to another box.
alter table public.media_uploads
drop constraint media_uploads_item_box_fkey;

alter table public.media_uploads
add constraint media_uploads_item_box_fkey
foreign key (item_id, box_id)
references public.items(id, box_id)
on update cascade
on delete cascade;

create function public.take_out_item(
  p_item_id uuid,
  p_quantity integer,
  p_handler_label text default null,
  p_note text default null
)
returns table(item_id uuid, box_id uuid, quantity integer, stored_quantity integer)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  current_item public.items%rowtype;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  if p_quantity is null or p_quantity <= 0
    or (p_handler_label is not null and (char_length(btrim(p_handler_label)) not between 1 and 120))
    or (p_note is not null and char_length(p_note) > 500) then
    raise exception using errcode = '22023', message = 'invalid take out details';
  end if;

  select items.*
  into current_item
  from public.items as items
  join public.boxes as boxes on boxes.id = items.box_id
  where items.id = p_item_id
    and boxes.owner_id = caller
  for update of items;

  if not found then
    raise exception using errcode = '42501', message = 'item is not accessible';
  end if;

  if p_quantity > current_item.stored_quantity then
    raise exception using errcode = '22023', message = 'take out quantity exceeds stored quantity';
  end if;

  update public.items as items
  set stored_quantity = items.stored_quantity - p_quantity
  where items.id = current_item.id;

  insert into public.item_movements (
    item_id, actor_id, action, quantity, from_box_id, handler_label, note
  ) values (
    current_item.id,
    caller,
    'take_out'::public.item_movement_action,
    p_quantity,
    current_item.box_id,
    nullif(btrim(p_handler_label), ''),
    p_note
  );

  return query
  select items.id, items.box_id, items.quantity, items.stored_quantity
  from public.items as items
  where items.id = current_item.id;
end;
$$;

create function public.return_item(
  p_item_id uuid,
  p_quantity integer,
  p_note text default null
)
returns table(item_id uuid, box_id uuid, quantity integer, stored_quantity integer)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  current_item public.items%rowtype;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  if p_quantity is null or p_quantity <= 0
    or (p_note is not null and char_length(p_note) > 500) then
    raise exception using errcode = '22023', message = 'invalid return details';
  end if;

  select items.*
  into current_item
  from public.items as items
  join public.boxes as boxes on boxes.id = items.box_id
  where items.id = p_item_id
    and boxes.owner_id = caller
  for update of items;

  if not found then
    raise exception using errcode = '42501', message = 'item is not accessible';
  end if;

  if p_quantity > current_item.quantity - current_item.stored_quantity then
    raise exception using errcode = '22023', message = 'return quantity exceeds taken out quantity';
  end if;

  update public.items as items
  set stored_quantity = items.stored_quantity + p_quantity
  where items.id = current_item.id;

  insert into public.item_movements (
    item_id, actor_id, action, quantity, to_box_id, note
  ) values (
    current_item.id,
    caller,
    'return'::public.item_movement_action,
    p_quantity,
    current_item.box_id,
    p_note
  );

  return query
  select items.id, items.box_id, items.quantity, items.stored_quantity
  from public.items as items
  where items.id = current_item.id;
end;
$$;

create function public.move_item(
  p_item_id uuid,
  p_target_box_id uuid,
  p_note text default null
)
returns table(item_id uuid, box_id uuid, quantity integer, stored_quantity integer)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  current_item public.items%rowtype;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  if p_target_box_id is null
    or (p_note is not null and char_length(p_note) > 500) then
    raise exception using errcode = '22023', message = 'invalid move details';
  end if;

  select items.*
  into current_item
  from public.items as items
  join public.boxes as boxes on boxes.id = items.box_id
  where items.id = p_item_id
    and boxes.owner_id = caller
  for update of items;

  if not found then
    raise exception using errcode = '42501', message = 'item is not accessible';
  end if;

  if current_item.box_id = p_target_box_id then
    raise exception using errcode = '22023', message = 'item is already in the target box';
  end if;

  if current_item.stored_quantity <> current_item.quantity then
    raise exception using errcode = '22023', message = 'all item units must be returned before moving';
  end if;

  if not exists (
    select 1
    from public.boxes as boxes
    where boxes.id = p_target_box_id
      and boxes.owner_id = caller
  ) then
    raise exception using errcode = '42501', message = 'target box is not accessible';
  end if;

  update public.items as items
  set box_id = p_target_box_id
  where items.id = current_item.id;

  insert into public.item_movements (
    item_id, actor_id, action, quantity, from_box_id, to_box_id, note
  ) values (
    current_item.id,
    caller,
    'move'::public.item_movement_action,
    current_item.quantity,
    current_item.box_id,
    p_target_box_id,
    p_note
  );

  return query
  select items.id, items.box_id, items.quantity, items.stored_quantity
  from public.items as items
  where items.id = current_item.id;
end;
$$;

revoke all on table public.item_movements from public, anon, authenticated;
grant select on table public.item_movements to authenticated;

revoke insert (stored_quantity), update (box_id, stored_quantity)
on table public.items from public, anon, authenticated;

revoke all on function public.take_out_item(uuid, integer, text, text)
from public, anon, authenticated;
revoke all on function public.return_item(uuid, integer, text)
from public, anon, authenticated;
revoke all on function public.move_item(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function public.take_out_item(uuid, integer, text, text)
to authenticated;
grant execute on function public.return_item(uuid, integer, text)
to authenticated;
grant execute on function public.move_item(uuid, uuid, text)
to authenticated;

-- Shared venue content: members can collaborate on low-risk content while
-- ownership, destructive operations, and visibility remain owner-only.

drop policy if exists venues_select_accessible on public.venues;
create policy venues_select_accessible on public.venues
for select to authenticated using (public.can_access_venue(id));

drop policy if exists spaces_select_own on public.spaces;
drop policy if exists spaces_insert_own on public.spaces;
drop policy if exists spaces_update_own on public.spaces;
drop policy if exists spaces_delete_own on public.spaces;
create policy spaces_select_accessible on public.spaces
for select to authenticated using (public.can_access_venue(venue_id));
create policy spaces_insert_accessible on public.spaces
for insert to authenticated with check (public.can_edit_venue_content(venue_id));
create policy spaces_update_accessible on public.spaces
for update to authenticated
using (public.can_edit_venue_content(venue_id))
with check (public.can_edit_venue_content(venue_id));
create policy spaces_delete_owner on public.spaces
for delete to authenticated using (public.is_venue_owner(venue_id));

drop policy if exists space_layouts_select_own on public.space_layouts;
drop policy if exists space_layouts_insert_own on public.space_layouts;
drop policy if exists space_layouts_update_own on public.space_layouts;
create policy space_layouts_select_accessible on public.space_layouts
for select to authenticated using (
  exists (select 1 from public.spaces where spaces.id = space_layouts.space_id and public.can_access_venue(spaces.venue_id))
);
create policy space_layouts_insert_accessible on public.space_layouts
for insert to authenticated with check (
  exists (select 1 from public.spaces where spaces.id = space_layouts.space_id and public.can_edit_venue_content(spaces.venue_id))
);
create policy space_layouts_update_accessible on public.space_layouts
for update to authenticated
using (exists (select 1 from public.spaces where spaces.id = space_layouts.space_id and public.can_edit_venue_content(spaces.venue_id)))
with check (exists (select 1 from public.spaces where spaces.id = space_layouts.space_id and public.can_edit_venue_content(spaces.venue_id)));

drop policy if exists boxes_select_public_or_own on public.boxes;
drop policy if exists boxes_insert_own_space on public.boxes;
drop policy if exists boxes_update_own_space on public.boxes;
drop policy if exists boxes_delete_own on public.boxes;
create policy boxes_select_public on public.boxes
for select to anon, authenticated using (visibility = 'public'::public.box_visibility);
create policy boxes_select_accessible on public.boxes
for select to authenticated using (
  exists (select 1 from public.spaces where spaces.id = boxes.space_id and public.can_access_venue(spaces.venue_id))
);
create policy boxes_insert_accessible on public.boxes
for insert to authenticated with check (
  exists (select 1 from public.spaces where spaces.id = boxes.space_id and public.can_edit_venue_content(spaces.venue_id))
);
create policy boxes_update_accessible on public.boxes
for update to authenticated
using (exists (select 1 from public.spaces where spaces.id = boxes.space_id and public.can_edit_venue_content(spaces.venue_id)))
with check (exists (select 1 from public.spaces where spaces.id = boxes.space_id and public.can_edit_venue_content(spaces.venue_id)));
create policy boxes_delete_owner on public.boxes
for delete to authenticated using (
  exists (select 1 from public.spaces where spaces.id = boxes.space_id and public.is_venue_owner(spaces.venue_id))
);

drop policy if exists items_select_public_or_own_box on public.items;
drop policy if exists items_insert_own_box on public.items;
drop policy if exists items_update_own_box on public.items;
drop policy if exists items_delete_own_box on public.items;
create policy items_select_public on public.items
for select to anon, authenticated using (
  exists (select 1 from public.boxes where boxes.id = items.box_id and boxes.visibility = 'public'::public.box_visibility)
);
create policy items_select_accessible on public.items
for select to authenticated using (
  exists (
    select 1 from public.boxes join public.spaces on spaces.id = boxes.space_id
    where boxes.id = items.box_id and public.can_access_venue(spaces.venue_id)
  )
);
create policy items_insert_accessible on public.items
for insert to authenticated with check (
  exists (
    select 1 from public.boxes join public.spaces on spaces.id = boxes.space_id
    where boxes.id = items.box_id and public.can_edit_venue_content(spaces.venue_id)
  )
);
create policy items_update_accessible on public.items
for update to authenticated
using (exists (
  select 1 from public.boxes join public.spaces on spaces.id = boxes.space_id
  where boxes.id = items.box_id and public.can_edit_venue_content(spaces.venue_id)
))
with check (exists (
  select 1 from public.boxes join public.spaces on spaces.id = boxes.space_id
  where boxes.id = items.box_id and public.can_edit_venue_content(spaces.venue_id)
));
create policy items_delete_accessible on public.items
for delete to authenticated using (
  exists (
    select 1 from public.boxes join public.spaces on spaces.id = boxes.space_id
    where boxes.id = items.box_id and public.can_edit_venue_content(spaces.venue_id)
  )
);

-- Parent changes are workflow operations: keep ordinary item field edits
-- compatible, but force moves through move_item so availability and movement
-- history invariants cannot be bypassed by a direct REST PATCH.
revoke update (box_id) on table public.items from authenticated;

create function private.enforce_space_venue_owner()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_owner uuid;
begin
  select venues.owner_id into target_owner from public.venues where venues.id = new.venue_id;
  if target_owner is null then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;
  if tg_op = 'UPDATE' and new.venue_id is distinct from old.venue_id then
    if not public.is_venue_owner(old.venue_id) then
      raise exception using errcode = 'P0001', message = 'venue_owner_required';
    end if;
    if not public.is_venue_owner(new.venue_id) then
      raise exception using errcode = 'P0001', message = 'venue_access_denied';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id
    and not public.is_venue_owner(old.venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_owner_required';
  end if;
  new.owner_id := target_owner;
  return new;
end;
$$;

create function private.enforce_space_layout_owner()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_venue_id uuid;
  target_venue_id uuid;
  target_owner uuid;
begin
  select spaces.venue_id, venues.owner_id into target_venue_id, target_owner
  from public.spaces join public.venues on venues.id = spaces.venue_id
  where spaces.id = new.space_id;
  if target_owner is null or not public.can_edit_venue_content(target_venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;
  if tg_op = 'UPDATE' then
    select spaces.venue_id into old_venue_id from public.spaces where spaces.id = old.space_id;
    if new.space_id is distinct from old.space_id then
      if not public.is_venue_owner(old_venue_id) then
        raise exception using errcode = 'P0001', message = 'venue_owner_required';
      end if;
      if not public.is_venue_owner(target_venue_id) then
        raise exception using errcode = 'P0001', message = 'venue_access_denied';
      end if;
    end if;
    if new.owner_id is distinct from old.owner_id and not public.is_venue_owner(old_venue_id) then
      raise exception using errcode = 'P0001', message = 'venue_owner_required';
    end if;
  end if;
  new.owner_id := target_owner;
  return new;
end;
$$;

create function private.enforce_box_venue_owner()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_venue_id uuid;
  target_venue_id uuid;
  target_owner uuid;
begin
  select spaces.venue_id into target_venue_id from public.spaces where spaces.id = new.space_id;
  select venues.owner_id into target_owner from public.venues where venues.id = target_venue_id;
  if target_owner is null or not public.can_edit_venue_content(target_venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;
  if tg_op = 'UPDATE' then
    select spaces.venue_id into old_venue_id from public.spaces where spaces.id = old.space_id;
    if not public.is_venue_owner(old_venue_id) then
      if new.visibility is distinct from old.visibility or new.owner_id is distinct from old.owner_id then
        raise exception using errcode = 'P0001', message = 'venue_owner_required';
      end if;
      if target_venue_id is distinct from old_venue_id then
        raise exception using errcode = 'P0001', message = 'venue_access_denied';
      end if;
    elsif not public.is_venue_owner(target_venue_id) then
      raise exception using errcode = 'P0001', message = 'venue_access_denied';
    end if;
  end if;
  new.owner_id := target_owner;
  return new;
end;
$$;

create function private.enforce_item_target_box()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_venue_id uuid;
  target_venue_id uuid;
begin
  select spaces.venue_id into target_venue_id
  from public.boxes join public.spaces on spaces.id = boxes.space_id
  where boxes.id = new.box_id;
  if target_venue_id is null or not public.can_edit_venue_content(target_venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;
  if tg_op = 'UPDATE' and new.box_id is distinct from old.box_id then
    select spaces.venue_id into old_venue_id
    from public.boxes join public.spaces on spaces.id = boxes.space_id
    where boxes.id = old.box_id;
    if target_venue_id is distinct from old_venue_id
      and (not public.is_venue_owner(old_venue_id) or not public.is_venue_owner(target_venue_id)) then
      raise exception using errcode = 'P0001', message = 'venue_access_denied';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists spaces_enforce_venue_owner on public.spaces;
create trigger spaces_enforce_venue_owner
before insert or update on public.spaces
for each row execute function private.enforce_space_venue_owner();
drop trigger if exists space_layouts_enforce_venue_owner on public.space_layouts;
create trigger space_layouts_enforce_venue_owner
before insert or update on public.space_layouts
for each row execute function private.enforce_space_layout_owner();
drop trigger if exists boxes_enforce_venue_owner on public.boxes;
create trigger boxes_enforce_venue_owner
before insert or update on public.boxes
for each row execute function private.enforce_box_venue_owner();
drop trigger if exists items_enforce_target_box on public.items;
create trigger items_enforce_target_box
before insert or update on public.items
for each row execute function private.enforce_item_target_box();

create function public.create_space(p_venue_id uuid, p_name text, p_description text)
returns table(id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare venue_owner uuid;
begin
  select owner_id into venue_owner from public.venues where venues.id = p_venue_id;
  if venue_owner is null or not public.can_edit_venue_content(p_venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;
  return query insert into public.spaces as created_space (owner_id, venue_id, name, description)
  values (venue_owner, p_venue_id, p_name, p_description) returning created_space.id;
end;
$$;

create function public.update_space(p_space_id uuid, p_venue_id uuid, p_name text, p_description text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare current_venue_id uuid;
begin
  select venue_id into current_venue_id from public.spaces where id = p_space_id;
  if current_venue_id is null or not public.can_edit_venue_content(current_venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;
  if not public.is_venue_owner(current_venue_id) and p_venue_id is distinct from current_venue_id then
    raise exception using errcode = 'P0001', message = 'venue_owner_required';
  end if;
  if not public.is_venue_owner(p_venue_id) and p_venue_id is distinct from current_venue_id then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;
  update public.spaces set venue_id = p_venue_id, name = p_name, description = p_description where id = p_space_id;
end;
$$;

create function public.save_space_layout(
  p_space_id uuid, p_x_percent numeric, p_y_percent numeric, p_width_percent numeric, p_height_percent numeric
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare venue_owner uuid;
begin
  select venues.owner_id into venue_owner
  from public.spaces join public.venues on venues.id = spaces.venue_id
  where spaces.id = p_space_id and public.can_edit_venue_content(spaces.venue_id);
  if venue_owner is null then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;
  insert into public.space_layouts (space_id, owner_id, x_percent, y_percent, width_percent, height_percent)
  values (p_space_id, venue_owner, p_x_percent, p_y_percent, p_width_percent, p_height_percent)
  on conflict (space_id) do update set
    owner_id = excluded.owner_id,
    x_percent = excluded.x_percent,
    y_percent = excluded.y_percent,
    width_percent = excluded.width_percent,
    height_percent = excluded.height_percent;
end;
$$;

create function public.get_venue_box_plan_summary(p_venue_id uuid)
returns table (box_count integer, free_limit integer, unlimited_boxes boolean, can_create boolean)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare venue_owner uuid;
begin
  select owner_id into venue_owner from public.venues where id = p_venue_id;
  if venue_owner is null or not public.can_access_venue(p_venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;
  return query select
    (select count(*)::integer from public.boxes where owner_id = venue_owner),
    3::integer,
    exists (select 1 from public.account_entitlements where user_id = venue_owner and entitlement_code = 'boxes_unlimited_lifetime' and status = 'active'::public.account_entitlement_status),
    exists (select 1 from public.account_entitlements where user_id = venue_owner and entitlement_code = 'boxes_unlimited_lifetime' and status = 'active'::public.account_entitlement_status)
      or (select count(*) from public.boxes where owner_id = venue_owner) < 3;
end;
$$;

create function public.list_accessible_boxes(p_venue_id uuid default null)
returns table (
  id uuid, public_id uuid, box_code text, space_id uuid, venue_id uuid, name text, location text,
  visibility public.box_visibility, cover_object_key text, updated_at timestamptz, item_count integer, space_name text, venue_name text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select boxes.id, boxes.public_id, boxes.box_code, boxes.space_id, spaces.venue_id, boxes.name, boxes.location,
    boxes.visibility, boxes.cover_object_key, boxes.updated_at, count(items.id)::integer, spaces.name, venues.name
  from public.boxes
  join public.spaces on spaces.id = boxes.space_id
  join public.venues on venues.id = spaces.venue_id
  left join public.items on items.box_id = boxes.id
  where public.can_access_venue(spaces.venue_id)
    and (p_venue_id is null or spaces.venue_id = p_venue_id)
  group by boxes.id, spaces.venue_id, spaces.name, venues.name;
$$;

create or replace function public.create_box(
  p_space_id uuid, p_name text, p_category text, p_location text, p_description text, p_visibility public.box_visibility
)
returns table (id uuid, public_id uuid, box_code text, name text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare venue_owner uuid;
declare venue_id uuid;
declare has_unlimited_boxes boolean;
declare current_box_count integer;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  select spaces.venue_id, venues.owner_id into venue_id, venue_owner
  from public.spaces join public.venues on venues.id = spaces.venue_id where spaces.id = p_space_id;
  if venue_owner is null or not public.can_edit_venue_content(venue_id) then
    raise exception using errcode = '42501', message = 'space is not accessible';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(venue_owner::text, 0));
  select exists (select 1 from public.account_entitlements where user_id = venue_owner and entitlement_code = 'boxes_unlimited_lifetime' and status = 'active'::public.account_entitlement_status) into has_unlimited_boxes;
  if not has_unlimited_boxes then
    select count(*)::integer into current_box_count from public.boxes where owner_id = venue_owner;
    if current_box_count >= 3 then raise exception using errcode = 'P0001', message = 'box_limit_reached'; end if;
  end if;
  return query insert into public.boxes as created_box (owner_id, space_id, name, category, location, description, visibility)
  values (venue_owner, p_space_id, p_name, p_category, p_location, p_description, p_visibility)
  returning created_box.id, created_box.public_id, created_box.box_code, created_box.name;
end;
$$;

create function public.update_box(
  p_box_id uuid, p_space_id uuid, p_name text, p_category text, p_location text, p_description text, p_visibility public.box_visibility
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare old_venue_id uuid;
declare target_venue_id uuid;
begin
  select spaces.venue_id into old_venue_id from public.boxes join public.spaces on spaces.id = boxes.space_id where boxes.id = p_box_id;
  select spaces.venue_id into target_venue_id from public.spaces where spaces.id = p_space_id;
  if old_venue_id is null or target_venue_id is null or not public.can_edit_venue_content(old_venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;
  if not public.is_venue_owner(old_venue_id) then
    if target_venue_id is distinct from old_venue_id then raise exception using errcode = 'P0001', message = 'venue_access_denied'; end if;
    if p_visibility is distinct from (select visibility from public.boxes where id = p_box_id) then raise exception using errcode = 'P0001', message = 'venue_owner_required'; end if;
  elsif not public.is_venue_owner(target_venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;
  update public.boxes set space_id = p_space_id, name = p_name, category = p_category, location = p_location,
    description = p_description, visibility = p_visibility where id = p_box_id;
end;
$$;

create or replace function public.move_item(p_item_id uuid, p_target_box_id uuid, p_note text default null)
returns table(item_id uuid, box_id uuid, quantity integer, stored_quantity integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare current_item public.items%rowtype;
declare old_venue_id uuid;
declare target_venue_id uuid;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  if p_target_box_id is null or (p_note is not null and char_length(p_note) > 500) then raise exception using errcode = '22023', message = 'invalid move details'; end if;
  select items.* into current_item from public.items where items.id = p_item_id for update;
  if not found then raise exception using errcode = '42501', message = 'item is not accessible'; end if;
  select spaces.venue_id into old_venue_id from public.boxes join public.spaces on spaces.id = boxes.space_id where boxes.id = current_item.box_id;
  if not public.can_edit_venue_content(old_venue_id) then raise exception using errcode = '42501', message = 'item is not accessible'; end if;
  select spaces.venue_id into target_venue_id from public.boxes join public.spaces on spaces.id = boxes.space_id where boxes.id = p_target_box_id;
  if target_venue_id is null or not public.can_edit_venue_content(target_venue_id) then raise exception using errcode = '42501', message = 'target box is not accessible'; end if;
  if current_item.box_id = p_target_box_id then raise exception using errcode = '22023', message = 'item is already in the target box'; end if;
  if current_item.stored_quantity <> current_item.quantity then raise exception using errcode = '22023', message = 'all item units must be returned before moving'; end if;
  if not public.is_venue_owner(old_venue_id) and target_venue_id is distinct from old_venue_id then raise exception using errcode = 'P0001', message = 'venue_access_denied'; end if;
  update public.items set box_id = p_target_box_id where id = current_item.id;
  insert into public.item_movements (item_id, actor_id, action, quantity, from_box_id, to_box_id, note)
  values (current_item.id, auth.uid(), 'move'::public.item_movement_action, current_item.quantity, current_item.box_id, p_target_box_id, p_note);
  return query select items.id, items.box_id, items.quantity, items.stored_quantity from public.items where items.id = current_item.id;
end;
$$;

revoke all on function public.create_space(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.update_space(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.save_space_layout(uuid, numeric, numeric, numeric, numeric) from public, anon, authenticated, service_role;
revoke all on function public.get_venue_box_plan_summary(uuid) from public, anon, authenticated, service_role;
revoke all on function public.list_accessible_boxes(uuid) from public, anon, authenticated, service_role;
revoke all on function public.create_box(uuid, text, text, text, text, public.box_visibility) from public, anon, authenticated, service_role;
revoke all on function public.update_box(uuid, uuid, text, text, text, text, public.box_visibility) from public, anon, authenticated, service_role;
revoke all on function public.move_item(uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.create_space(uuid, text, text) to authenticated;
grant execute on function public.update_space(uuid, uuid, text, text) to authenticated;
grant execute on function public.save_space_layout(uuid, numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.get_venue_box_plan_summary(uuid) to authenticated;
grant execute on function public.list_accessible_boxes(uuid) to authenticated;
grant execute on function public.create_box(uuid, text, text, text, text, public.box_visibility) to authenticated;
grant execute on function public.update_box(uuid, uuid, text, text, text, text, public.box_visibility) to authenticated;
grant execute on function public.move_item(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';

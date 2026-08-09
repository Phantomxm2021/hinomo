-- Venue membership extends the existing workflows without changing their RPC contracts.

create or replace function public.search_my_items(p_query text)
returns table (
  item_id uuid,
  item_name text,
  quantity integer,
  stored_quantity integer,
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
set search_path = pg_catalog, public
as $$
  with search_pattern as (
    select '%' ||
      pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
        pg_catalog.lower(pg_catalog.btrim(p_query)), E'\\', E'\\\\'
      ), '%', E'\\%'), '_', E'\\_') || '%' as value
    where nullif(pg_catalog.btrim(p_query), '') is not null
  )
  select
    items.id, items.name, items.quantity, items.stored_quantity,
    boxes.id, boxes.public_id, boxes.name, venues.name, spaces.name, boxes.location
  from public.items as items
  cross join search_pattern
  join public.boxes as boxes on boxes.id = items.box_id
  join public.spaces as spaces on spaces.id = boxes.space_id
  join public.venues as venues on venues.id = spaces.venue_id
  where public.can_access_venue(spaces.venue_id)
    and pg_catalog.lower(coalesce(items.name, '') || ' ' || coalesce(items.category, '') || ' ' || coalesce(items.description, ''))
      ilike search_pattern.value escape E'\\'
  order by items.updated_at desc, items.name
  limit 100;
$$;

create or replace function public.search_my_inventory(p_query text)
returns table (
  result_id uuid,
  source text,
  item_name text,
  quantity integer,
  quantity_kind text,
  stored_quantity integer,
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
set search_path = pg_catalog, public
as $$
  with search_pattern as (
    select '%' ||
      pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
        pg_catalog.lower(pg_catalog.btrim(p_query)), E'\\', E'\\\\'
      ), '%', E'\\%'), '_', E'\\_') || '%' as value
    where nullif(pg_catalog.btrim(p_query), '') is not null
  ), results as (
    select
      items.id as result_id,
      'formal'::text as source,
      items.name as item_name,
      items.quantity,
      'exact'::text as quantity_kind,
      items.stored_quantity,
      boxes.id as box_id,
      boxes.public_id as box_public_id,
      boxes.name as box_name,
      venues.name as venue_name,
      spaces.name as space_name,
      boxes.location,
      1 as source_rank,
      items.updated_at
    from public.items as items
    cross join search_pattern
    join public.boxes as boxes on boxes.id = items.box_id
    join public.spaces as spaces on spaces.id = boxes.space_id
    join public.venues as venues on venues.id = spaces.venue_id
    where public.can_access_venue(spaces.venue_id)
      and pg_catalog.lower(coalesce(items.name, '') || ' ' || coalesce(items.category, '') || ' ' || coalesce(items.description, ''))
        ilike search_pattern.value escape E'\\'

    union all

    select
      detected.id,
      'ai'::text,
      detected.name,
      detected.quantity_value,
      detected.quantity_kind::text,
      null::integer,
      boxes.id,
      boxes.public_id,
      boxes.name,
      venues.name,
      spaces.name,
      boxes.location,
      case when detected.review_status in ('confirmed', 'corrected') then 2 else 3 end,
      detected.updated_at
    from public.packing_detected_items as detected
    cross join search_pattern
    join public.packing_sessions as sessions
      on sessions.id = detected.session_id and sessions.current_revision = detected.analysis_revision
    join public.boxes as boxes on boxes.id = detected.box_id
    join public.spaces as spaces on spaces.id = boxes.space_id
    join public.venues as venues on venues.id = spaces.venue_id
    where public.can_access_venue(spaces.venue_id)
      and detected.published_at is not null
      and detected.review_status not in ('dismissed', 'promoted')
      and pg_catalog.lower(coalesce(detected.name, '') || ' ' || coalesce(detected.category, '') || ' ' || coalesce(detected.description, ''))
        ilike search_pattern.value escape E'\\'
  )
  select result_id, source, item_name, quantity, quantity_kind, stored_quantity,
    box_id, box_public_id, box_name, venue_name, space_name, location
  from results
  order by source_rank, updated_at desc, item_name
  limit 100;
$$;

drop policy if exists item_movements_select_own on public.item_movements;
create policy item_movements_select_accessible
on public.item_movements
for select to authenticated
using (
  exists (
    select 1
    from public.items as items
    join public.boxes as boxes on boxes.id = items.box_id
    join public.spaces as spaces on spaces.id = boxes.space_id
    where items.id = item_movements.item_id
      and public.can_access_venue(spaces.venue_id)
  )
);

create or replace function public.take_out_item(
  p_item_id uuid,
  p_quantity integer,
  p_handler_label text default null,
  p_note text default null
)
returns table(item_id uuid, box_id uuid, quantity integer, stored_quantity integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  current_item public.items%rowtype;
  source_venue_id uuid;
begin
  if caller is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  if p_quantity is null or p_quantity <= 0
    or (p_handler_label is not null and (char_length(btrim(p_handler_label)) not between 1 and 120))
    or (p_note is not null and char_length(p_note) > 500) then
    raise exception using errcode = '22023', message = 'invalid take out details';
  end if;

  select items, spaces.venue_id into current_item, source_venue_id
  from public.items as items
  join public.boxes as boxes on boxes.id = items.box_id
  join public.spaces as spaces on spaces.id = boxes.space_id
  where items.id = p_item_id
  for update of items;
  if not found or not public.can_edit_venue_content(source_venue_id) then
    raise exception using errcode = '42501', message = 'item is not accessible';
  end if;
  if p_quantity > current_item.stored_quantity then
    raise exception using errcode = '22023', message = 'take out quantity exceeds stored quantity';
  end if;

  update public.items as items set stored_quantity = items.stored_quantity - p_quantity where items.id = current_item.id;
  insert into public.item_movements (item_id, actor_id, action, quantity, from_box_id, handler_label, note)
  values (current_item.id, caller, 'take_out'::public.item_movement_action, p_quantity, current_item.box_id,
    nullif(btrim(p_handler_label), ''), p_note);
  return query select items.id, items.box_id, items.quantity, items.stored_quantity from public.items as items where items.id = current_item.id;
end;
$$;

create or replace function public.return_item(
  p_item_id uuid,
  p_quantity integer,
  p_note text default null
)
returns table(item_id uuid, box_id uuid, quantity integer, stored_quantity integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  current_item public.items%rowtype;
  source_venue_id uuid;
begin
  if caller is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  if p_quantity is null or p_quantity <= 0 or (p_note is not null and char_length(p_note) > 500) then
    raise exception using errcode = '22023', message = 'invalid return details';
  end if;

  select items, spaces.venue_id into current_item, source_venue_id
  from public.items as items
  join public.boxes as boxes on boxes.id = items.box_id
  join public.spaces as spaces on spaces.id = boxes.space_id
  where items.id = p_item_id
  for update of items;
  if not found or not public.can_edit_venue_content(source_venue_id) then
    raise exception using errcode = '42501', message = 'item is not accessible';
  end if;
  if p_quantity > current_item.quantity - current_item.stored_quantity then
    raise exception using errcode = '22023', message = 'return quantity exceeds taken out quantity';
  end if;

  update public.items as items set stored_quantity = items.stored_quantity + p_quantity where items.id = current_item.id;
  insert into public.item_movements (item_id, actor_id, action, quantity, to_box_id, note)
  values (current_item.id, caller, 'return'::public.item_movement_action, p_quantity, current_item.box_id, p_note);
  return query select items.id, items.box_id, items.quantity, items.stored_quantity from public.items as items where items.id = current_item.id;
end;
$$;

create or replace function public.move_item(p_item_id uuid, p_target_box_id uuid, p_note text default null)
returns table(item_id uuid, box_id uuid, quantity integer, stored_quantity integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_item public.items%rowtype;
  source_venue_id uuid;
  target_venue_id uuid;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  if p_target_box_id is null or (p_note is not null and char_length(p_note) > 500) then
    raise exception using errcode = '22023', message = 'invalid move details';
  end if;

  select items, spaces.venue_id into current_item, source_venue_id
  from public.items as items
  join public.boxes as boxes on boxes.id = items.box_id
  join public.spaces as spaces on spaces.id = boxes.space_id
  where items.id = p_item_id
  for update of items;
  if not found or not public.can_edit_venue_content(source_venue_id) then
    raise exception using errcode = '42501', message = 'item is not accessible';
  end if;
  select spaces.venue_id into target_venue_id
  from public.boxes as boxes join public.spaces as spaces on spaces.id = boxes.space_id
  where boxes.id = p_target_box_id;
  if target_venue_id is null or not public.can_edit_venue_content(target_venue_id) then
    raise exception using errcode = '42501', message = 'target box is not accessible';
  end if;
  if not public.is_venue_owner(source_venue_id)
    and source_venue_id is distinct from target_venue_id then
    raise exception using errcode = '42501', message = 'venue_access_denied';
  end if;
  if public.is_venue_owner(source_venue_id)
    and source_venue_id is distinct from target_venue_id
    and not public.is_venue_owner(target_venue_id) then
    raise exception using errcode = '42501', message = 'venue_access_denied';
  end if;
  if current_item.box_id = p_target_box_id then raise exception using errcode = '22023', message = 'item is already in the target box'; end if;
  if current_item.stored_quantity <> current_item.quantity then raise exception using errcode = '22023', message = 'all item units must be returned before moving'; end if;

  update public.items as items set box_id = p_target_box_id where items.id = current_item.id;
  insert into public.item_movements (item_id, actor_id, action, quantity, from_box_id, to_box_id, note)
  values (current_item.id, auth.uid(), 'move'::public.item_movement_action, current_item.quantity, current_item.box_id, p_target_box_id, p_note);
  return query select items.id, items.box_id, items.quantity, items.stored_quantity from public.items as items where items.id = current_item.id;
end;
$$;

create or replace function public.create_media_upload(
  p_box_id uuid, p_item_id uuid, p_media_kind public.media_kind, p_mime_type text, p_size_bytes bigint
)
returns table(upload_id uuid, object_key text, upload_url text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  canonical_owner_id uuid;
  venue_id uuid;
  new_upload_id uuid := extensions.gen_random_uuid();
  file_extension text;
  new_object_key text;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  if p_media_kind is null or p_mime_type is null or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_size_bytes is null or p_size_bytes not between 1 and 5242880 then
    raise exception using errcode = '22023', message = 'invalid media metadata';
  end if;
  select venues.owner_id, spaces.venue_id into canonical_owner_id, venue_id
  from public.boxes as boxes
  join public.spaces as spaces on spaces.id = boxes.space_id
  join public.venues as venues on venues.id = spaces.venue_id
  where boxes.id = p_box_id;
  if canonical_owner_id is null or not public.can_edit_venue_content(venue_id) then
    raise exception using errcode = '42501', message = 'media target is not accessible';
  end if;
  if (p_media_kind = 'cover'::public.media_kind and p_item_id is not null)
    or (p_media_kind = 'item'::public.media_kind and p_item_id is null)
    or (p_media_kind = 'item'::public.media_kind and not exists (
      select 1 from public.items as items where items.id = p_item_id and items.box_id = p_box_id
    )) then
    raise exception using errcode = '22023', message = 'invalid media target';
  end if;
  file_extension := case p_mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' end;
  new_object_key := 'users/' || canonical_owner_id || '/boxes/' || p_box_id || '/'
    || case when p_media_kind = 'cover'::public.media_kind then 'cover/' else 'items/' || p_item_id || '/' end
    || extensions.gen_random_uuid() || '.' || file_extension;
  insert into public.media_uploads (id, owner_id, box_id, item_id, media_kind, object_key, mime_type, size_bytes, status, expires_at)
  values (new_upload_id, canonical_owner_id, p_box_id, p_item_id, p_media_kind, new_object_key, p_mime_type, p_size_bytes,
    'pending'::public.media_upload_status, pg_catalog.now() + interval '5 minutes');
  return query select new_upload_id, new_object_key, private.r2_presign_from_vault('PUT', new_object_key, p_mime_type, 300);
end;
$$;

create or replace function public.confirm_media_upload(p_upload_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  upload_session public.media_uploads%rowtype;
  venue_id uuid;
  rows_updated integer;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  select * into upload_session from public.media_uploads as media_uploads where media_uploads.id = p_upload_id for update;
  select spaces.venue_id into venue_id from public.boxes as boxes join public.spaces as spaces on spaces.id = boxes.space_id
  where boxes.id = upload_session.box_id;
  if not found or venue_id is null or not public.can_edit_venue_content(venue_id) then
    raise exception using errcode = '42501', message = 'media upload is not accessible';
  end if;
  if upload_session.status <> 'pending'::public.media_upload_status or upload_session.expires_at <= pg_catalog.now() then
    raise exception using errcode = '22023', message = 'media upload is no longer confirmable';
  end if;
  if upload_session.media_kind = 'cover'::public.media_kind then
    update public.boxes set cover_object_key = upload_session.object_key, cover_mime_type = upload_session.mime_type,
      cover_size_bytes = upload_session.size_bytes where id = upload_session.box_id;
  else
    update public.items set image_object_key = upload_session.object_key, image_mime_type = upload_session.mime_type,
      image_size_bytes = upload_session.size_bytes where id = upload_session.item_id and box_id = upload_session.box_id;
  end if;
  get diagnostics rows_updated = row_count;
  if rows_updated <> 1 then raise exception using errcode = '42501', message = 'media upload is not accessible'; end if;
  update public.media_uploads set status = 'confirmed'::public.media_upload_status, confirmed_at = pg_catalog.now()
  where id = upload_session.id and status = 'pending'::public.media_upload_status;
  get diagnostics rows_updated = row_count;
  if rows_updated <> 1 then raise exception using errcode = '22023', message = 'media upload is no longer confirmable'; end if;
end;
$$;

create or replace function public.create_media_download(p_object_key text)
returns table(download_url text, expires_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare signed_expires_at timestamptz := pg_catalog.now() + interval '5 minutes';
begin
  if not exists (
    select 1 from public.boxes as boxes
    join public.spaces as spaces on spaces.id = boxes.space_id
    where boxes.cover_object_key = p_object_key
      and (boxes.visibility = 'public'::public.box_visibility or public.can_access_venue(spaces.venue_id))
    union all
    select 1 from public.items as items
    join public.boxes as boxes on boxes.id = items.box_id
    join public.spaces as spaces on spaces.id = boxes.space_id
    where items.image_object_key = p_object_key
      and (boxes.visibility = 'public'::public.box_visibility or public.can_access_venue(spaces.venue_id))
  ) then
    raise exception using errcode = '42501', message = 'media object is not accessible';
  end if;
  return query select private.r2_presign_from_vault('GET', p_object_key, null, 300), signed_expires_at;
end;
$$;

revoke all on function public.search_my_items(text) from public;
revoke all on function public.search_my_inventory(text) from public, anon;
revoke all on function public.take_out_item(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.return_item(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.move_item(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.create_media_upload(uuid, uuid, public.media_kind, text, bigint) from public, anon, authenticated;
revoke all on function public.confirm_media_upload(uuid) from public, anon, authenticated;
revoke all on function public.create_media_download(text) from public, anon, authenticated;
grant execute on function public.search_my_items(text), public.search_my_inventory(text),
  public.take_out_item(uuid, integer, text, text), public.return_item(uuid, integer, text), public.move_item(uuid, uuid, text),
  public.create_media_upload(uuid, uuid, public.media_kind, text, bigint), public.confirm_media_upload(uuid) to authenticated;
grant execute on function public.create_media_download(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- Product activity is intentionally separate from the older generic audit stream.
-- Generic rows remain for diagnostics; only rows with an event_code appear in the venue feed.

create type public.venue_activity_event as enum (
  'item_created', 'item_moved', 'item_quantity_changed', 'item_deleted', 'box_moved'
);

alter table public.activity_logs
  add column venue_id uuid references public.venues(id) on delete set null,
  add column event_code public.venue_activity_event;

create index activity_logs_venue_feed_idx
on public.activity_logs(venue_id, created_at desc, id desc)
where event_code is not null;

-- Historical audit rows have no product event semantics. Recover a venue only
-- when the current box relationship makes it unambiguous; do not infer an event.
update public.activity_logs as logs
set venue_id = spaces.venue_id
from public.boxes as boxes
join public.spaces as spaces on spaces.id = boxes.space_id
where logs.venue_id is null
  and logs.box_id = boxes.id;

-- Product activity rows have no legacy box-owner fallback: current venue
-- access is the privacy boundary, including after a member leaves.
drop policy if exists activity_logs_select_actor_or_box_owner on public.activity_logs;
create policy activity_logs_select_legacy_or_venue_access
on public.activity_logs
for select to authenticated
using (
  (event_code is not null and venue_id is not null and public.can_access_venue(venue_id))
  or
  (event_code is null and (
    actor_id = auth.uid()
    or exists (
      select 1
      from public.boxes as boxes
      where boxes.id = box_id
        and boxes.owner_id = auth.uid()
    )
  ))
);

create function private.write_venue_activity(
  p_venue_id uuid,
  p_actor_id uuid,
  p_event_code public.venue_activity_event,
  p_entity_type public.audit_entity,
  p_entity_id uuid,
  p_snapshot jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_name text;
  allowed_keys text[] := array['entity_name', 'from', 'to', 'quantity_before', 'quantity_after', 'direction'];
begin
  -- A service request without an explicit human actor must not impersonate one.
  if p_venue_id is null or p_actor_id is null or p_event_code is null
    or p_entity_type is null or p_entity_id is null then
    return;
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object'
    or exists (select 1 from jsonb_object_keys(p_snapshot) as keys(key) where key <> all(allowed_keys)) then
    raise exception using errcode = '22023', message = 'invalid venue activity snapshot';
  end if;

  select profiles.display_name into actor_name
  from public.profiles where profiles.id = p_actor_id;

  insert into public.activity_logs (actor_id, venue_id, action, entity_type, entity_id, event_code, snapshot)
  values (
    p_actor_id,
    p_venue_id,
    case when p_event_code in ('item_created'::public.venue_activity_event)
      then 'create'::public.audit_action
      when p_event_code in ('item_deleted'::public.venue_activity_event)
      then 'delete'::public.audit_action
      else 'update'::public.audit_action end,
    p_entity_type,
    p_entity_id,
    p_event_code,
    jsonb_strip_nulls(p_snapshot || jsonb_build_object('actor_display_name', actor_name))
  );
end;
$$;

create function private.write_item_venue_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  source_venue_id uuid;
  target_venue_id uuid;
  source_box_name text;
  target_box_name text;
begin
  if actor_id is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    select spaces.venue_id into target_venue_id
    from public.boxes join public.spaces on spaces.id = boxes.space_id
    where boxes.id = new.box_id;
    perform private.write_venue_activity(target_venue_id, actor_id, 'item_created', 'item', new.id,
      jsonb_build_object('entity_name', new.name));
  elsif tg_op = 'DELETE' then
    select spaces.venue_id into source_venue_id
    from public.boxes join public.spaces on spaces.id = boxes.space_id
    where boxes.id = old.box_id;
    perform private.write_venue_activity(source_venue_id, actor_id, 'item_deleted', 'item', old.id,
      jsonb_build_object('entity_name', old.name));
  else
    if new.box_id is distinct from old.box_id then
      select spaces.venue_id, boxes.name into source_venue_id, source_box_name
      from public.boxes join public.spaces on spaces.id = boxes.space_id where boxes.id = old.box_id;
      select spaces.venue_id, boxes.name into target_venue_id, target_box_name
      from public.boxes join public.spaces on spaces.id = boxes.space_id where boxes.id = new.box_id;
      if source_venue_id = target_venue_id then
        perform private.write_venue_activity(source_venue_id, actor_id, 'item_moved', 'item', new.id,
          jsonb_build_object('entity_name', new.name, 'from', jsonb_build_object('id', old.box_id, 'name', source_box_name),
            'to', jsonb_build_object('id', new.box_id, 'name', target_box_name), 'direction', 'within'));
      else
        perform private.write_venue_activity(source_venue_id, actor_id, 'item_moved', 'item', new.id,
          jsonb_build_object('entity_name', new.name, 'from', jsonb_build_object('id', old.box_id, 'name', source_box_name), 'direction', 'out'));
        perform private.write_venue_activity(target_venue_id, actor_id, 'item_moved', 'item', new.id,
          jsonb_build_object('entity_name', new.name, 'to', jsonb_build_object('id', new.box_id, 'name', target_box_name), 'direction', 'in'));
      end if;
    end if;
    if new.quantity is distinct from old.quantity then
      select spaces.venue_id into target_venue_id
      from public.boxes join public.spaces on spaces.id = boxes.space_id where boxes.id = new.box_id;
      perform private.write_venue_activity(target_venue_id, actor_id, 'item_quantity_changed', 'item', new.id,
        jsonb_build_object('entity_name', new.name, 'quantity_before', old.quantity, 'quantity_after', new.quantity));
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create function private.write_box_venue_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  source_venue_id uuid;
  target_venue_id uuid;
  source_space_name text;
  target_space_name text;
begin
  if actor_id is null or new.space_id is not distinct from old.space_id then
    return new;
  end if;
  select venue_id, name into source_venue_id, source_space_name from public.spaces where id = old.space_id;
  select venue_id, name into target_venue_id, target_space_name from public.spaces where id = new.space_id;
  if source_venue_id = target_venue_id then
    perform private.write_venue_activity(source_venue_id, actor_id, 'box_moved', 'box', new.id,
      jsonb_build_object('entity_name', new.name, 'from', jsonb_build_object('id', old.space_id, 'name', source_space_name),
        'to', jsonb_build_object('id', new.space_id, 'name', target_space_name), 'direction', 'within'));
  else
    perform private.write_venue_activity(source_venue_id, actor_id, 'box_moved', 'box', new.id,
      jsonb_build_object('entity_name', new.name, 'from', jsonb_build_object('id', old.space_id, 'name', source_space_name), 'direction', 'out'));
    perform private.write_venue_activity(target_venue_id, actor_id, 'box_moved', 'box', new.id,
      jsonb_build_object('entity_name', new.name, 'to', jsonb_build_object('id', new.space_id, 'name', target_space_name), 'direction', 'in'));
  end if;
  return new;
end;
$$;

create trigger items_write_venue_activity
after insert or update or delete on public.items
for each row execute function private.write_item_venue_activity();

create trigger boxes_write_venue_activity
after update of space_id on public.boxes
for each row execute function private.write_box_venue_activity();

create or replace function public.finalize_packing_item_promotion(
  p_promotion_id uuid,
  p_mime_type text,
  p_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  promotion public.packing_item_promotions%rowtype;
  detected public.packing_detected_items%rowtype;
  target_venue_id uuid;
begin
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_size_bytes is null or p_size_bytes <= 0 then
    raise exception using errcode = '22023', message = 'invalid promoted media metadata';
  end if;
  select * into promotion from public.packing_item_promotions promotions where promotions.id = p_promotion_id for update;
  if not found then raise exception using errcode = '22023', message = 'packing promotion does not exist'; end if;
  if promotion.status = 'completed'::public.packing_promotion_status then return promotion.target_item_id; end if;
  select * into detected from public.packing_detected_items items where items.id = promotion.detected_item_id for update;
  if not found or detected.quantity_kind <> 'exact'::public.packing_quantity_kind or detected.quantity_value is null then
    raise exception using errcode = '22023', message = 'detected item can no longer be promoted';
  end if;
  insert into public.items (id, box_id, name, category, quantity, description, image_object_key, image_mime_type, image_size_bytes)
  values (promotion.target_item_id, detected.box_id, detected.name, detected.category, detected.quantity_value, detected.description,
    promotion.target_object_key, p_mime_type, p_size_bytes)
  on conflict (id) do nothing;
  -- The item trigger deliberately skips service-role work (no auth.uid()). The
  -- promotion request stores the human requester, so use it explicitly here.
  if found then
    select spaces.venue_id into target_venue_id
    from public.boxes join public.spaces on spaces.id = boxes.space_id where boxes.id = detected.box_id;
    perform private.write_venue_activity(target_venue_id, promotion.requested_by, 'item_created', 'item', promotion.target_item_id,
      jsonb_build_object('entity_name', detected.name));
  end if;
  update public.packing_detected_items set review_status = 'promoted'::public.packing_review_status where id = detected.id;
  update public.packing_item_promotions set status = 'completed'::public.packing_promotion_status,
    completed_at = pg_catalog.now(), last_error_code = null where id = promotion.id;
  return promotion.target_item_id;
end;
$$;

create function public.list_venue_activity(
  p_venue_id uuid,
  p_actor_id uuid default null,
  p_event_code public.venue_activity_event default null,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  actor_id uuid,
  actor_display_name text,
  actor_is_current boolean,
  event_code public.venue_activity_event,
  entity_type public.audit_entity,
  entity_id uuid,
  snapshot jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.can_access_venue(p_venue_id) then
    raise exception using errcode = '42501', message = 'venue_access_denied';
  end if;
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception using errcode = '22023', message = 'invalid venue activity limit';
  end if;
  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception using errcode = '22023', message = 'invalid venue activity cursor';
  end if;
  return query
  select logs.id, logs.actor_id, logs.snapshot->>'actor_display_name',
    coalesce(logs.actor_id = venues.owner_id or exists (
      select 1 from public.venue_members as members
      where members.venue_id = logs.venue_id and members.user_id = logs.actor_id
    ), false),
    logs.event_code, logs.entity_type, logs.entity_id, logs.snapshot, logs.created_at
  from public.activity_logs as logs
  join public.venues as venues on venues.id = logs.venue_id
  where logs.venue_id = p_venue_id
    and logs.event_code is not null
    and (p_actor_id is null or logs.actor_id = p_actor_id)
    and (p_event_code is null or logs.event_code = p_event_code)
    and (p_before_created_at is null or (logs.created_at, logs.id) < (p_before_created_at, p_before_id))
  order by logs.created_at desc, logs.id desc
  limit p_limit;
end;
$$;

revoke all on function private.write_venue_activity(uuid, uuid, public.venue_activity_event, public.audit_entity, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.write_item_venue_activity() from public, anon, authenticated, service_role;
revoke all on function private.write_box_venue_activity() from public, anon, authenticated, service_role;
revoke all on function public.list_venue_activity(uuid, uuid, public.venue_activity_event, timestamptz, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.list_venue_activity(uuid, uuid, public.venue_activity_event, timestamptz, uuid, integer) to authenticated;

notify pgrst, 'reload schema';

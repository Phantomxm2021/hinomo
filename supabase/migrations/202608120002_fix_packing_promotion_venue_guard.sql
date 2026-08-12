-- The promotion finalizer is a service-owned workflow, but public.items also
-- has a user-facing venue trigger which reads auth.uid(). During a
-- SECURITY DEFINER finalization there is no user JWT, so that trigger raises
-- venue_access_denied (P0001) even though the promotion was requested by an
-- authorized owner. Scope the bypass to the exact target item of the locked
-- promotion and keep ordinary item writes unchanged.

create or replace function private.enforce_item_target_box()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_venue_id uuid;
  target_venue_id uuid;
begin
  if pg_catalog.current_setting('nomo.packing_promotion_item_id', true) = new.id::text then
    return new;
  end if;

  select spaces.venue_id into target_venue_id
  from public.boxes
  join public.spaces on spaces.id = boxes.space_id
  where boxes.id = new.box_id;
  if target_venue_id is null or not public.can_edit_venue_content(target_venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;
  if tg_op = 'UPDATE' and new.box_id is distinct from old.box_id then
    select spaces.venue_id into old_venue_id
    from public.boxes
    join public.spaces on spaces.id = boxes.space_id
    where boxes.id = old.box_id;
    if target_venue_id is distinct from old_venue_id
      and (not public.is_venue_owner(old_venue_id) or not public.is_venue_owner(target_venue_id)) then
      raise exception using errcode = 'P0001', message = 'venue_access_denied';
    end if;
  end if;
  return new;
end;
$$;

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
  existing_item boolean;
begin
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_size_bytes is null or p_size_bytes <= 0 then
    raise exception using errcode = '22023', message = 'invalid promoted media metadata';
  end if;

  select * into promotion
  from public.packing_item_promotions promotions
  where promotions.id = p_promotion_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'packing promotion does not exist';
  end if;
  if promotion.status = 'completed'::public.packing_promotion_status then
    return promotion.target_item_id;
  end if;

  -- The trigger guard is scoped to this exact target id and transaction.
  perform pg_catalog.set_config(
    'nomo.packing_promotion_item_id',
    promotion.target_item_id::text,
    true
  );

  select * into detected
  from public.packing_detected_items items
  where items.id = promotion.detected_item_id
  for update;
  if not found or detected.quantity_kind <> 'exact'::public.packing_quantity_kind
    or detected.quantity_value is null then
    raise exception using errcode = '22023', message = 'detected item can no longer be promoted';
  end if;

  select true into existing_item
  from public.items
  where id = promotion.target_item_id
  for update;

  if coalesce(existing_item, false) then
    update public.items
    set search_aliases = private.merge_search_aliases(search_aliases, detected.search_aliases)
    where id = promotion.target_item_id;
  else
    insert into public.items (
      id, box_id, name, category, quantity, description,
      image_object_key, image_mime_type, image_size_bytes, search_aliases
    ) values (
      promotion.target_item_id, detected.box_id, detected.name, detected.category,
      detected.quantity_value, detected.description,
      promotion.target_object_key, p_mime_type, p_size_bytes, detected.search_aliases
    );

    select spaces.venue_id into target_venue_id
    from public.boxes
    join public.spaces on spaces.id = boxes.space_id
    where boxes.id = detected.box_id;
    perform private.write_venue_activity(
      target_venue_id, promotion.requested_by, 'item_created', 'item',
      promotion.target_item_id, jsonb_build_object('entity_name', detected.name)
    );
  end if;

  update public.packing_detected_items
  set review_status = 'promoted'::public.packing_review_status
  where id = detected.id;
  update public.packing_item_promotions
  set status = 'completed'::public.packing_promotion_status,
      completed_at = pg_catalog.now(), last_error_code = null
  where id = promotion.id;
  return promotion.target_item_id;
end;
$$;

notify pgrst, 'reload schema';

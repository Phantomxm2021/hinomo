create or replace function public.request_packing_item_promotion(p_detected_item_id uuid)
returns public.packing_item_promotions
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  detected public.packing_detected_items%rowtype;
  session_row public.packing_sessions%rowtype;
  promotion public.packing_item_promotions%rowtype;
  new_item_id uuid := extensions.gen_random_uuid();
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  select * into detected from public.packing_detected_items items
  where items.id = p_detected_item_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'detected item is not accessible';
  end if;
  select * into session_row from public.packing_sessions sessions
  where sessions.id = detected.session_id and sessions.owner_id = caller;
  if not found then
    raise exception using errcode = '42501', message = 'detected item is not accessible';
  end if;

  select * into promotion from public.packing_item_promotions promotions
  where promotions.detected_item_id = detected.id for update;
  if found then
    if promotion.status = 'failed'::public.packing_promotion_status then
      update public.packing_item_promotions set status = 'pending', last_error_code = null
      where id = promotion.id returning * into promotion;
      update public.packing_analysis_jobs set
        status = 'pending'::public.packing_job_status,
        attempts = 0,
        next_attempt_at = pg_catalog.now(),
        lease_expires_at = null,
        last_error_code = null
      where session_id = detected.session_id
        and stage = 'publish'::public.packing_job_stage
        and scope_key = 'promotion:' || promotion.id;
    end if;
    return promotion;
  end if;

  if detected.published_at is null
    or detected.analysis_revision <> session_row.current_revision
    or detected.review_status in ('dismissed'::public.packing_review_status, 'promoted'::public.packing_review_status)
    or (detected.cover_object_key is null and detected.first_seen_photo_id is null
      and detected.representative_instance_id is null) then
    raise exception using errcode = '22023', message = 'detected item is not ready for promotion';
  end if;

  update public.packing_detected_items
  set quantity_kind = 'exact'::public.packing_quantity_kind,
      quantity_value = greatest(coalesce(quantity_value, 1), 1),
      review_status = 'confirmed'::public.packing_review_status
  where id = detected.id
  returning * into detected;

  insert into public.packing_item_promotions (
    detected_item_id, session_id, owner_id, target_item_id, target_object_key
  ) values (
    detected.id, detected.session_id, caller, new_item_id,
    'users/' || caller || '/boxes/' || detected.box_id || '/item/' || new_item_id || '.webp'
  ) returning * into promotion;

  insert into public.packing_analysis_jobs (session_id, stage, scope_key, input_fingerprint)
  values (
    detected.session_id,
    'publish'::public.packing_job_stage,
    'promotion:' || promotion.id,
    'promotion-v3:' || detected.id
  );
  return promotion;
end;
$$;

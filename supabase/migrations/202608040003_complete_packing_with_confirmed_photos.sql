-- Failed uploads leave pending or expired photo reservations behind. Completion
-- freezes only confirmed photos and expires every unfinished reservation so a
-- late confirmation cannot change the Atlas input after the session is queued.

create or replace function public.complete_packing_session(p_session_id uuid)
returns public.packing_sessions
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  current_session public.packing_sessions%rowtype;
  confirmed_count integer;
  target_revision integer;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  select * into current_session from public.packing_sessions sessions
  where sessions.id = p_session_id and sessions.owner_id = caller for update;
  if not found then
    raise exception using errcode = '42501', message = 'packing session is not accessible';
  end if;
  if current_session.status in ('queued', 'processing', 'ready', 'partial_failed', 'failed') then
    return current_session;
  end if;
  if current_session.status = 'canceled'::public.packing_session_status then
    raise exception using errcode = '22023', message = 'canceled packing session cannot be completed';
  end if;

  -- Freeze the photo rows before counting. A concurrent, late confirmation will
  -- wait and then reject once its reservation has been marked expired below.
  perform 1 from public.packing_photos photos
  where photos.session_id = current_session.id
  for update;

  select count(*)::integer into confirmed_count
  from public.packing_photos photos
  where photos.session_id = current_session.id
    and photos.upload_status = 'confirmed'::public.packing_photo_status;

  if confirmed_count not between 1 and 100 then
    raise exception using errcode = '22023', message = 'at least one uploaded packing photo is required';
  end if;

  -- An Atlas must match every ordered group of confirmed photos. Sequence
  -- numbers may contain gaps after failed or removed captures.
  if exists (
    with ordered_photos as (
      select photos.sequence_no,
        ((row_number() over (order by photos.sequence_no) - 1) / 16 + 1)::integer as atlas_no
      from public.packing_photos photos
      where photos.session_id = current_session.id
        and photos.upload_status = 'confirmed'::public.packing_photo_status
    ), expected_atlases as (
      select ordered.atlas_no, min(ordered.sequence_no) as first_sequence_no,
        max(ordered.sequence_no) as last_sequence_no
      from ordered_photos ordered
      group by ordered.atlas_no
    ), confirmed_atlases as (
      select atlases.atlas_no, atlases.first_sequence_no, atlases.last_sequence_no
      from public.packing_atlases atlases
      where atlases.session_id = current_session.id
        and atlases.layout_version = 'client-grid-4x4-v1'
        and atlases.upload_status = 'confirmed'
    )
    select 1
    from expected_atlases expected
    full join confirmed_atlases actual using (atlas_no)
    where expected.atlas_no is null
      or actual.atlas_no is null
      or expected.first_sequence_no <> actual.first_sequence_no
      or expected.last_sequence_no <> actual.last_sequence_no
  ) then
    raise exception using errcode = '22023', message = 'all packing atlases must be uploaded before completion';
  end if;

  update public.packing_photos photos set
    upload_status = 'expired'::public.packing_photo_status,
    upload_expires_at = least(photos.upload_expires_at, pg_catalog.now())
  where photos.session_id = current_session.id
    and photos.upload_status <> 'confirmed'::public.packing_photo_status;

  target_revision := current_session.current_revision + 1;
  perform private.reserve_packing_credits(
    caller, current_session.id, target_revision, confirmed_count,
    'packing:' || current_session.id || ':revision:' || target_revision || ':initial'
  );

  update public.packing_sessions set
    status = 'queued'::public.packing_session_status,
    photo_count = confirmed_count,
    completed_at = pg_catalog.now(),
    last_error_code = null
  where id = current_session.id
  returning * into current_session;

  insert into public.packing_analysis_jobs (session_id, stage, scope_key, input_fingerprint)
  values (current_session.id, 'normalize'::public.packing_job_stage, 'session', 'source-v1')
  on conflict do nothing;

  return current_session;
end;
$$;

comment on function public.complete_packing_session(uuid)
is 'Freezes confirmed packing photos, expires unfinished reservations, validates Atlases, reserves credits, and queues analysis.';

-- Packing data belongs to the venue owner, while the member who performs an
-- action remains the actor and pays for any AI work they request.

alter table public.packing_sessions
  add column created_by uuid references auth.users(id) on delete set null;
update public.packing_sessions set created_by = owner_id where created_by is null;

alter table public.packing_item_promotions
  add column requested_by uuid references auth.users(id) on delete set null;
update public.packing_item_promotions set requested_by = owner_id where requested_by is null;

create index packing_sessions_created_by_idx on public.packing_sessions(created_by, created_at desc);
create index packing_item_promotions_requested_by_idx on public.packing_item_promotions(requested_by, created_at desc);

-- Keep the venue traversal in one predicate so every user-facing packing RPC
-- makes an authorization decision from the current session/box relationship.
create function public.can_access_packing_session(p_session_id uuid, p_edit boolean default false)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.packing_sessions sessions
    join public.boxes boxes on boxes.id = sessions.box_id
    join public.spaces spaces on spaces.id = boxes.space_id
    where sessions.id = p_session_id
      and case when p_edit
        then public.can_edit_venue_content(spaces.venue_id)
        else public.can_access_venue(spaces.venue_id)
      end
  );
$$;

drop policy if exists packing_sessions_select_own on public.packing_sessions;
drop policy if exists packing_photos_select_own on public.packing_photos;
drop policy if exists packing_atlases_select_own on public.packing_atlases;
drop policy if exists packing_detected_items_select_own on public.packing_detected_items;
drop policy if exists packing_detected_items_update_own on public.packing_detected_items;
drop policy if exists packing_detected_instances_select_own on public.packing_detected_instances;
drop policy if exists packing_evidence_select_own on public.packing_detected_instance_evidence;
drop policy if exists packing_item_promotions_select_own on public.packing_item_promotions;

create policy packing_sessions_select_accessible on public.packing_sessions
for select to authenticated using (public.can_access_packing_session(id));
create policy packing_sessions_update_accessible on public.packing_sessions
for update to authenticated using (public.can_access_packing_session(id, true))
with check (public.can_access_packing_session(id, true));
create policy packing_photos_select_accessible on public.packing_photos
for select to authenticated using (public.can_access_packing_session(session_id));
create policy packing_photos_update_accessible on public.packing_photos
for update to authenticated using (public.can_access_packing_session(session_id, true))
with check (public.can_access_packing_session(session_id, true));
create policy packing_atlases_select_accessible on public.packing_atlases
for select to authenticated using (public.can_access_packing_session(session_id));
create policy packing_atlases_update_accessible on public.packing_atlases
for update to authenticated using (public.can_access_packing_session(session_id, true))
with check (public.can_access_packing_session(session_id, true));
create policy packing_detected_items_select_accessible on public.packing_detected_items
for select to authenticated using (public.can_access_packing_session(session_id));
create policy packing_detected_items_update_accessible on public.packing_detected_items
for update to authenticated using (public.can_access_packing_session(session_id, true))
with check (public.can_access_packing_session(session_id, true));
create policy packing_detected_instances_select_accessible on public.packing_detected_instances
for select to authenticated using (public.can_access_packing_session(session_id));
create policy packing_detected_instances_update_accessible on public.packing_detected_instances
for update to authenticated using (public.can_access_packing_session(session_id, true))
with check (public.can_access_packing_session(session_id, true));
create policy packing_evidence_select_accessible on public.packing_detected_instance_evidence
for select to authenticated using (exists (
  select 1 from public.packing_detected_instances instances
  where instances.id = detected_instance_id and public.can_access_packing_session(instances.session_id)
));
create policy packing_evidence_update_accessible on public.packing_detected_instance_evidence
for update to authenticated using (exists (
  select 1 from public.packing_detected_instances instances
  where instances.id = detected_instance_id and public.can_access_packing_session(instances.session_id, true)
)) with check (exists (
  select 1 from public.packing_detected_instances instances
  where instances.id = detected_instance_id and public.can_access_packing_session(instances.session_id, true)
));
create policy packing_item_promotions_select_accessible on public.packing_item_promotions
for select to authenticated using (public.can_access_packing_session(session_id));
create policy packing_item_promotions_update_accessible on public.packing_item_promotions
for update to authenticated using (public.can_access_packing_session(session_id, true))
with check (public.can_access_packing_session(session_id, true));

create or replace function public.create_packing_session(p_box_id uuid)
returns public.packing_sessions
language plpgsql security definer set search_path = pg_catalog
as $$
declare caller uuid := auth.uid(); created_session public.packing_sessions%rowtype; venue_owner uuid;
begin
  if caller is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  select venues.owner_id into venue_owner
  from public.boxes boxes join public.spaces spaces on spaces.id = boxes.space_id
  join public.venues venues on venues.id = spaces.venue_id
  where boxes.id = p_box_id and public.can_edit_venue_content(spaces.venue_id);
  if venue_owner is null then raise exception using errcode = '42501', message = 'box is not accessible'; end if;
  insert into public.packing_sessions (box_id, owner_id, created_by)
  values (p_box_id, venue_owner, caller) returning * into created_session;
  return created_session;
end;
$$;

create or replace function public.create_packing_photo_upload(p_session_id uuid, p_sequence_no integer, p_mime_type text, p_size_bytes bigint)
returns table(photo_id uuid, object_key text, upload_url text)
language plpgsql security definer set search_path = pg_catalog
as $$
declare caller uuid := auth.uid(); current_session public.packing_sessions%rowtype; current_photo public.packing_photos%rowtype; extension text;
begin
  if caller is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  if p_sequence_no is null or p_sequence_no not between 1 and 100 or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') or p_size_bytes is null or p_size_bytes not between 1 and 8388608 then
    raise exception using errcode = '22023', message = 'invalid packing photo metadata';
  end if;
  select * into current_session from public.packing_sessions sessions where sessions.id = p_session_id for update;
  if not found or not public.can_access_packing_session(p_session_id, true) then raise exception using errcode = '42501', message = 'packing session is not accessible'; end if;
  if current_session.status not in ('capturing'::public.packing_session_status, 'uploading'::public.packing_session_status) then raise exception using errcode = '22023', message = 'packing session no longer accepts photos'; end if;
  select * into current_photo from public.packing_photos photos where photos.session_id = p_session_id and photos.sequence_no = p_sequence_no for update;
  if found then
    if current_photo.upload_status = 'confirmed'::public.packing_photo_status or current_photo.mime_type <> p_mime_type or current_photo.size_bytes <> p_size_bytes then raise exception using errcode = '22023', message = 'packing photo sequence is already reserved'; end if;
    if current_photo.upload_status = 'expired'::public.packing_photo_status then delete from public.packing_photos where id = current_photo.id; current_photo.id := null;
    else update public.packing_photos set upload_expires_at = pg_catalog.now() + interval '5 minutes' where id = current_photo.id; return query select current_photo.id, current_photo.object_key, private.r2_presign_from_vault('PUT', current_photo.object_key, current_photo.mime_type, 300); return; end if;
  end if;
  extension := case p_mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else 'webp' end;
  current_photo.id := extensions.gen_random_uuid();
  current_photo.object_key := 'users/' || current_session.owner_id || '/boxes/' || current_session.box_id || '/packing/' || current_session.id || '/original/' || current_photo.id || '.' || extension;
  insert into public.packing_photos (id, session_id, box_id, owner_id, sequence_no, object_key, mime_type, size_bytes, upload_expires_at)
  values (current_photo.id, current_session.id, current_session.box_id, current_session.owner_id, p_sequence_no, current_photo.object_key, p_mime_type, p_size_bytes, pg_catalog.now() + interval '5 minutes');
  update public.packing_sessions set status = 'uploading'::public.packing_session_status where id = current_session.id and status = 'capturing'::public.packing_session_status;
  return query select current_photo.id, current_photo.object_key, private.r2_presign_from_vault('PUT', current_photo.object_key, p_mime_type, 300);
end;
$$;

create or replace function public.confirm_packing_photo_upload(p_photo_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
declare caller uuid := auth.uid(); current_photo public.packing_photos%rowtype;
begin
  if caller is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  select * into current_photo from public.packing_photos photos where photos.id = p_photo_id for update;
  if not found or not public.can_access_packing_session(current_photo.session_id, true) then raise exception using errcode = '42501', message = 'packing photo is not accessible'; end if;
  if current_photo.upload_status = 'confirmed'::public.packing_photo_status then return; end if;
  if current_photo.upload_status <> 'pending'::public.packing_photo_status or current_photo.upload_expires_at <= pg_catalog.now() then raise exception using errcode = '22023', message = 'packing photo upload is no longer confirmable'; end if;
  update public.packing_photos set upload_status = 'confirmed'::public.packing_photo_status, confirmed_at = pg_catalog.now() where id = current_photo.id;
end;
$$;

create or replace function public.delete_packing_photo(p_photo_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
declare caller uuid := auth.uid(); current_photo public.packing_photos%rowtype; current_session public.packing_sessions%rowtype;
begin
  if caller is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  select * into current_photo from public.packing_photos photos where photos.id = p_photo_id for update;
  if not found or not public.can_access_packing_session(current_photo.session_id, true) then raise exception using errcode = '42501', message = 'packing photo is not accessible'; end if;
  select * into current_session from public.packing_sessions where id = current_photo.session_id for update;
  if current_session.status not in ('capturing'::public.packing_session_status, 'uploading'::public.packing_session_status) then raise exception using errcode = '22023', message = 'packing session no longer accepts photo removal'; end if;
  delete from public.packing_photos where id = current_photo.id;
end;
$$;

create or replace function public.create_packing_atlas_upload(p_session_id uuid, p_atlas_no integer, p_first_sequence_no integer, p_last_sequence_no integer, p_width integer, p_height integer, p_size_bytes bigint, p_sha256 text)
returns table(atlas_id uuid, object_key text, upload_url text)
language plpgsql security definer set search_path = pg_catalog
as $$
declare caller uuid := auth.uid(); current_session public.packing_sessions%rowtype; current_atlas public.packing_atlases%rowtype; expected_first integer; expected_last integer; expected_group_count integer;
begin
  if caller is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  if p_atlas_no is null or p_atlas_no not between 1 and 7 or p_first_sequence_no is null or p_last_sequence_no is null or p_first_sequence_no < 1 or p_last_sequence_no > 100 or p_first_sequence_no > p_last_sequence_no or p_width is null or p_width not between 512 and 4096 or p_height is null or p_height not between 552 and 4096 or p_size_bytes is null or p_size_bytes not between 1 and 7340032 or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then raise exception using errcode = '22023', message = 'invalid packing atlas metadata'; end if;
  select * into current_session from public.packing_sessions sessions where sessions.id = p_session_id for update;
  if not found or not public.can_access_packing_session(p_session_id, true) then raise exception using errcode = '42501', message = 'packing session is not accessible'; end if;
  if current_session.status not in ('capturing'::public.packing_session_status, 'uploading'::public.packing_session_status) then raise exception using errcode = '22023', message = 'packing session no longer accepts atlases'; end if;
  select min(grouped.sequence_no), max(grouped.sequence_no), count(*)::integer into expected_first, expected_last, expected_group_count from (select photos.sequence_no from public.packing_photos photos where photos.session_id = current_session.id and photos.upload_status = 'confirmed'::public.packing_photo_status order by photos.sequence_no offset (p_atlas_no - 1) * 16 limit 16) grouped;
  if expected_group_count < 1 or p_first_sequence_no <> expected_first or p_last_sequence_no <> expected_last then raise exception using errcode = '22023', message = 'packing atlas sequence range is invalid'; end if;
  if (select count(*)::integer from public.packing_photos photos where photos.session_id = current_session.id and photos.upload_status = 'confirmed'::public.packing_photo_status and photos.sequence_no between p_first_sequence_no and p_last_sequence_no) <> expected_group_count then raise exception using errcode = '22023', message = 'packing atlas photos are incomplete'; end if;
  select * into current_atlas from public.packing_atlases atlases where atlases.session_id = current_session.id and atlases.atlas_no = p_atlas_no and atlases.layout_version = 'client-grid-4x4-v1' for update;
  if not found then
    current_atlas.id := extensions.gen_random_uuid(); current_atlas.object_key := 'users/' || current_session.owner_id || '/boxes/' || current_session.box_id || '/packing/' || current_session.id || '/atlas/client-' || pg_catalog.lpad(p_atlas_no::text, 3, '0') || '.jpg';
    insert into public.packing_atlases (id, session_id, atlas_no, first_sequence_no, last_sequence_no, object_key, layout_version, width, height, size_bytes, sha256, upload_status, confirmed_at) values (current_atlas.id, current_session.id, p_atlas_no, p_first_sequence_no, p_last_sequence_no, current_atlas.object_key, 'client-grid-4x4-v1', p_width, p_height, p_size_bytes, p_sha256, 'pending', null);
  else
    current_atlas.object_key := pg_catalog.regexp_replace(current_atlas.object_key, '\.webp$', '.jpg'); update public.packing_atlases set first_sequence_no = p_first_sequence_no, last_sequence_no = p_last_sequence_no, object_key = current_atlas.object_key, width = p_width, height = p_height, size_bytes = p_size_bytes, sha256 = p_sha256, upload_status = 'pending', confirmed_at = null where id = current_atlas.id;
  end if;
  return query select current_atlas.id, current_atlas.object_key, private.r2_presign_from_vault('PUT', current_atlas.object_key, 'image/jpeg', 300);
end;
$$;

create or replace function public.confirm_packing_atlas_upload(p_atlas_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
declare caller uuid := auth.uid(); atlas_session_id uuid;
begin
  if caller is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  select session_id into atlas_session_id from public.packing_atlases where id = p_atlas_id for update;
  if atlas_session_id is null or not public.can_access_packing_session(atlas_session_id, true) then raise exception using errcode = '42501', message = 'packing atlas is not confirmable'; end if;
  update public.packing_atlases set upload_status = 'confirmed', confirmed_at = pg_catalog.now() where id = p_atlas_id and exists (select 1 from public.packing_sessions sessions where sessions.id = atlas_session_id and sessions.status in ('capturing'::public.packing_session_status, 'uploading'::public.packing_session_status));
  if not found then raise exception using errcode = '42501', message = 'packing atlas is not confirmable'; end if;
end;
$$;

create or replace function public.complete_packing_session(p_session_id uuid)
returns public.packing_sessions
language plpgsql security definer set search_path = pg_catalog
as $$
declare caller uuid := auth.uid(); current_session public.packing_sessions%rowtype; confirmed_count integer; target_revision integer;
begin
  if caller is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  select * into current_session from public.packing_sessions sessions where sessions.id = p_session_id for update;
  if not found or not public.can_access_packing_session(p_session_id, true) then raise exception using errcode = '42501', message = 'packing session is not accessible'; end if;
  if current_session.status in ('queued', 'processing', 'ready', 'partial_failed', 'failed') then return current_session; end if;
  if current_session.status = 'canceled'::public.packing_session_status then raise exception using errcode = '22023', message = 'canceled packing session cannot be completed'; end if;
  perform 1 from public.packing_photos photos where photos.session_id = current_session.id for update;
  select count(*)::integer into confirmed_count from public.packing_photos photos where photos.session_id = current_session.id and photos.upload_status = 'confirmed'::public.packing_photo_status;
  if confirmed_count not between 1 and 100 then raise exception using errcode = '22023', message = 'at least one uploaded packing photo is required'; end if;
  if exists (with ordered_photos as (select photos.sequence_no, ((row_number() over (order by photos.sequence_no) - 1) / 16 + 1)::integer as atlas_no from public.packing_photos photos where photos.session_id = current_session.id and photos.upload_status = 'confirmed'::public.packing_photo_status), expected_atlases as (select atlas_no, min(sequence_no) as first_sequence_no, max(sequence_no) as last_sequence_no from ordered_photos group by atlas_no), confirmed_atlases as (select atlas_no, first_sequence_no, last_sequence_no from public.packing_atlases where session_id = current_session.id and layout_version = 'client-grid-4x4-v1' and upload_status = 'confirmed') select 1 from expected_atlases expected full join confirmed_atlases actual using (atlas_no) where expected.atlas_no is null or actual.atlas_no is null or expected.first_sequence_no <> actual.first_sequence_no or expected.last_sequence_no <> actual.last_sequence_no) then raise exception using errcode = '22023', message = 'all packing atlases must be uploaded before completion'; end if;
  update public.packing_photos set upload_status = 'expired'::public.packing_photo_status, upload_expires_at = least(upload_expires_at, pg_catalog.now()) where session_id = current_session.id and upload_status <> 'confirmed'::public.packing_photo_status;
  target_revision := current_session.current_revision + 1;
  perform private.reserve_packing_credits(caller, current_session.id, target_revision, confirmed_count, 'packing:' || current_session.id || ':revision:' || target_revision || ':initial');
  update public.packing_sessions set status = 'queued'::public.packing_session_status, photo_count = confirmed_count, completed_at = pg_catalog.now(), last_error_code = null where id = current_session.id returning * into current_session;
  insert into public.packing_analysis_jobs (session_id, stage, scope_key, input_fingerprint) values (current_session.id, 'normalize'::public.packing_job_stage, 'session', 'source-v1') on conflict do nothing;
  return current_session;
end;
$$;

create or replace function public.cancel_packing_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog
as $$ begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  if not public.can_access_packing_session(p_session_id, true) then raise exception using errcode = '42501', message = 'packing session cannot be canceled'; end if;
  update public.packing_sessions set status = 'canceled'::public.packing_session_status where id = p_session_id and status in ('capturing'::public.packing_session_status, 'uploading'::public.packing_session_status);
  if not found then raise exception using errcode = '42501', message = 'packing session cannot be canceled'; end if;
end; $$;

create or replace function public.delete_packing_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog
as $$ begin
  if auth.uid() is null or not public.can_access_packing_session(p_session_id, true) then raise exception using errcode = '42501', message = 'packing session is not accessible'; end if;
  delete from public.packing_sessions where id = p_session_id;
  if not found then raise exception using errcode = '42501', message = 'packing session is not accessible'; end if;
end; $$;

create or replace function public.create_packing_media_download(p_object_key text)
returns table(download_url text, expires_at timestamptz)
language plpgsql security definer set search_path = pg_catalog
as $$
declare caller uuid := auth.uid(); signed_expires_at timestamptz := pg_catalog.now() + interval '5 minutes';
begin
  if caller is null or not exists (
    select 1 from public.packing_photos photos where p_object_key in (photos.object_key, photos.normalized_object_key) and public.can_access_packing_session(photos.session_id)
    union all select 1 from public.packing_atlases atlases where atlases.object_key = p_object_key and public.can_access_packing_session(atlases.session_id)
    union all select 1 from public.packing_detected_items detected where detected.cover_object_key = p_object_key and public.can_access_packing_session(detected.session_id)
  ) then raise exception using errcode = '42501', message = 'packing media is not accessible'; end if;
  return query select private.r2_presign_from_vault('GET', p_object_key, null, 300), signed_expires_at;
end;
$$;

create or replace function public.request_packing_item_promotion(p_detected_item_id uuid)
returns public.packing_item_promotions
language plpgsql security definer set search_path = pg_catalog
as $$
declare caller uuid := auth.uid(); detected public.packing_detected_items%rowtype; session_row public.packing_sessions%rowtype; promotion public.packing_item_promotions%rowtype; new_item_id uuid := extensions.gen_random_uuid();
begin
  if caller is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  select * into detected from public.packing_detected_items items where items.id = p_detected_item_id for update;
  if not found then raise exception using errcode = '42501', message = 'detected item is not accessible'; end if;
  select * into session_row from public.packing_sessions sessions where sessions.id = detected.session_id;
  if not found or not public.can_access_packing_session(detected.session_id, true) then raise exception using errcode = '42501', message = 'detected item is not accessible'; end if;
  select * into promotion from public.packing_item_promotions promotions where promotions.detected_item_id = detected.id for update;
  if found then
    if promotion.status = 'failed'::public.packing_promotion_status then update public.packing_item_promotions set status = 'pending', last_error_code = null where id = promotion.id returning * into promotion; update public.packing_analysis_jobs set status = 'pending'::public.packing_job_status, attempts = 0, next_attempt_at = pg_catalog.now(), lease_expires_at = null, last_error_code = null where session_id = detected.session_id and stage = 'publish'::public.packing_job_stage and scope_key = 'promotion:' || promotion.id; end if;
    return promotion;
  end if;
  if detected.published_at is null then raise exception using errcode = '22023', message = 'detected item is not published'; end if;
  if detected.analysis_revision <> session_row.current_revision then raise exception using errcode = '22023', message = 'detected item belongs to an outdated analysis revision'; end if;
  if detected.review_status in ('dismissed'::public.packing_review_status, 'promoted'::public.packing_review_status) then raise exception using errcode = '22023', message = 'detected item has already been reviewed'; end if;
  if detected.cover_object_key is null and detected.first_seen_photo_id is null and detected.representative_instance_id is null then raise exception using errcode = '22023', message = 'detected item has no source photo'; end if;
  update public.packing_detected_items set quantity_kind = 'exact'::public.packing_quantity_kind, quantity_value = greatest(coalesce(quantity_value, 1), 1), review_status = 'confirmed'::public.packing_review_status where id = detected.id returning * into detected;
  insert into public.packing_item_promotions (detected_item_id, session_id, owner_id, requested_by, target_item_id, target_object_key)
  values (detected.id, detected.session_id, session_row.owner_id, caller, new_item_id, 'users/' || session_row.owner_id || '/boxes/' || detected.box_id || '/item/' || new_item_id || '.webp') returning * into promotion;
  insert into public.packing_analysis_jobs (session_id, stage, scope_key, input_fingerprint) values (detected.session_id, 'publish'::public.packing_job_stage, 'promotion:' || promotion.id, 'promotion-v4:' || detected.id);
  return promotion;
end;
$$;

create or replace function public.update_packing_detected_item(p_detected_item_id uuid, p_name text, p_category text, p_description text, p_quantity_kind public.packing_quantity_kind, p_quantity_value integer, p_review_status public.packing_review_status)
returns public.packing_detected_items
language plpgsql security definer set search_path = pg_catalog
as $$
declare updated_item public.packing_detected_items%rowtype;
begin
  if p_review_status not in ('confirmed'::public.packing_review_status, 'corrected'::public.packing_review_status, 'dismissed'::public.packing_review_status) or nullif(pg_catalog.btrim(p_name), '') is null or char_length(pg_catalog.btrim(p_name)) > 120 or (p_category is not null and char_length(p_category) > 80) or (p_description is not null and char_length(p_description) > 1000) or (p_quantity_kind = 'unknown'::public.packing_quantity_kind and p_quantity_value is not null) or (p_quantity_kind <> 'unknown'::public.packing_quantity_kind and coalesce(p_quantity_value, 0) <= 0) then raise exception using errcode = '22023', message = 'invalid detected item update'; end if;
  update public.packing_detected_items items set name = pg_catalog.btrim(p_name), category = nullif(pg_catalog.btrim(p_category), ''), description = nullif(pg_catalog.btrim(p_description), ''), quantity_kind = p_quantity_kind, quantity_value = p_quantity_value, review_status = p_review_status where items.id = p_detected_item_id and items.published_at is not null and items.review_status <> 'promoted'::public.packing_review_status and exists (select 1 from public.packing_sessions sessions where sessions.id = items.session_id and sessions.current_revision = items.analysis_revision and public.can_access_packing_session(sessions.id, true)) returning * into updated_item;
  if not found then raise exception using errcode = '42501', message = 'detected item is not editable'; end if;
  return updated_item;
end;
$$;

create or replace function public.merge_packing_detected_items(p_target_item_id uuid, p_source_item_id uuid)
returns public.packing_detected_items
language plpgsql security definer set search_path = pg_catalog
as $$
declare target_item public.packing_detected_items%rowtype; source_item public.packing_detected_items%rowtype;
begin
  if p_target_item_id is null or p_source_item_id is null or p_target_item_id = p_source_item_id then raise exception using errcode = '22023', message = 'two different detected items are required'; end if;
  perform 1 from public.packing_detected_items where id = least(p_target_item_id, p_source_item_id) for update;
  perform 1 from public.packing_detected_items where id = greatest(p_target_item_id, p_source_item_id) for update;
  select * into target_item from public.packing_detected_items where id = p_target_item_id;
  select * into source_item from public.packing_detected_items where id = p_source_item_id;
  if target_item.id is null or source_item.id is null or target_item.session_id <> source_item.session_id or target_item.analysis_revision <> source_item.analysis_revision or target_item.published_at is null or source_item.published_at is null or target_item.review_status in ('dismissed'::public.packing_review_status, 'promoted'::public.packing_review_status) or source_item.review_status in ('dismissed'::public.packing_review_status, 'promoted'::public.packing_review_status) or not public.can_access_packing_session(target_item.session_id, true) or not exists (select 1 from public.packing_sessions sessions where sessions.id = target_item.session_id and sessions.current_revision = target_item.analysis_revision) then raise exception using errcode = '42501', message = 'detected items cannot be merged'; end if;
  update public.packing_detected_instances set detected_item_id = target_item.id where detected_item_id = source_item.id;
  update public.packing_detected_items set quantity_kind = case when target_item.quantity_kind = 'unknown'::public.packing_quantity_kind or source_item.quantity_kind = 'unknown'::public.packing_quantity_kind then 'unknown'::public.packing_quantity_kind when target_item.quantity_kind = 'exact'::public.packing_quantity_kind and source_item.quantity_kind = 'exact'::public.packing_quantity_kind then 'exact'::public.packing_quantity_kind when target_item.quantity_kind = 'at_least'::public.packing_quantity_kind or source_item.quantity_kind = 'at_least'::public.packing_quantity_kind then 'at_least'::public.packing_quantity_kind else 'approximate'::public.packing_quantity_kind end, quantity_value = case when target_item.quantity_kind = 'unknown'::public.packing_quantity_kind or source_item.quantity_kind = 'unknown'::public.packing_quantity_kind then null else target_item.quantity_value + source_item.quantity_value end, review_status = 'corrected'::public.packing_review_status where id = target_item.id returning * into target_item;
  update public.packing_detected_items set review_status = 'dismissed'::public.packing_review_status where id = source_item.id;
  return target_item;
end;
$$;

create or replace function public.request_packing_reanalysis(p_session_id uuid)
returns public.packing_sessions
language plpgsql security definer set search_path = pg_catalog
as $$
declare caller uuid := auth.uid(); current_session public.packing_sessions%rowtype; target_revision integer; attempt_key text;
begin
  if caller is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  select * into current_session from public.packing_sessions sessions where sessions.id = p_session_id for update;
  if not found or not public.can_access_packing_session(p_session_id, true) then raise exception using errcode = '42501', message = 'packing session is not accessible'; end if;
  if current_session.status not in ('ready', 'partial_failed', 'failed') then raise exception using errcode = '22023', message = 'packing session cannot be reanalyzed'; end if;
  target_revision := current_session.current_revision + 1;
  attempt_key := 'packing:' || current_session.id || ':revision:' || target_revision || ':reanalyze:' || extensions.gen_random_uuid();
  perform private.reserve_packing_credits(caller, current_session.id, target_revision, current_session.photo_count, attempt_key);
  delete from public.packing_analysis_jobs where session_id = current_session.id;
  update public.packing_sessions set status = 'queued', processed_at = null, last_error_code = null where id = current_session.id returning * into current_session;
  insert into public.packing_analysis_jobs (session_id, stage, scope_key, input_fingerprint) values (current_session.id, 'normalize', 'session', pg_catalog.left('reanalyze-' || extensions.gen_random_uuid(), 128));
  return current_session;
end;
$$;

revoke all on function public.can_access_packing_session(uuid, boolean) from public, anon;
grant execute on function public.can_access_packing_session(uuid, boolean) to authenticated, service_role;
revoke all on table public.packing_analysis_jobs from authenticated;
notify pgrst, 'reload schema';

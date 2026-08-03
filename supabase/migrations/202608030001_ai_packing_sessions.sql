create type public.packing_session_status as enum (
  'capturing',
  'uploading',
  'queued',
  'processing',
  'ready',
  'partial_failed',
  'failed',
  'canceled'
);

create type public.packing_photo_status as enum ('pending', 'confirmed', 'expired');
create type public.packing_job_status as enum ('pending', 'processing', 'completed', 'failed');
create type public.packing_job_stage as enum (
  'normalize',
  'atlas',
  'observe',
  'verify',
  'track_instances',
  'consolidate',
  'localize',
  'crop',
  'validate_crops',
  'publish'
);
create type public.packing_quantity_kind as enum ('exact', 'at_least', 'approximate', 'unknown');
create type public.packing_visibility as enum ('clear', 'partial', 'occluded', 'reflective', 'opaque_container', 'unknown');
create type public.packing_review_status as enum ('unreviewed', 'needs_review', 'confirmed', 'corrected', 'dismissed', 'promoted');
create type public.packing_crop_status as enum ('pending', 'ready', 'needs_review', 'failed');
create type public.packing_tracking_status as enum ('provisional', 'tracked', 'ambiguous', 'merged', 'dismissed');
create type public.packing_evidence_kind as enum ('first_seen', 'supporting', 'conflict', 'verification');
create type public.packing_promotion_status as enum ('pending', 'processing', 'completed', 'failed');

create table public.packing_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  box_id uuid not null references public.boxes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status public.packing_session_status not null default 'capturing',
  photo_count integer not null default 0 check (photo_count between 0 and 100),
  current_revision integer not null default 0 check (current_revision >= 0),
  model_id text,
  prompt_version text,
  schema_version text,
  started_at timestamptz not null default pg_catalog.now(),
  completed_at timestamptz,
  processed_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 120),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, box_id),
  constraint packing_sessions_owner_box_check
    check (owner_id is not null)
);

create table public.packing_photos (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.packing_sessions(id) on delete cascade,
  box_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  sequence_no integer not null check (sequence_no between 1 and 100),
  object_key text not null unique,
  normalized_object_key text unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 8388608),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  perceptual_hash text,
  quality_flags jsonb not null default '[]'::jsonb check (jsonb_typeof(quality_flags) = 'array'),
  upload_status public.packing_photo_status not null default 'pending',
  upload_expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (session_id, sequence_no),
  foreign key (session_id, box_id) references public.packing_sessions(id, box_id) on delete cascade
);

create table public.packing_atlases (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.packing_sessions(id) on delete cascade,
  atlas_no integer not null check (atlas_no > 0),
  first_sequence_no integer not null check (first_sequence_no > 0),
  last_sequence_no integer not null check (last_sequence_no >= first_sequence_no),
  object_key text not null unique,
  layout_version text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default pg_catalog.now(),
  unique (session_id, atlas_no, layout_version)
);

create table public.packing_analysis_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.packing_sessions(id) on delete cascade,
  stage public.packing_job_stage not null,
  scope_key text not null check (char_length(scope_key) between 1 and 160),
  status public.packing_job_status not null default 'pending',
  attempts integer not null default 0 check (attempts between 0 and 5),
  next_attempt_at timestamptz not null default pg_catalog.now(),
  lease_expires_at timestamptz,
  input_fingerprint text not null check (char_length(input_fingerprint) between 1 and 128),
  result jsonb,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 120),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (session_id, stage, scope_key, input_fingerprint)
);

create table public.packing_detected_items (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.packing_sessions(id) on delete cascade,
  box_id uuid not null references public.boxes(id) on delete cascade,
  analysis_revision integer not null check (analysis_revision > 0),
  name text not null check (char_length(pg_catalog.btrim(name)) between 1 and 120),
  category text check (category is null or char_length(category) <= 80),
  description text check (description is null or char_length(description) <= 1000),
  quantity_kind public.packing_quantity_kind not null,
  quantity_value integer check (quantity_value is null or quantity_value > 0),
  visibility public.packing_visibility not null,
  review_status public.packing_review_status not null default 'unreviewed',
  crop_status public.packing_crop_status not null default 'pending',
  first_seen_photo_id uuid references public.packing_photos(id) on delete set null,
  representative_instance_id uuid,
  cover_object_key text unique,
  cover_mime_type text check (cover_mime_type is null or cover_mime_type = 'image/webp'),
  cover_size_bytes bigint check (cover_size_bytes is null or cover_size_bytes > 0),
  cover_width integer check (cover_width is null or cover_width > 0),
  cover_height integer check (cover_height is null or cover_height > 0),
  crop_source_photo_id uuid references public.packing_photos(id) on delete set null,
  crop_bbox jsonb check (
    crop_bbox is null
    or (jsonb_typeof(crop_bbox) = 'array' and jsonb_array_length(crop_bbox) = 4)
  ),
  crop_version text,
  model_id text not null,
  prompt_version text not null,
  published_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint packing_detected_items_quantity_shape check (
    (quantity_kind = 'unknown'::public.packing_quantity_kind and quantity_value is null)
    or (quantity_kind <> 'unknown'::public.packing_quantity_kind and quantity_value is not null)
  ),
  constraint packing_detected_items_cover_shape check (
    num_nonnulls(cover_object_key, cover_mime_type, cover_size_bytes, cover_width, cover_height) in (0, 5)
  ),
  unique (id, session_id),
  foreign key (session_id, box_id) references public.packing_sessions(id, box_id) on delete cascade
);

create table public.packing_detected_instances (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.packing_sessions(id) on delete cascade,
  detected_item_id uuid,
  provisional_name text not null check (char_length(pg_catalog.btrim(provisional_name)) between 1 and 120),
  tracking_status public.packing_tracking_status not null default 'provisional',
  first_seen_photo_id uuid references public.packing_photos(id) on delete set null,
  last_seen_photo_id uuid references public.packing_photos(id) on delete set null,
  representative_photo_id uuid references public.packing_photos(id) on delete set null,
  appearance_fingerprint text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, session_id),
  foreign key (detected_item_id, session_id)
    references public.packing_detected_items(id, session_id) on delete cascade
);

alter table public.packing_detected_items
add constraint packing_detected_items_representative_instance_fkey
foreign key (representative_instance_id)
references public.packing_detected_instances(id)
on delete set null;

create table public.packing_detected_instance_evidence (
  detected_instance_id uuid not null references public.packing_detected_instances(id) on delete cascade,
  photo_id uuid not null references public.packing_photos(id) on delete cascade,
  evidence_kind public.packing_evidence_kind not null,
  bbox jsonb check (bbox is null or (jsonb_typeof(bbox) = 'array' and jsonb_array_length(bbox) = 4)),
  visibility public.packing_visibility not null,
  crop_suitable boolean not null default false,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (detected_instance_id, photo_id, evidence_kind),
  constraint packing_evidence_verification_bbox_check check (
    evidence_kind <> 'verification'::public.packing_evidence_kind or bbox is not null
  )
);

create table public.packing_item_promotions (
  id uuid primary key default extensions.gen_random_uuid(),
  detected_item_id uuid not null unique references public.packing_detected_items(id) on delete cascade,
  session_id uuid not null references public.packing_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  target_item_id uuid not null unique default extensions.gen_random_uuid(),
  target_object_key text not null unique,
  status public.packing_promotion_status not null default 'pending',
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 120),
  completed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index packing_sessions_owner_updated_idx on public.packing_sessions(owner_id, updated_at desc);
create index packing_sessions_box_created_idx on public.packing_sessions(box_id, created_at desc);
create index packing_photos_session_sequence_idx on public.packing_photos(session_id, sequence_no);
create index packing_photos_pending_expiry_idx on public.packing_photos(upload_status, upload_expires_at);
create index packing_jobs_claim_idx on public.packing_analysis_jobs(status, next_attempt_at, created_at);
create index packing_jobs_lease_idx on public.packing_analysis_jobs(status, lease_expires_at);
create index packing_detected_items_box_revision_idx on public.packing_detected_items(box_id, analysis_revision, review_status);
create index packing_detected_items_search_idx on public.packing_detected_items
using gin ((pg_catalog.lower(coalesce(name, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, ''))) extensions.gin_trgm_ops);
create index packing_instances_session_idx on public.packing_detected_instances(session_id, tracking_status);

create trigger packing_sessions_set_updated_at before update on public.packing_sessions
for each row execute function public.set_updated_at();
create trigger packing_photos_set_updated_at before update on public.packing_photos
for each row execute function public.set_updated_at();
create trigger packing_jobs_set_updated_at before update on public.packing_analysis_jobs
for each row execute function public.set_updated_at();
create trigger packing_detected_items_set_updated_at before update on public.packing_detected_items
for each row execute function public.set_updated_at();
create trigger packing_detected_instances_set_updated_at before update on public.packing_detected_instances
for each row execute function public.set_updated_at();
create trigger packing_item_promotions_set_updated_at before update on public.packing_item_promotions
for each row execute function public.set_updated_at();

alter table public.packing_sessions enable row level security;
alter table public.packing_photos enable row level security;
alter table public.packing_atlases enable row level security;
alter table public.packing_analysis_jobs enable row level security;
alter table public.packing_detected_items enable row level security;
alter table public.packing_detected_instances enable row level security;
alter table public.packing_detected_instance_evidence enable row level security;
alter table public.packing_item_promotions enable row level security;

create policy packing_sessions_select_own on public.packing_sessions
for select to authenticated using (owner_id = auth.uid());

create policy packing_photos_select_own on public.packing_photos
for select to authenticated using (owner_id = auth.uid());

create policy packing_atlases_select_own on public.packing_atlases
for select to authenticated using (
  exists (select 1 from public.packing_sessions sessions where sessions.id = session_id and sessions.owner_id = auth.uid())
);

create policy packing_detected_items_select_own on public.packing_detected_items
for select to authenticated using (
  exists (select 1 from public.packing_sessions sessions where sessions.id = session_id and sessions.owner_id = auth.uid())
);

create policy packing_detected_items_update_own on public.packing_detected_items
for update to authenticated
using (
  exists (select 1 from public.packing_sessions sessions where sessions.id = session_id and sessions.owner_id = auth.uid())
)
with check (
  exists (select 1 from public.packing_sessions sessions where sessions.id = session_id and sessions.owner_id = auth.uid())
);

create policy packing_detected_instances_select_own on public.packing_detected_instances
for select to authenticated using (
  exists (select 1 from public.packing_sessions sessions where sessions.id = session_id and sessions.owner_id = auth.uid())
);

create policy packing_evidence_select_own on public.packing_detected_instance_evidence
for select to authenticated using (
  exists (
    select 1
    from public.packing_detected_instances instances
    join public.packing_sessions sessions on sessions.id = instances.session_id
    where instances.id = detected_instance_id and sessions.owner_id = auth.uid()
  )
);

create policy packing_item_promotions_select_own on public.packing_item_promotions
for select to authenticated using (owner_id = auth.uid());

create function public.create_packing_session(p_box_id uuid)
returns public.packing_sessions
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  created_session public.packing_sessions;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  if not exists (
    select 1 from public.boxes boxes where boxes.id = p_box_id and boxes.owner_id = caller
  ) then
    raise exception using errcode = '42501', message = 'box is not accessible';
  end if;

  insert into public.packing_sessions (box_id, owner_id)
  values (p_box_id, caller)
  returning * into created_session;

  return created_session;
end;
$$;

create function public.create_packing_photo_upload(
  p_session_id uuid,
  p_sequence_no integer,
  p_mime_type text,
  p_size_bytes bigint
)
returns table(photo_id uuid, object_key text, upload_url text)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  current_session public.packing_sessions%rowtype;
  current_photo public.packing_photos%rowtype;
  extension text;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  if p_sequence_no is null or p_sequence_no not between 1 and 100
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_size_bytes is null or p_size_bytes not between 1 and 8388608 then
    raise exception using errcode = '22023', message = 'invalid packing photo metadata';
  end if;

  select * into current_session
  from public.packing_sessions sessions
  where sessions.id = p_session_id and sessions.owner_id = caller
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'packing session is not accessible';
  end if;
  if current_session.status not in ('capturing'::public.packing_session_status, 'uploading'::public.packing_session_status) then
    raise exception using errcode = '22023', message = 'packing session no longer accepts photos';
  end if;

  select * into current_photo
  from public.packing_photos photos
  where photos.session_id = p_session_id and photos.sequence_no = p_sequence_no
  for update;

  if found then
    if current_photo.upload_status = 'confirmed'::public.packing_photo_status
      or current_photo.mime_type <> p_mime_type
      or current_photo.size_bytes <> p_size_bytes then
      raise exception using errcode = '22023', message = 'packing photo sequence is already reserved';
    end if;

    if current_photo.upload_status = 'expired'::public.packing_photo_status then
      delete from public.packing_photos where id = current_photo.id;
      current_photo.id := null;
    else
      update public.packing_photos
      set upload_expires_at = pg_catalog.now() + interval '5 minutes'
      where id = current_photo.id;

      return query select current_photo.id, current_photo.object_key,
        private.r2_presign_from_vault('PUT', current_photo.object_key, current_photo.mime_type, 300);
      return;
    end if;
  end if;

  extension := case p_mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else 'webp' end;
  current_photo.id := extensions.gen_random_uuid();
  current_photo.object_key := 'users/' || caller || '/boxes/' || current_session.box_id
    || '/packing/' || current_session.id || '/original/' || current_photo.id || '.' || extension;

  insert into public.packing_photos (
    id, session_id, box_id, owner_id, sequence_no, object_key, mime_type, size_bytes, upload_expires_at
  ) values (
    current_photo.id, current_session.id, current_session.box_id, caller, p_sequence_no,
    current_photo.object_key, p_mime_type, p_size_bytes, pg_catalog.now() + interval '5 minutes'
  );

  update public.packing_sessions set status = 'uploading'::public.packing_session_status
  where id = current_session.id and status = 'capturing'::public.packing_session_status;

  return query select current_photo.id, current_photo.object_key,
    private.r2_presign_from_vault('PUT', current_photo.object_key, p_mime_type, 300);
end;
$$;

create function public.confirm_packing_photo_upload(p_photo_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  current_photo public.packing_photos%rowtype;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  select * into current_photo from public.packing_photos photos
  where photos.id = p_photo_id and photos.owner_id = caller for update;
  if not found then
    raise exception using errcode = '42501', message = 'packing photo is not accessible';
  end if;
  if current_photo.upload_status = 'confirmed'::public.packing_photo_status then return; end if;
  if current_photo.upload_status <> 'pending'::public.packing_photo_status
    or current_photo.upload_expires_at <= pg_catalog.now() then
    raise exception using errcode = '22023', message = 'packing photo upload is no longer confirmable';
  end if;

  update public.packing_photos set
    upload_status = 'confirmed'::public.packing_photo_status,
    confirmed_at = pg_catalog.now()
  where id = current_photo.id;
end;
$$;

create function public.complete_packing_session(p_session_id uuid)
returns public.packing_sessions
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  current_session public.packing_sessions%rowtype;
  confirmed_count integer;
  total_count integer;
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

  select count(*), count(*) filter (where upload_status = 'confirmed'::public.packing_photo_status)
  into total_count, confirmed_count
  from public.packing_photos photos where photos.session_id = current_session.id;

  if total_count not between 1 and 100 or confirmed_count <> total_count then
    raise exception using errcode = '22023', message = 'all packing photos must be uploaded before completion';
  end if;

  update public.packing_sessions set
    status = 'queued'::public.packing_session_status,
    photo_count = total_count,
    completed_at = pg_catalog.now(),
    last_error_code = null
  where id = current_session.id returning * into current_session;

  insert into public.packing_analysis_jobs (session_id, stage, scope_key, input_fingerprint)
  values (current_session.id, 'normalize'::public.packing_job_stage, 'session', 'source-v1')
  on conflict do nothing;

  return current_session;
end;
$$;

create function public.cancel_packing_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  update public.packing_sessions
  set status = 'canceled'::public.packing_session_status
  where id = p_session_id
    and owner_id = auth.uid()
    and status in ('capturing'::public.packing_session_status, 'uploading'::public.packing_session_status);

  if not found then
    raise exception using errcode = '42501', message = 'packing session cannot be canceled';
  end if;
end;
$$;

create function public.delete_packing_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  delete from public.packing_sessions
  where id = p_session_id and owner_id = auth.uid();
  if not found then
    raise exception using errcode = '42501', message = 'packing session is not accessible';
  end if;
end;
$$;

create function public.create_packing_media_download(p_object_key text)
returns table(download_url text, expires_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  signed_expires_at timestamptz := pg_catalog.now() + interval '5 minutes';
begin
  if caller is null or not exists (
    select 1 from public.packing_photos photos
    where photos.owner_id = caller and p_object_key in (photos.object_key, photos.normalized_object_key)
    union all
    select 1 from public.packing_atlases atlases
    join public.packing_sessions sessions on sessions.id = atlases.session_id
    where sessions.owner_id = caller and atlases.object_key = p_object_key
    union all
    select 1 from public.packing_detected_items detected
    join public.packing_sessions sessions on sessions.id = detected.session_id
    where sessions.owner_id = caller and detected.cover_object_key = p_object_key
  ) then
    raise exception using errcode = '42501', message = 'packing media is not accessible';
  end if;

  return query select private.r2_presign_from_vault('GET', p_object_key, null, 300), signed_expires_at;
end;
$$;

create function public.request_packing_item_promotion(p_detected_item_id uuid)
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
    or detected.quantity_kind <> 'exact'::public.packing_quantity_kind
    or detected.quantity_value is null
    or detected.crop_status <> 'ready'::public.packing_crop_status
    or detected.cover_object_key is null then
    raise exception using errcode = '22023', message = 'detected item is not ready for promotion';
  end if;

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
    'promotion-v1:' || detected.id
  );
  return promotion;
end;
$$;

create function public.update_packing_detected_item(
  p_detected_item_id uuid,
  p_name text,
  p_category text,
  p_description text,
  p_quantity_kind public.packing_quantity_kind,
  p_quantity_value integer,
  p_review_status public.packing_review_status
)
returns public.packing_detected_items
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare updated_item public.packing_detected_items%rowtype;
begin
  if p_review_status not in (
    'confirmed'::public.packing_review_status,
    'corrected'::public.packing_review_status,
    'dismissed'::public.packing_review_status
  ) or nullif(pg_catalog.btrim(p_name), '') is null
    or char_length(pg_catalog.btrim(p_name)) > 120
    or (p_category is not null and char_length(p_category) > 80)
    or (p_description is not null and char_length(p_description) > 1000)
    or (p_quantity_kind = 'unknown'::public.packing_quantity_kind and p_quantity_value is not null)
    or (p_quantity_kind <> 'unknown'::public.packing_quantity_kind and coalesce(p_quantity_value, 0) <= 0) then
    raise exception using errcode = '22023', message = 'invalid detected item update';
  end if;

  update public.packing_detected_items items set
    name = pg_catalog.btrim(p_name),
    category = nullif(pg_catalog.btrim(p_category), ''),
    description = nullif(pg_catalog.btrim(p_description), ''),
    quantity_kind = p_quantity_kind,
    quantity_value = p_quantity_value,
    review_status = p_review_status
  where items.id = p_detected_item_id
    and items.published_at is not null
    and items.review_status <> 'promoted'::public.packing_review_status
    and exists (
      select 1 from public.packing_sessions sessions
      where sessions.id = items.session_id and sessions.owner_id = auth.uid()
        and sessions.current_revision = items.analysis_revision
    )
  returning * into updated_item;
  if not found then
    raise exception using errcode = '42501', message = 'detected item is not editable';
  end if;
  return updated_item;
end;
$$;

create function public.merge_packing_detected_items(p_target_item_id uuid, p_source_item_id uuid)
returns public.packing_detected_items
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  target_item public.packing_detected_items%rowtype;
  source_item public.packing_detected_items%rowtype;
begin
  if p_target_item_id is null or p_source_item_id is null or p_target_item_id = p_source_item_id then
    raise exception using errcode = '22023', message = 'two different detected items are required';
  end if;
  select * into target_item from public.packing_detected_items items
  where items.id = least(p_target_item_id, p_source_item_id) for update;
  select * into source_item from public.packing_detected_items items
  where items.id = greatest(p_target_item_id, p_source_item_id) for update;
  select * into target_item from public.packing_detected_items items where items.id = p_target_item_id;
  select * into source_item from public.packing_detected_items items where items.id = p_source_item_id;

  if target_item.id is null or source_item.id is null
    or target_item.session_id <> source_item.session_id
    or target_item.analysis_revision <> source_item.analysis_revision
    or target_item.published_at is null or source_item.published_at is null
    or target_item.review_status in ('dismissed'::public.packing_review_status, 'promoted'::public.packing_review_status)
    or source_item.review_status in ('dismissed'::public.packing_review_status, 'promoted'::public.packing_review_status)
    or not exists (
      select 1 from public.packing_sessions sessions
      where sessions.id = target_item.session_id and sessions.owner_id = auth.uid()
        and sessions.current_revision = target_item.analysis_revision
    ) then
    raise exception using errcode = '42501', message = 'detected items cannot be merged';
  end if;

  update public.packing_detected_instances set detected_item_id = target_item.id
  where detected_item_id = source_item.id;
  update public.packing_detected_items set
    quantity_kind = case
      when target_item.quantity_kind = 'unknown'::public.packing_quantity_kind
        or source_item.quantity_kind = 'unknown'::public.packing_quantity_kind then 'unknown'::public.packing_quantity_kind
      when target_item.quantity_kind = 'exact'::public.packing_quantity_kind
        and source_item.quantity_kind = 'exact'::public.packing_quantity_kind then 'exact'::public.packing_quantity_kind
      when target_item.quantity_kind = 'at_least'::public.packing_quantity_kind
        or source_item.quantity_kind = 'at_least'::public.packing_quantity_kind then 'at_least'::public.packing_quantity_kind
      else 'approximate'::public.packing_quantity_kind
    end,
    quantity_value = case
      when target_item.quantity_kind = 'unknown'::public.packing_quantity_kind
        or source_item.quantity_kind = 'unknown'::public.packing_quantity_kind then null
      else target_item.quantity_value + source_item.quantity_value
    end,
    review_status = 'corrected'::public.packing_review_status
  where id = target_item.id returning * into target_item;
  update public.packing_detected_items set review_status = 'dismissed'::public.packing_review_status
  where id = source_item.id;
  return target_item;
end;
$$;

create function public.finalize_packing_item_promotion(
  p_promotion_id uuid,
  p_mime_type text,
  p_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  promotion public.packing_item_promotions%rowtype;
  detected public.packing_detected_items%rowtype;
begin
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_size_bytes is null or p_size_bytes <= 0 then
    raise exception using errcode = '22023', message = 'invalid promoted media metadata';
  end if;

  select * into promotion from public.packing_item_promotions promotions
  where promotions.id = p_promotion_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'packing promotion does not exist';
  end if;
  if promotion.status = 'completed'::public.packing_promotion_status then
    return promotion.target_item_id;
  end if;

  select * into detected from public.packing_detected_items items
  where items.id = promotion.detected_item_id for update;
  if not found or detected.quantity_kind <> 'exact'::public.packing_quantity_kind
    or detected.quantity_value is null then
    raise exception using errcode = '22023', message = 'detected item can no longer be promoted';
  end if;

  insert into public.items (
    id, box_id, name, category, quantity, description,
    image_object_key, image_mime_type, image_size_bytes
  ) values (
    promotion.target_item_id, detected.box_id, detected.name, detected.category,
    detected.quantity_value, detected.description,
    promotion.target_object_key, p_mime_type, p_size_bytes
  ) on conflict (id) do nothing;

  update public.packing_detected_items
  set review_status = 'promoted'::public.packing_review_status
  where id = detected.id;
  update public.packing_item_promotions set
    status = 'completed'::public.packing_promotion_status,
    completed_at = pg_catalog.now(),
    last_error_code = null
  where id = promotion.id;
  return promotion.target_item_id;
end;
$$;

create function public.publish_packing_revision(
  p_session_id uuid,
  p_revision integer,
  p_model_id text,
  p_prompt_version text,
  p_schema_version text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare published_at_value timestamptz := pg_catalog.now();
begin
  if p_revision is null or p_revision < 1
    or nullif(pg_catalog.btrim(p_model_id), '') is null
    or nullif(pg_catalog.btrim(p_prompt_version), '') is null
    or nullif(pg_catalog.btrim(p_schema_version), '') is null then
    raise exception using errcode = '22023', message = 'invalid packing revision metadata';
  end if;

  perform 1 from public.packing_sessions sessions where sessions.id = p_session_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'packing session does not exist';
  end if;
  if exists (
    select 1 from public.packing_detected_items items
    where items.session_id = p_session_id and items.analysis_revision = p_revision
      and items.visibility = 'clear'::public.packing_visibility
      and items.crop_status <> 'ready'::public.packing_crop_status
      and items.review_status <> 'needs_review'::public.packing_review_status
  ) then
    raise exception using errcode = '22023', message = 'clear packing items require a verified crop or review';
  end if;

  update public.packing_detected_items
  set published_at = published_at_value
  where session_id = p_session_id and analysis_revision = p_revision and published_at is null;
  update public.packing_sessions set
    current_revision = p_revision,
    status = 'ready'::public.packing_session_status,
    model_id = p_model_id,
    prompt_version = p_prompt_version,
    schema_version = p_schema_version,
    processed_at = published_at_value,
    last_error_code = null
  where id = p_session_id;
end;
$$;

create function public.request_packing_reanalysis(p_session_id uuid)
returns public.packing_sessions
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  current_session public.packing_sessions%rowtype;
begin
  select * into current_session from public.packing_sessions sessions
  where sessions.id = p_session_id and sessions.owner_id = caller for update;
  if not found then
    raise exception using errcode = '42501', message = 'packing session is not accessible';
  end if;
  if current_session.status not in (
    'ready'::public.packing_session_status,
    'partial_failed'::public.packing_session_status,
    'failed'::public.packing_session_status
  ) then
    raise exception using errcode = '22023', message = 'packing session cannot be reanalyzed';
  end if;

  delete from public.packing_analysis_jobs where session_id = current_session.id;
  update public.packing_sessions set
    status = 'queued'::public.packing_session_status,
    processed_at = null,
    last_error_code = null
  where id = current_session.id returning * into current_session;
  insert into public.packing_analysis_jobs (session_id, stage, scope_key, input_fingerprint)
  values (current_session.id, 'normalize'::public.packing_job_stage, 'session', 'reanalyze-' || extensions.gen_random_uuid());
  return current_session;
end;
$$;

create function public.expire_packing_photo_uploads(p_cutoff timestamptz default pg_catalog.now())
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare processed integer;
begin
  with expired as (
    update public.packing_photos set upload_status = 'expired'::public.packing_photo_status
    where upload_status = 'pending'::public.packing_photo_status and upload_expires_at <= p_cutoff
    returning object_key
  ), queued as (
    insert into public.media_cleanup_jobs (object_key)
    select object_key from expired on conflict (object_key) do nothing
  )
  select count(*) into processed from expired;
  return processed;
end;
$$;

create function public.claim_packing_analysis_jobs(
  p_batch_size integer default 5,
  p_lease_seconds integer default 300
)
returns table (
  job_id uuid,
  session_id uuid,
  stage public.packing_job_stage,
  scope_key text,
  attempts integer,
  input_fingerprint text
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if p_batch_size is null or p_batch_size not between 1 and 25
    or p_lease_seconds is null or p_lease_seconds not between 30 and 1800 then
    raise exception using errcode = '22023', message = 'invalid packing job claim options';
  end if;

  update public.packing_analysis_jobs jobs
  set
    status = case when jobs.attempts >= 5 then 'failed'::public.packing_job_status else 'pending'::public.packing_job_status end,
    lease_expires_at = null,
    next_attempt_at = pg_catalog.now(),
    last_error_code = 'worker_lease_expired'
  where jobs.status = 'processing'::public.packing_job_status
    and jobs.lease_expires_at <= pg_catalog.now();

  return query
  with candidates as (
    select jobs.id
    from public.packing_analysis_jobs jobs
    where jobs.status = 'pending'::public.packing_job_status
      and jobs.attempts < 5
      and jobs.next_attempt_at <= pg_catalog.now()
    order by jobs.next_attempt_at, jobs.created_at
    limit p_batch_size
    for update skip locked
  ), claimed as (
    update public.packing_analysis_jobs jobs
    set
      status = 'processing'::public.packing_job_status,
      attempts = jobs.attempts + 1,
      lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
      last_error_code = null
    from candidates
    where jobs.id = candidates.id
    returning jobs.*
  ), sessions_started as (
    update public.packing_sessions sessions
    set status = 'processing'::public.packing_session_status
    where sessions.id in (select claimed.session_id from claimed)
      and sessions.status = 'queued'::public.packing_session_status
  )
  select claimed.id, claimed.session_id, claimed.stage, claimed.scope_key,
    claimed.attempts, claimed.input_fingerprint
  from claimed;
end;
$$;

create function public.complete_packing_analysis_job(
  p_job_id uuid,
  p_next_stage public.packing_job_stage default null,
  p_next_scope_key text default null,
  p_next_input_fingerprint text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare current_job public.packing_analysis_jobs%rowtype;
begin
  select * into current_job from public.packing_analysis_jobs jobs
  where jobs.id = p_job_id for update;
  if not found or current_job.status <> 'processing'::public.packing_job_status then
    raise exception using errcode = '22023', message = 'packing job is not processing';
  end if;

  update public.packing_analysis_jobs set
    status = 'completed'::public.packing_job_status,
    lease_expires_at = null,
    last_error_code = null
  where id = current_job.id;

  if p_next_stage is not null then
    if p_next_scope_key is null or p_next_input_fingerprint is null then
      raise exception using errcode = '22023', message = 'next packing job metadata is required';
    end if;
    insert into public.packing_analysis_jobs (session_id, stage, scope_key, input_fingerprint)
    values (current_job.session_id, p_next_stage, p_next_scope_key, p_next_input_fingerprint)
    on conflict do nothing;
  end if;
end;
$$;

create function public.fail_packing_analysis_job(
  p_job_id uuid,
  p_error_code text,
  p_retryable boolean default true
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare current_job public.packing_analysis_jobs%rowtype;
declare terminal boolean;
begin
  if p_error_code is null or char_length(p_error_code) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'packing job error code is required';
  end if;
  select * into current_job from public.packing_analysis_jobs jobs
  where jobs.id = p_job_id for update;
  if not found or current_job.status <> 'processing'::public.packing_job_status then
    raise exception using errcode = '22023', message = 'packing job is not processing';
  end if;

  terminal := not p_retryable or current_job.attempts >= 5;
  update public.packing_analysis_jobs set
    status = case when terminal then 'failed'::public.packing_job_status else 'pending'::public.packing_job_status end,
    lease_expires_at = null,
    next_attempt_at = case
      when terminal then next_attempt_at
      else pg_catalog.now() + pg_catalog.make_interval(secs => least(3600, 30 * pg_catalog.power(2::numeric, current_job.attempts)::integer))
    end,
    last_error_code = p_error_code
  where id = current_job.id;

  if terminal then
    update public.packing_sessions set
      status = 'partial_failed'::public.packing_session_status,
      last_error_code = p_error_code
    where id = current_job.session_id;
  end if;
end;
$$;

create function public.enqueue_packing_media_cleanup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare key text;
begin
  if tg_table_name = 'packing_photos' then
    foreach key in array array[old.object_key, old.normalized_object_key] loop
      if key is not null then insert into public.media_cleanup_jobs (object_key) values (key) on conflict do nothing; end if;
    end loop;
  elsif tg_table_name = 'packing_detected_items' then
    if old.cover_object_key is not null then
      insert into public.media_cleanup_jobs (object_key) values (old.cover_object_key) on conflict do nothing;
    end if;
  elsif tg_table_name = 'packing_item_promotions' then
    if old.status <> 'completed'::public.packing_promotion_status then
      insert into public.media_cleanup_jobs (object_key) values (old.target_object_key) on conflict do nothing;
    end if;
  else
    if old.object_key is not null then
      insert into public.media_cleanup_jobs (object_key) values (old.object_key) on conflict do nothing;
    end if;
  end if;
  return old;
end;
$$;

create trigger packing_photos_deleted_cleanup after delete on public.packing_photos
for each row execute function public.enqueue_packing_media_cleanup();
create trigger packing_atlases_deleted_cleanup after delete on public.packing_atlases
for each row execute function public.enqueue_packing_media_cleanup();
create trigger packing_detected_items_deleted_cleanup after delete on public.packing_detected_items
for each row execute function public.enqueue_packing_media_cleanup();
create trigger packing_item_promotions_deleted_cleanup after delete on public.packing_item_promotions
for each row execute function public.enqueue_packing_media_cleanup();

create function public.search_my_inventory(p_query text)
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
set search_path = pg_catalog
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
    from public.items items
    cross join search_pattern
    join public.boxes boxes on boxes.id = items.box_id
    join public.spaces spaces on spaces.id = boxes.space_id
    join public.venues venues on venues.id = spaces.venue_id
    where boxes.owner_id = auth.uid()
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
    from public.packing_detected_items detected
    cross join search_pattern
    join public.packing_sessions sessions
      on sessions.id = detected.session_id and sessions.current_revision = detected.analysis_revision
    join public.boxes boxes on boxes.id = detected.box_id
    join public.spaces spaces on spaces.id = boxes.space_id
    join public.venues venues on venues.id = spaces.venue_id
    where boxes.owner_id = auth.uid()
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

revoke all on table public.packing_sessions from public, anon, authenticated;
revoke all on table public.packing_photos from public, anon, authenticated;
revoke all on table public.packing_atlases from public, anon, authenticated;
revoke all on table public.packing_analysis_jobs from public, anon, authenticated;
revoke all on table public.packing_detected_items from public, anon, authenticated;
revoke all on table public.packing_detected_instances from public, anon, authenticated;
revoke all on table public.packing_detected_instance_evidence from public, anon, authenticated;
revoke all on table public.packing_item_promotions from public, anon, authenticated;

grant select on public.packing_sessions, public.packing_photos, public.packing_atlases,
  public.packing_detected_items, public.packing_detected_instances,
  public.packing_detected_instance_evidence, public.packing_item_promotions to authenticated;
grant all on public.packing_sessions, public.packing_photos, public.packing_atlases,
  public.packing_analysis_jobs, public.packing_detected_items,
  public.packing_detected_instances, public.packing_detected_instance_evidence,
  public.packing_item_promotions to service_role;

revoke all on function public.create_packing_session(uuid) from public, anon;
revoke all on function public.create_packing_photo_upload(uuid, integer, text, bigint) from public, anon;
revoke all on function public.confirm_packing_photo_upload(uuid) from public, anon;
revoke all on function public.complete_packing_session(uuid) from public, anon;
revoke all on function public.cancel_packing_session(uuid) from public, anon;
revoke all on function public.delete_packing_session(uuid) from public, anon;
revoke all on function public.create_packing_media_download(text) from public, anon;
revoke all on function public.request_packing_item_promotion(uuid) from public, anon;
revoke all on function public.update_packing_detected_item(uuid, text, text, text, public.packing_quantity_kind, integer, public.packing_review_status) from public, anon;
revoke all on function public.merge_packing_detected_items(uuid, uuid) from public, anon;
revoke all on function public.finalize_packing_item_promotion(uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.publish_packing_revision(uuid, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.request_packing_reanalysis(uuid) from public, anon;
revoke all on function public.expire_packing_photo_uploads(timestamptz) from public, anon, authenticated;
revoke all on function public.enqueue_packing_media_cleanup() from public, anon, authenticated;
revoke all on function public.search_my_inventory(text) from public, anon;
revoke all on function public.claim_packing_analysis_jobs(integer, integer) from public, anon, authenticated;
revoke all on function public.complete_packing_analysis_job(uuid, public.packing_job_stage, text, text) from public, anon, authenticated;
revoke all on function public.fail_packing_analysis_job(uuid, text, boolean) from public, anon, authenticated;

grant execute on function public.create_packing_session(uuid) to authenticated;
grant execute on function public.create_packing_photo_upload(uuid, integer, text, bigint) to authenticated;
grant execute on function public.confirm_packing_photo_upload(uuid) to authenticated;
grant execute on function public.complete_packing_session(uuid) to authenticated;
grant execute on function public.cancel_packing_session(uuid) to authenticated;
grant execute on function public.delete_packing_session(uuid) to authenticated;
grant execute on function public.create_packing_media_download(text) to authenticated;
grant execute on function public.request_packing_item_promotion(uuid) to authenticated;
grant execute on function public.update_packing_detected_item(uuid, text, text, text, public.packing_quantity_kind, integer, public.packing_review_status) to authenticated;
grant execute on function public.merge_packing_detected_items(uuid, uuid) to authenticated;
grant execute on function public.finalize_packing_item_promotion(uuid, text, bigint) to service_role;
grant execute on function public.publish_packing_revision(uuid, integer, text, text, text) to service_role;
grant execute on function public.request_packing_reanalysis(uuid) to authenticated;
grant execute on function public.search_my_inventory(text) to authenticated;
grant execute on function public.claim_packing_analysis_jobs(integer, integer) to service_role;
grant execute on function public.complete_packing_analysis_job(uuid, public.packing_job_stage, text, text) to service_role;
grant execute on function public.fail_packing_analysis_job(uuid, text, boolean) to service_role;

select cron.schedule(
  'expire-packing-photo-uploads',
  '*/10 * * * *',
  $cron$select public.expire_packing_photo_uploads(pg_catalog.now())$cron$
);

notify pgrst, 'reload schema';

-- Move packing execution to Supabase: the browser persists deterministic Atlas
-- images, Postgres owns the queue, and pg_net wakes the Edge Function.

alter table public.packing_atlases
  add column upload_status text not null default 'confirmed'
    check (upload_status in ('pending', 'confirmed')),
  add column confirmed_at timestamptz;

update public.packing_atlases
set confirmed_at = coalesce(confirmed_at, created_at)
where upload_status = 'confirmed';

create function public.create_packing_atlas_upload(
  p_session_id uuid,
  p_atlas_no integer,
  p_first_sequence_no integer,
  p_last_sequence_no integer,
  p_width integer,
  p_height integer,
  p_size_bytes bigint,
  p_sha256 text
)
returns table(atlas_id uuid, object_key text, upload_url text)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  current_session public.packing_sessions%rowtype;
  current_atlas public.packing_atlases%rowtype;
  expected_first integer;
  expected_last integer;
  confirmed_photo_count integer;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  if p_atlas_no is null or p_atlas_no not between 1 and 7
    or p_first_sequence_no is null or p_last_sequence_no is null
    or p_first_sequence_no < 1 or p_last_sequence_no > 100
    or p_first_sequence_no > p_last_sequence_no
    or p_width is null or p_width not between 512 and 4096
    or p_height is null or p_height not between 552 and 4096
    or p_size_bytes is null or p_size_bytes not between 1 and 7340032
    or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid packing atlas metadata';
  end if;

  select * into current_session from public.packing_sessions sessions
  where sessions.id = p_session_id and sessions.owner_id = caller for update;
  if not found then
    raise exception using errcode = '42501', message = 'packing session is not accessible';
  end if;
  if current_session.status not in ('capturing'::public.packing_session_status, 'uploading'::public.packing_session_status) then
    raise exception using errcode = '22023', message = 'packing session no longer accepts atlases';
  end if;
  select count(*) into confirmed_photo_count from public.packing_photos photos
  where photos.session_id = current_session.id
    and photos.upload_status = 'confirmed'::public.packing_photo_status;
  expected_first := (p_atlas_no - 1) * 16 + 1;
  expected_last := least(p_atlas_no * 16, confirmed_photo_count);
  if p_first_sequence_no <> expected_first or p_last_sequence_no <> expected_last then
    raise exception using errcode = '22023', message = 'packing atlas sequence range is invalid';
  end if;
  if not exists (
    select 1 from public.packing_photos photos
    where photos.session_id = current_session.id
      and photos.sequence_no between p_first_sequence_no and p_last_sequence_no
      and photos.upload_status = 'confirmed'::public.packing_photo_status
    having count(*) = p_last_sequence_no - p_first_sequence_no + 1
  ) then
    raise exception using errcode = '22023', message = 'packing atlas photos are incomplete';
  end if;

  select * into current_atlas from public.packing_atlases atlases
  where atlases.session_id = current_session.id
    and atlases.atlas_no = p_atlas_no
    and atlases.layout_version = 'client-grid-4x4-v1'
  for update;

  if not found then
    current_atlas.id := extensions.gen_random_uuid();
    current_atlas.object_key := 'users/' || caller || '/boxes/' || current_session.box_id
      || '/packing/' || current_session.id || '/atlas/client-' || pg_catalog.lpad(p_atlas_no::text, 3, '0') || '.webp';
    insert into public.packing_atlases (
      id, session_id, atlas_no, first_sequence_no, last_sequence_no, object_key,
      layout_version, width, height, size_bytes, sha256, upload_status, confirmed_at
    ) values (
      current_atlas.id, current_session.id, p_atlas_no, p_first_sequence_no, p_last_sequence_no,
      current_atlas.object_key, 'client-grid-4x4-v1', p_width, p_height, p_size_bytes,
      p_sha256, 'pending', null
    );
  else
    update public.packing_atlases set
      first_sequence_no = p_first_sequence_no,
      last_sequence_no = p_last_sequence_no,
      width = p_width,
      height = p_height,
      size_bytes = p_size_bytes,
      sha256 = p_sha256,
      upload_status = 'pending',
      confirmed_at = null
    where id = current_atlas.id;
  end if;

  return query select current_atlas.id, current_atlas.object_key,
    private.r2_presign_from_vault('PUT', current_atlas.object_key, 'image/webp', 300);
end;
$$;

create function public.confirm_packing_atlas_upload(p_atlas_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  update public.packing_atlases atlases set
    upload_status = 'confirmed', confirmed_at = pg_catalog.now()
  from public.packing_sessions sessions
  where atlases.id = p_atlas_id
    and sessions.id = atlases.session_id
    and sessions.owner_id = auth.uid()
    and sessions.status in ('capturing'::public.packing_session_status, 'uploading'::public.packing_session_status);
  if not found then
    raise exception using errcode = '42501', message = 'packing atlas is not confirmable';
  end if;
end;
$$;

create function private.validate_packing_atlases_before_queue()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare expected_count integer;
declare confirmed_count integer;
begin
  if new.status <> 'queued'::public.packing_session_status
    or old.status = 'queued'::public.packing_session_status then
    return new;
  end if;
  expected_count := pg_catalog.ceil(new.photo_count::numeric / 16)::integer;
  select count(*) into confirmed_count from public.packing_atlases atlases
  where atlases.session_id = new.id
    and atlases.layout_version = 'client-grid-4x4-v1'
    and atlases.upload_status = 'confirmed';
  if expected_count < 1 or confirmed_count <> expected_count then
    raise exception using errcode = '22023', message = 'all packing atlases must be uploaded before completion';
  end if;
  return new;
end;
$$;

create trigger packing_sessions_require_client_atlases
before update of status on public.packing_sessions
for each row execute function private.validate_packing_atlases_before_queue();

create function private.replace_packing_normalize_job()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.stage <> 'normalize'::public.packing_job_stage then return new; end if;
  insert into public.packing_analysis_jobs (session_id, stage, scope_key, input_fingerprint)
  select new.session_id, 'observe'::public.packing_job_stage,
    'atlas:' || atlases.atlas_no,
    pg_catalog.left(new.input_fingerprint || ':' || atlases.id, 128)
  from public.packing_atlases atlases
  where atlases.session_id = new.session_id
    and atlases.layout_version = 'client-grid-4x4-v1'
    and atlases.upload_status = 'confirmed'
  order by atlases.atlas_no
  on conflict do nothing;
  if not found then
    raise exception using errcode = '22023', message = 'packing atlases are missing';
  end if;
  return null;
end;
$$;

create trigger packing_jobs_replace_normalize
before insert on public.packing_analysis_jobs
for each row execute function private.replace_packing_normalize_job();

create function public.create_packing_service_media_url(
  p_method text,
  p_object_key text,
  p_content_type text default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role is required';
  end if;
  if p_method not in ('GET', 'PUT')
    or p_object_key is null
    or p_object_key !~ '^users/[0-9a-f-]+/boxes/[0-9a-f-]+/(packing/[0-9a-f-]+/|item/[0-9a-f-]+\.webp$)'
    or (p_method = 'PUT' and p_content_type <> 'image/webp')
    or (p_method = 'GET' and p_content_type is not null) then
    raise exception using errcode = '22023', message = 'invalid packing service media request';
  end if;
  return private.r2_presign_from_vault(p_method, p_object_key, p_content_type, 600);
end;
$$;

create function private.invoke_packing_edge_function()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare function_url text;
declare function_secret text;
begin
  select secrets.decrypted_secret into function_url
  from vault.decrypted_secrets secrets where secrets.name = 'packing_function_url';
  select secrets.decrypted_secret into function_secret
  from vault.decrypted_secrets secrets where secrets.name = 'packing_function_secret';
  if function_url is null or function_secret is null then return null; end if;
  return net.http_post(
    url := function_url,
    headers := pg_catalog.jsonb_build_object(
      'Content-Type', 'application/json',
      'x-packing-secret', function_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

create function private.wake_packing_edge_function()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform private.invoke_packing_edge_function();
  return new;
end;
$$;

create trigger packing_sessions_wake_edge_function
after update of status on public.packing_sessions
for each row
when (new.status = 'queued'::public.packing_session_status and old.status is distinct from new.status)
execute function private.wake_packing_edge_function();

select cron.schedule(
  'invoke-packing-edge-function',
  '* * * * *',
  $cron$select private.invoke_packing_edge_function()$cron$
);

revoke all on function public.create_packing_atlas_upload(uuid, integer, integer, integer, integer, integer, bigint, text) from public, anon;
revoke all on function public.confirm_packing_atlas_upload(uuid) from public, anon;
revoke all on function public.create_packing_service_media_url(text, text, text) from public, anon, authenticated;
revoke all on function private.validate_packing_atlases_before_queue() from public, anon, authenticated, service_role;
revoke all on function private.replace_packing_normalize_job() from public, anon, authenticated, service_role;
revoke all on function private.invoke_packing_edge_function() from public, anon, authenticated, service_role;
revoke all on function private.wake_packing_edge_function() from public, anon, authenticated, service_role;

grant execute on function public.create_packing_atlas_upload(uuid, integer, integer, integer, integer, integer, bigint, text) to authenticated;
grant execute on function public.confirm_packing_atlas_upload(uuid) to authenticated;
grant execute on function public.create_packing_service_media_url(text, text, text) to service_role;

notify pgrst, 'reload schema';

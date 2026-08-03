-- Failed or removed uploads can leave valid gaps in packing photo sequence
-- numbers. Atlas ranges follow the ordered confirmed photos, not a synthetic
-- contiguous 1..N range.

create or replace function public.create_packing_atlas_upload(
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
  expected_group_count integer;
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

  select min(grouped.sequence_no), max(grouped.sequence_no), count(*)::integer
  into expected_first, expected_last, expected_group_count
  from (
    select photos.sequence_no
    from public.packing_photos photos
    where photos.session_id = current_session.id
      and photos.upload_status = 'confirmed'::public.packing_photo_status
    order by photos.sequence_no
    offset (p_atlas_no - 1) * 16
    limit 16
  ) grouped;
  if expected_group_count < 1
    or p_first_sequence_no <> expected_first
    or p_last_sequence_no <> expected_last then
    raise exception using errcode = '22023', message = 'packing atlas sequence range is invalid';
  end if;
  if (
    select count(*)::integer
    from public.packing_photos photos
    where photos.session_id = current_session.id
      and photos.upload_status = 'confirmed'::public.packing_photo_status
      and photos.sequence_no between p_first_sequence_no and p_last_sequence_no
  ) <> expected_group_count then
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
      || '/packing/' || current_session.id || '/atlas/client-' || pg_catalog.lpad(p_atlas_no::text, 3, '0') || '.jpg';
    insert into public.packing_atlases (
      id, session_id, atlas_no, first_sequence_no, last_sequence_no, object_key,
      layout_version, width, height, size_bytes, sha256, upload_status, confirmed_at
    ) values (
      current_atlas.id, current_session.id, p_atlas_no, p_first_sequence_no, p_last_sequence_no,
      current_atlas.object_key, 'client-grid-4x4-v1', p_width, p_height, p_size_bytes,
      p_sha256, 'pending', null
    );
  else
    current_atlas.object_key := pg_catalog.regexp_replace(current_atlas.object_key, '\.webp$', '.jpg');
    update public.packing_atlases set
      first_sequence_no = p_first_sequence_no,
      last_sequence_no = p_last_sequence_no,
      object_key = current_atlas.object_key,
      width = p_width,
      height = p_height,
      size_bytes = p_size_bytes,
      sha256 = p_sha256,
      upload_status = 'pending',
      confirmed_at = null
    where id = current_atlas.id;
  end if;

  return query select current_atlas.id, current_atlas.object_key,
    private.r2_presign_from_vault('PUT', current_atlas.object_key, 'image/jpeg', 300);
end;
$$;

comment on function public.create_packing_atlas_upload(uuid, integer, integer, integer, integer, integer, bigint, text)
is 'Creates an Atlas JPEG upload using the actual ordered confirmed photo sequence range.';

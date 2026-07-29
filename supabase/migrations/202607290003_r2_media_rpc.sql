-- R2 credentials are stored in Supabase Vault under these exact names:
-- r2_account_id, r2_bucket_name, r2_access_key_id, r2_secret_access_key.
create extension if not exists supabase_vault with schema vault;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

create function private.aws_uri_encode(p_value text, p_encode_slash boolean default true)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  encoded bytea := pg_catalog.convert_to(p_value, 'UTF8');
  result text := '';
  index integer;
  octet integer;
begin
  for index in 0..pg_catalog.length(encoded) - 1 loop
    octet := pg_catalog.get_byte(encoded, index);
    if (octet between 65 and 90)
      or (octet between 97 and 122)
      or (octet between 48 and 57)
      or octet in (45, 46, 95, 126)
      or (octet = 47 and not p_encode_slash) then
      result := result || pg_catalog.chr(octet);
    else
      result := result || '%' || pg_catalog.upper(pg_catalog.lpad(pg_catalog.to_hex(octet), 2, '0'));
    end if;
  end loop;

  return result;
end;
$$;

create function private.hmac_sha256(p_key bytea, p_message text)
returns bytea
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select extensions.hmac(p_message, p_key, 'sha256');
$$;

create function private.sha256_hex(p_value text)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select pg_catalog.encode(extensions.digest(p_value, 'sha256'), 'hex');
$$;

create function private.r2_presign_with_credentials(
  p_method text,
  p_account_id text,
  p_access_key_id text,
  p_secret_access_key text,
  p_bucket text,
  p_object_key text,
  p_content_type text,
  p_expires integer,
  p_now timestamptz
)
returns text
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
declare
  method text := pg_catalog.upper(p_method);
  host text;
  canonical_uri text;
  amz_date text;
  date_stamp text;
  credential_scope text;
  signed_headers text;
  canonical_headers text;
  canonical_query text;
  canonical_request text;
  string_to_sign text;
  signing_key bytea;
  signature text;
begin
  if method is null or method not in ('GET', 'PUT', 'DELETE') then
    raise exception using errcode = '22023', message = 'R2 presign method must be GET, PUT, or DELETE';
  end if;

  if p_expires is null or p_expires not between 1 and 3600 then
    raise exception using errcode = '22023', message = 'R2 presign expiry must be between 1 and 3600 seconds';
  end if;

  if p_account_id is null or p_account_id = ''
    or p_access_key_id is null or p_access_key_id = ''
    or p_secret_access_key is null or p_secret_access_key = ''
    or p_bucket is null or p_bucket = ''
    or p_object_key is null or p_object_key = ''
    or p_now is null then
    raise exception using errcode = '22023', message = 'R2 presign inputs must not be empty';
  end if;

  if p_object_key like '/%' or p_object_key like '%/' or p_object_key like '%/./%' or p_object_key = '.' or p_object_key like '../%' or p_object_key like '%/..' or p_object_key like '%/../%' then
    raise exception using errcode = '22023', message = 'R2 object key must be a normalized relative key';
  end if;

  if method = 'PUT' then
    if p_content_type is null or p_content_type = '' or p_content_type <> pg_catalog.btrim(p_content_type) or p_content_type ~ E'[\\r\\n]' then
      raise exception using errcode = '22023', message = 'PUT requires an exact single-line content type';
    end if;
  elsif p_content_type is not null then
    raise exception using errcode = '22023', message = 'content type is only signed for PUT';
  end if;

  host := p_account_id || '.r2.cloudflarestorage.com';
  canonical_uri := '/' || private.aws_uri_encode(p_bucket, true) || '/' || private.aws_uri_encode(p_object_key, false);
  amz_date := pg_catalog.to_char(p_now at time zone 'UTC', 'YYYYMMDD"T"HH24MISS"Z"');
  date_stamp := pg_catalog.to_char(p_now at time zone 'UTC', 'YYYYMMDD');
  credential_scope := date_stamp || '/auto/s3/aws4_request';

  if method = 'PUT' then
    signed_headers := 'content-type;host';
    canonical_headers := 'content-type:' || p_content_type || E'\n' || 'host:' || host || E'\n';
  else
    signed_headers := 'host';
    canonical_headers := 'host:' || host || E'\n';
  end if;

  select pg_catalog.string_agg(
    private.aws_uri_encode(name, true) || '=' || private.aws_uri_encode(value, true),
    '&' order by private.aws_uri_encode(name, true), private.aws_uri_encode(value, true)
  )
  into canonical_query
  from (values
    ('X-Amz-Algorithm'::text, 'AWS4-HMAC-SHA256'::text),
    ('X-Amz-Credential'::text, p_access_key_id || '/' || credential_scope),
    ('X-Amz-Date'::text, amz_date),
    ('X-Amz-Expires'::text, p_expires::text),
    ('X-Amz-SignedHeaders'::text, signed_headers)
  ) as query_parameters(name, value);

  canonical_request := method || E'\n' || canonical_uri || E'\n' || canonical_query || E'\n'
    || canonical_headers || E'\n' || signed_headers || E'\nUNSIGNED-PAYLOAD';
  string_to_sign := 'AWS4-HMAC-SHA256' || E'\n' || amz_date || E'\n' || credential_scope || E'\n'
    || private.sha256_hex(canonical_request);
  signing_key := private.hmac_sha256(
    private.hmac_sha256(
      private.hmac_sha256(
        private.hmac_sha256(pg_catalog.convert_to('AWS4' || p_secret_access_key, 'UTF8'), date_stamp),
        'auto'
      ),
      's3'
    ),
    'aws4_request'
  );
  signature := pg_catalog.encode(private.hmac_sha256(signing_key, string_to_sign), 'hex');

  return 'https://' || host || canonical_uri || '?' || canonical_query || '&X-Amz-Signature=' || signature;
end;
$$;

create function private.r2_vault_secret(p_name text)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
declare
  secret_value text;
begin
  select secrets.decrypted_secret
  into secret_value
  from vault.decrypted_secrets as secrets
  where secrets.name = p_name;

  if secret_value is null or secret_value = '' then
    raise exception using errcode = '22023', message = 'required R2 Vault secret is missing';
  end if;

  return secret_value;
end;
$$;

create function private.r2_presign_from_vault(
  p_method text,
  p_object_key text,
  p_content_type text default null,
  p_expires integer default 900
)
returns text
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select private.r2_presign_with_credentials(
    p_method,
    private.r2_vault_secret('r2_account_id'),
    private.r2_vault_secret('r2_access_key_id'),
    private.r2_vault_secret('r2_secret_access_key'),
    private.r2_vault_secret('r2_bucket_name'),
    p_object_key,
    p_content_type,
    p_expires,
    pg_catalog.now()
  );
$$;

revoke all on function private.aws_uri_encode(text, boolean) from public, anon, authenticated, service_role;
revoke all on function private.hmac_sha256(bytea, text) from public, anon, authenticated, service_role;
revoke all on function private.sha256_hex(text) from public, anon, authenticated, service_role;
revoke all on function private.r2_presign_with_credentials(text, text, text, text, text, text, text, integer, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.r2_vault_secret(text) from public, anon, authenticated, service_role;
revoke all on function private.r2_presign_from_vault(text, text, text, integer) from public, anon, authenticated, service_role;

create function public.create_media_upload(
  p_box_id uuid,
  p_item_id uuid,
  p_media_kind public.media_kind,
  p_mime_type text,
  p_size_bytes bigint
)
returns table(upload_id uuid, object_key text, upload_url text)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  new_upload_id uuid := extensions.gen_random_uuid();
  file_extension text;
  new_object_key text;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  if p_media_kind is null
    or p_mime_type is null
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_size_bytes is null
    or p_size_bytes not between 1 and 5242880 then
    raise exception using errcode = '22023', message = 'invalid media metadata';
  end if;

  if not exists (
    select 1
    from public.boxes as boxes
    where boxes.id = p_box_id
      and boxes.owner_id = caller
  ) then
    raise exception using errcode = '42501', message = 'media target is not accessible';
  end if;

  if (p_media_kind = 'cover'::public.media_kind and p_item_id is not null)
    or (p_media_kind = 'item'::public.media_kind and p_item_id is null)
    or (p_media_kind = 'item'::public.media_kind and not exists (
      select 1
      from public.items as items
      where items.id = p_item_id
        and items.box_id = p_box_id
    )) then
    raise exception using errcode = '22023', message = 'invalid media target';
  end if;

  file_extension := case p_mime_type
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
  end;
  new_object_key := 'users/' || caller || '/boxes/' || p_box_id || '/'
    || p_media_kind::text || '/' || extensions.gen_random_uuid() || '.' || file_extension;

  insert into public.media_uploads (
    id,
    owner_id,
    box_id,
    item_id,
    media_kind,
    object_key,
    mime_type,
    size_bytes,
    status,
    expires_at
  )
  values (
    new_upload_id,
    caller,
    p_box_id,
    p_item_id,
    p_media_kind,
    new_object_key,
    p_mime_type,
    p_size_bytes,
    'pending'::public.media_upload_status,
    pg_catalog.now() + interval '5 minutes'
  );

  return query
  select
    new_upload_id,
    new_object_key,
    private.r2_presign_from_vault('PUT', new_object_key, p_mime_type, 300);
end;
$$;

create function public.confirm_media_upload(p_upload_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  upload_session public.media_uploads%rowtype;
  rows_updated integer;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  select *
  into upload_session
  from public.media_uploads as media_uploads
  where media_uploads.id = p_upload_id
  for update;

  if not found or upload_session.owner_id is distinct from caller then
    raise exception using errcode = '42501', message = 'media upload is not accessible';
  end if;

  if upload_session.status <> 'pending'::public.media_upload_status
    or upload_session.expires_at <= pg_catalog.now() then
    raise exception using errcode = '22023', message = 'media upload is no longer confirmable';
  end if;

  if upload_session.media_kind = 'cover'::public.media_kind then
    update public.boxes
    set
      cover_object_key = upload_session.object_key,
      cover_mime_type = upload_session.mime_type,
      cover_size_bytes = upload_session.size_bytes
    where id = upload_session.box_id
      and owner_id = caller;
  else
    update public.items
    set
      image_object_key = upload_session.object_key,
      image_mime_type = upload_session.mime_type,
      image_size_bytes = upload_session.size_bytes
    where id = upload_session.item_id
      and box_id = upload_session.box_id
      and exists (
        select 1
        from public.boxes as boxes
        where boxes.id = public.items.box_id
          and boxes.owner_id = caller
      );
  end if;

  get diagnostics rows_updated = row_count;
  if rows_updated <> 1 then
    raise exception using errcode = '42501', message = 'media upload is not accessible';
  end if;

  update public.media_uploads
  set
    status = 'confirmed'::public.media_upload_status,
    confirmed_at = pg_catalog.now()
  where id = upload_session.id
    and status = 'pending'::public.media_upload_status;

  get diagnostics rows_updated = row_count;
  if rows_updated <> 1 then
    raise exception using errcode = '22023', message = 'media upload is no longer confirmable';
  end if;
end;
$$;

create function public.create_media_download(p_object_key text)
returns table(download_url text, expires_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  signed_expires_at timestamptz := pg_catalog.now() + interval '5 minutes';
begin
  if not exists (
    select 1
    from public.boxes as boxes
    where boxes.cover_object_key = p_object_key
      and (
        boxes.visibility = 'public'::public.box_visibility
        or boxes.owner_id = caller
      )

    union all

    select 1
    from public.items as items
    join public.boxes as boxes on boxes.id = items.box_id
    where items.image_object_key = p_object_key
      and (
        boxes.visibility = 'public'::public.box_visibility
        or boxes.owner_id = caller
      )
  ) then
    raise exception using errcode = '42501', message = 'media object is not accessible';
  end if;

  return query
  select
    private.r2_presign_from_vault('GET', p_object_key, null, 300),
    signed_expires_at;
end;
$$;

revoke insert, update on table public.boxes from public, anon, authenticated;
revoke insert, update on table public.items from public, anon, authenticated;

grant insert (owner_id, space_id, name, category, location, description, visibility)
on table public.boxes to authenticated;
grant update (space_id, name, category, location, description, visibility)
on table public.boxes to authenticated;
grant insert (box_id, name, category, quantity, description)
on table public.items to authenticated;
grant update (box_id, name, category, quantity, description)
on table public.items to authenticated;

revoke all on table public.media_uploads from public, anon, authenticated;
revoke all on table public.media_cleanup_jobs from public, anon, authenticated;

revoke all on function public.create_media_upload(uuid, uuid, public.media_kind, text, bigint)
from public, anon, authenticated;
revoke all on function public.confirm_media_upload(uuid)
from public, anon, authenticated;
revoke all on function public.create_media_download(text)
from public, anon, authenticated;

grant execute on function public.create_media_upload(uuid, uuid, public.media_kind, text, bigint)
to authenticated;
grant execute on function public.confirm_media_upload(uuid)
to authenticated;
grant execute on function public.create_media_download(text)
to anon, authenticated;

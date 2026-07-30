create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_object_key text,
  locale text not null default 'zh-CN' check (locale in ('zh-CN', 'en-US')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_avatar_uploads (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  object_key text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  status public.media_upload_status not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.profile_avatar_uploads enable row level security;
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.create_profile_avatar_upload(p_mime_type text, p_size_bytes bigint)
returns table(upload_id uuid, object_key text, upload_url text)
language plpgsql security definer set search_path = pg_catalog, public, private
as $$
declare
  caller uuid := auth.uid();
  new_id uuid := extensions.gen_random_uuid();
  extension text;
  new_key text;
begin
  if caller is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') or p_size_bytes not between 1 and 5242880 then
    raise exception using errcode = '22023', message = 'invalid avatar metadata';
  end if;
  extension := case p_mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else 'webp' end;
  new_key := 'users/' || caller || '/profile/avatar/' || extensions.gen_random_uuid() || '.' || extension;
  insert into public.profiles (id) values (caller) on conflict (id) do nothing;
  insert into public.profile_avatar_uploads (id, owner_id, object_key, mime_type, size_bytes, expires_at)
  values (new_id, caller, new_key, p_mime_type, p_size_bytes, pg_catalog.now() + interval '5 minutes');
  return query select new_id, new_key, private.r2_presign_from_vault('PUT', new_key, p_mime_type, 300);
end;
$$;

create or replace function public.confirm_profile_avatar_upload(p_upload_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  upload public.profile_avatar_uploads%rowtype;
begin
  select * into upload from public.profile_avatar_uploads where id = p_upload_id and owner_id = caller for update;
  if not found or upload.status <> 'pending' or upload.expires_at <= pg_catalog.now() then
    raise exception using errcode = '22023', message = 'avatar upload is no longer confirmable';
  end if;
  insert into public.profiles (id, avatar_object_key, updated_at) values (caller, upload.object_key, pg_catalog.now())
  on conflict (id) do update set avatar_object_key = excluded.avatar_object_key, updated_at = excluded.updated_at;
  update public.profile_avatar_uploads set status = 'confirmed', confirmed_at = pg_catalog.now() where id = upload.id;
end;
$$;

create or replace function public.create_profile_avatar_download()
returns table(download_url text, expires_at timestamptz)
language plpgsql security definer set search_path = pg_catalog, public, private
as $$
declare key text; expiry timestamptz := pg_catalog.now() + interval '5 minutes';
begin
  select avatar_object_key into key from public.profiles where id = auth.uid();
  if key is null then return; end if;
  return query select private.r2_presign_from_vault('GET', key, null, 300), expiry;
end;
$$;

create or replace function public.update_profile_locale(p_locale text)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if p_locale not in ('zh-CN', 'en-US') then raise exception using errcode = '22023', message = 'unsupported locale'; end if;
  insert into public.profiles (id, locale, updated_at) values (auth.uid(), p_locale, pg_catalog.now())
  on conflict (id) do update set locale = excluded.locale, updated_at = excluded.updated_at;
end;
$$;

revoke all on table public.profile_avatar_uploads from public, anon, authenticated;
grant select on table public.profiles to authenticated;
revoke all on function public.create_profile_avatar_upload(text, bigint), public.confirm_profile_avatar_upload(uuid), public.create_profile_avatar_download(), public.update_profile_locale(text) from public, anon, authenticated;
grant execute on function public.create_profile_avatar_upload(text, bigint), public.confirm_profile_avatar_upload(uuid), public.create_profile_avatar_download(), public.update_profile_locale(text) to authenticated;

create extension if not exists pgcrypto with schema extensions;

create type public.box_visibility as enum ('public', 'private');
create type public.audit_action as enum ('create', 'update', 'delete');
create type public.audit_entity as enum ('space', 'box', 'item');
create type public.media_kind as enum ('cover', 'item');
create type public.media_upload_status as enum ('pending', 'confirmed', 'expired');
create type public.cleanup_status as enum ('pending', 'processing', 'completed', 'failed');

create sequence public.box_code_seq;

create function public.assign_box_identifiers()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.public_id := gen_random_uuid();
  new.box_code := 'BX-' || lpad(nextval('public.box_code_seq')::text, 5, '0');
  return new;
end;
$$;

create function public.prevent_box_identifier_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.public_id is distinct from old.public_id then
    raise exception using
      errcode = '22023',
      message = 'boxes.public_id is immutable';
  end if;

  if new.box_code is distinct from old.box_code then
    raise exception using
      errcode = '22023',
      message = 'boxes.box_code is immutable';
  end if;

  return new;
end;
$$;

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boxes (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique,
  box_code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text check (category is null or char_length(category) <= 80),
  location text check (location is null or char_length(location) <= 200),
  description text check (description is null or char_length(description) <= 1000),
  visibility public.box_visibility not null default 'private',
  cover_object_key text,
  cover_mime_type text constraint boxes_cover_mime_type_check
    check (cover_mime_type is null or cover_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  cover_size_bytes bigint check (cover_size_bytes is null or cover_size_bytes > 0),
  constraint boxes_cover_media_metadata_check
    check (num_nonnulls(cover_object_key, cover_mime_type, cover_size_bytes) in (0, 3)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger boxes_assign_identifiers
before insert on public.boxes
for each row execute function public.assign_box_identifiers();

create trigger boxes_prevent_identifier_update
before update on public.boxes
for each row execute function public.prevent_box_identifier_update();

create table public.items (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.boxes(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text check (category is null or char_length(category) <= 80),
  quantity integer not null default 1 check (quantity > 0),
  description text check (description is null or char_length(description) <= 1000),
  image_object_key text,
  image_mime_type text constraint items_image_mime_type_check
    check (image_mime_type is null or image_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  image_size_bytes bigint check (image_size_bytes is null or image_size_bytes > 0),
  constraint items_image_media_metadata_check
    check (num_nonnulls(image_object_key, image_mime_type, image_size_bytes) in (0, 3)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_id_box_id_key unique (id, box_id)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  box_id uuid references public.boxes(id) on delete set null,
  action public.audit_action not null,
  entity_type public.audit_entity not null,
  entity_id uuid not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.media_uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  box_id uuid not null references public.boxes(id) on delete cascade,
  item_id uuid,
  media_kind public.media_kind not null,
  object_key text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  status public.media_upload_status not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint media_uploads_item_box_fkey
    foreign key (item_id, box_id) references public.items(id, box_id) on delete cascade,
  check (
    (media_kind = 'cover' and item_id is null)
    or (media_kind = 'item' and item_id is not null)
  )
);

create table public.media_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  object_key text not null unique,
  attempts integer not null default 0 check (attempts >= 0),
  status public.cleanup_status not null default 'pending',
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index boxes_owner_id_idx on public.boxes(owner_id);
create index boxes_space_id_idx on public.boxes(space_id);
create index items_box_id_idx on public.items(box_id);
create index media_uploads_expiry_idx on public.media_uploads(status, expires_at);
create index cleanup_jobs_due_idx on public.media_cleanup_jobs(status, next_attempt_at);

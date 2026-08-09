create table public.venue_members (
  venue_id uuid not null references public.venues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default pg_catalog.now(),
  primary key (venue_id, user_id)
);

create table public.venue_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_by uuid not null,
  token_hash bytea not null unique check (pg_catalog.octet_length(token_hash) = 32),
  created_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null,
  accepted_by uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  check ((accepted_by is null) = (accepted_at is null)),
  check (accepted_at is null or revoked_at is null)
);

create index venue_members_user_id_idx on public.venue_members(user_id, venue_id);
create index venue_invites_active_idx on public.venue_invites(venue_id, expires_at)
where accepted_at is null and revoked_at is null;

create table private.venue_membership_audit (
  id uuid primary key default extensions.gen_random_uuid(),
  venue_id uuid not null,
  actor_id uuid,
  subject_user_id uuid,
  event_code text not null check (event_code in (
    'invite_created', 'invite_revoked', 'member_joined', 'member_removed', 'member_left'
  )),
  created_at timestamptz not null default pg_catalog.now()
);

alter table public.venue_members enable row level security;
alter table public.venue_invites enable row level security;
alter table private.venue_membership_audit enable row level security;

revoke all on table public.venue_members from public, anon, authenticated, service_role;
revoke all on table public.venue_invites from public, anon, authenticated, service_role;
revoke all on table private.venue_membership_audit from public, anon, authenticated, service_role;

create function private.reject_venue_owner_membership()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if exists (
    select 1
    from public.venues as venues
    where venues.id = new.venue_id
      and venues.owner_id = new.user_id
  ) then
    raise exception using errcode = '22023', message = 'venue_owner_cannot_be_member';
  end if;
  return new;
end;
$$;

create trigger venue_members_reject_owner
before insert or update of venue_id, user_id on public.venue_members
for each row execute function private.reject_venue_owner_membership();

create function public.is_venue_owner(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.venues as venues
    where venues.id = p_venue_id
      and venues.owner_id = auth.uid()
  );
$$;

create function public.is_venue_member(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.venue_members as members
    where members.venue_id = p_venue_id
      and members.user_id = auth.uid()
  );
$$;

create function public.can_access_venue(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select public.is_venue_owner(p_venue_id) or public.is_venue_member(p_venue_id);
$$;

create function public.can_edit_venue_content(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select public.can_access_venue(p_venue_id);
$$;

drop policy venues_select_own on public.venues;
create policy venues_select_accessible on public.venues
for select to authenticated
using (public.can_access_venue(id));

create function public.get_venue_access_summary(p_venue_id uuid)
returns table (
  venue_id uuid,
  role text,
  can_manage_members boolean,
  can_delete_venue boolean,
  can_delete_space boolean,
  can_delete_box boolean,
  can_change_box_visibility boolean,
  can_use_ai boolean,
  member_count integer,
  max_members integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  caller_is_owner boolean := public.is_venue_owner(p_venue_id);
begin
  if not caller_is_owner and not public.is_venue_member(p_venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;

  return query
  select
    p_venue_id,
    case when caller_is_owner then 'owner' else 'member' end,
    caller_is_owner,
    caller_is_owner,
    caller_is_owner,
    caller_is_owner,
    caller_is_owner,
    true,
    1 + (select count(*)::integer from public.venue_members as members where members.venue_id = p_venue_id),
    5;
end;
$$;

create function public.list_accessible_venues()
returns table (
  id uuid,
  owner_id uuid,
  name text,
  description text,
  is_default boolean,
  role text,
  owner_display_name text,
  space_count integer,
  member_count integer,
  max_members integer
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    venues.id,
    venues.owner_id,
    venues.name,
    venues.description,
    venues.is_default,
    case when venues.owner_id = auth.uid() then 'owner' else 'member' end,
    profiles.display_name,
    (select count(*)::integer from public.spaces as spaces where spaces.venue_id = venues.id),
    1 + (select count(*)::integer from public.venue_members as members where members.venue_id = venues.id),
    5
  from public.venues as venues
  left join public.profiles as profiles on profiles.id = venues.owner_id
  where venues.owner_id = auth.uid()
     or exists (
       select 1
       from public.venue_members as members
       where members.venue_id = venues.id
         and members.user_id = auth.uid()
     )
  order by venues.is_default desc, venues.created_at, venues.id;
$$;

create function public.list_venue_members(p_venue_id uuid)
returns table (
  user_id uuid,
  role text,
  display_name text,
  avatar_url text,
  joined_at timestamptz,
  is_current boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if not public.can_access_venue(p_venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;

  return query
  select
    member_rows.user_id,
    member_rows.role,
    profiles.display_name,
    case
      when profiles.avatar_object_key is null then null
      else private.r2_presign_from_vault('GET', profiles.avatar_object_key, null, 300)
    end,
    member_rows.joined_at,
    member_rows.user_id = auth.uid()
  from (
    select venues.owner_id as user_id, 'owner'::text as role, venues.created_at as joined_at
    from public.venues as venues
    where venues.id = p_venue_id
    union all
    select members.user_id, 'member'::text, members.joined_at
    from public.venue_members as members
    where members.venue_id = p_venue_id
  ) as member_rows
  left join public.profiles as profiles on profiles.id = member_rows.user_id
  order by case member_rows.role when 'owner' then 0 else 1 end, member_rows.joined_at, member_rows.user_id;
end;
$$;

create function public.create_venue_invite(p_venue_id uuid)
returns table (
  invite_id uuid,
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  new_token text;
  new_invite_id uuid := extensions.gen_random_uuid();
  new_expires_at timestamptz := pg_catalog.now() + interval '24 hours';
  occupied_seats integer;
begin
  if caller is null or not public.is_venue_owner(p_venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('venue-members:' || p_venue_id::text, 0)
  );

  select
    1
    + (select count(*)::integer from public.venue_members as members where members.venue_id = p_venue_id)
    + (select count(*)::integer from public.venue_invites as invites
       where invites.venue_id = p_venue_id
         and invites.accepted_at is null
         and invites.revoked_at is null
         and invites.expires_at > pg_catalog.now())
  into occupied_seats;

  if occupied_seats >= 5 then
    raise exception using errcode = 'P0001', message = 'venue_member_limit_reached';
  end if;

  new_token := pg_catalog.rtrim(
    pg_catalog.replace(
      pg_catalog.replace(pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'),
      '/', '_'
    ),
    '='
  );

  insert into public.venue_invites (id, venue_id, created_by, token_hash, expires_at)
  values (new_invite_id, p_venue_id, caller, extensions.digest(new_token, 'sha256'), new_expires_at);
  insert into private.venue_membership_audit (venue_id, actor_id, event_code)
  values (p_venue_id, caller, 'invite_created');

  return query select new_invite_id, new_token, new_expires_at;
end;
$$;

create function public.inspect_venue_invite(p_token text)
returns table (
  venue_id uuid,
  venue_name text,
  owner_display_name text,
  status text,
  expires_at timestamptz,
  current_user_state text
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  invite public.venue_invites%rowtype;
  caller uuid := auth.uid();
  current_state text;
  invite_status text;
begin
  select * into invite
  from public.venue_invites as invites
  where invites.token_hash = extensions.digest(p_token, 'sha256');

  if not found then
    return query select null::uuid, null::text, null::text, 'missing'::text, null::timestamptz,
      case when caller is null then 'anonymous'::text else 'eligible'::text end;
    return;
  end if;

  current_state := case
    when caller is null then 'anonymous'
    when public.is_venue_owner(invite.venue_id) then 'owner'
    when public.is_venue_member(invite.venue_id) then 'member'
    else 'eligible'
  end;
  invite_status := case
    when invite.accepted_at is not null then 'used'
    when invite.revoked_at is not null then 'revoked'
    when invite.expires_at <= pg_catalog.now() then 'expired'
    when 1 + (select count(*)::integer from public.venue_members as members where members.venue_id = invite.venue_id) >= 5 then 'full'
    else 'active'
  end;

  return query
  select invite.venue_id, venues.name, profiles.display_name, invite_status, invite.expires_at, current_state
  from public.venues as venues
  left join public.profiles as profiles on profiles.id = venues.owner_id
  where venues.id = invite.venue_id;
end;
$$;

create function public.accept_venue_invite(p_token text)
returns table (
  venue_id uuid,
  result text
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  invite public.venue_invites%rowtype;
  member_count integer;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  select * into invite
  from public.venue_invites as invites
  where invites.token_hash = extensions.digest(p_token, 'sha256')
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'venue_invite_missing';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('venue-members:' || invite.venue_id::text, 0)
  );

  if public.is_venue_member(invite.venue_id) then
    return query select invite.venue_id, 'already_member'::text;
    return;
  end if;
  if invite.accepted_at is not null then
    raise exception using errcode = 'P0001', message = 'venue_invite_used';
  end if;
  if invite.revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'venue_invite_revoked';
  end if;
  if invite.expires_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'venue_invite_expired';
  end if;
  if public.is_venue_owner(invite.venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_owner_cannot_join';
  end if;

  select count(*)::integer into member_count
  from public.venue_members as members
  where members.venue_id = invite.venue_id;
  if 1 + member_count >= 5 then
    raise exception using errcode = 'P0001', message = 'venue_member_limit_reached';
  end if;

  insert into public.venue_members (venue_id, user_id, invited_by)
  values (invite.venue_id, caller, invite.created_by);
  update public.venue_invites
  set accepted_by = caller, accepted_at = pg_catalog.now()
  where id = invite.id;
  insert into private.venue_membership_audit (venue_id, actor_id, subject_user_id, event_code)
  values (invite.venue_id, caller, caller, 'member_joined');

  return query select invite.venue_id, 'joined'::text;
end;
$$;

create function public.list_venue_invites(p_venue_id uuid)
returns table (
  invite_id uuid,
  created_at timestamptz,
  expires_at timestamptz,
  status text
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if not public.is_venue_owner(p_venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;

  return query
  select
    invites.id,
    invites.created_at,
    invites.expires_at,
    case
      when invites.accepted_at is not null then 'used'
      when invites.revoked_at is not null then 'revoked'
      when invites.expires_at <= pg_catalog.now() then 'expired'
      else 'active'
    end
  from public.venue_invites as invites
  where invites.venue_id = p_venue_id
  order by invites.created_at desc, invites.id;
end;
$$;

create function public.revoke_venue_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  invite public.venue_invites%rowtype;
begin
  select * into invite
  from public.venue_invites as invites
  where invites.id = p_invite_id
  for update;

  if not found or not public.is_venue_owner(invite.venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;
  if invite.accepted_at is not null then
    raise exception using errcode = 'P0001', message = 'venue_invite_used';
  end if;
  if invite.revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'venue_invite_revoked';
  end if;

  update public.venue_invites
  set revoked_at = pg_catalog.now()
  where id = invite.id;
  insert into private.venue_membership_audit (venue_id, actor_id, event_code)
  values (invite.venue_id, caller, 'invite_revoked');
end;
$$;

create function public.remove_venue_member(p_venue_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
begin
  if not public.is_venue_owner(p_venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;
  if p_user_id = caller then
    raise exception using errcode = 'P0001', message = 'venue_owner_cannot_remove';
  end if;

  delete from public.venue_members as members
  where members.venue_id = p_venue_id
    and members.user_id = p_user_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'venue_member_not_found';
  end if;
  insert into private.venue_membership_audit (venue_id, actor_id, subject_user_id, event_code)
  values (p_venue_id, caller, p_user_id, 'member_removed');
end;
$$;

create function public.leave_venue(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
begin
  if public.is_venue_owner(p_venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_owner_cannot_leave';
  end if;

  delete from public.venue_members as members
  where members.venue_id = p_venue_id
    and members.user_id = caller;
  if not found then
    raise exception using errcode = 'P0001', message = 'venue_member_not_found';
  end if;
  insert into private.venue_membership_audit (venue_id, actor_id, subject_user_id, event_code)
  values (p_venue_id, caller, caller, 'member_left');
end;
$$;

revoke all on function private.reject_venue_owner_membership() from public, anon, authenticated, service_role;
revoke all on function public.is_venue_owner(uuid) from public, anon, authenticated, service_role;
revoke all on function public.is_venue_member(uuid) from public, anon, authenticated, service_role;
revoke all on function public.can_access_venue(uuid) from public, anon, authenticated, service_role;
revoke all on function public.can_edit_venue_content(uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_venue_access_summary(uuid) from public, anon, authenticated, service_role;
revoke all on function public.list_accessible_venues() from public, anon, authenticated, service_role;
revoke all on function public.list_venue_members(uuid) from public, anon, authenticated, service_role;
revoke all on function public.create_venue_invite(uuid) from public, anon, authenticated, service_role;
revoke all on function public.inspect_venue_invite(text) from public, anon, authenticated, service_role;
revoke all on function public.accept_venue_invite(text) from public, anon, authenticated, service_role;
revoke all on function public.list_venue_invites(uuid) from public, anon, authenticated, service_role;
revoke all on function public.revoke_venue_invite(uuid) from public, anon, authenticated, service_role;
revoke all on function public.remove_venue_member(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.leave_venue(uuid) from public, anon, authenticated, service_role;

grant execute on function public.is_venue_owner(uuid), public.is_venue_member(uuid), public.can_access_venue(uuid), public.can_edit_venue_content(uuid), public.get_venue_access_summary(uuid), public.list_accessible_venues(), public.list_venue_members(uuid), public.create_venue_invite(uuid), public.accept_venue_invite(text), public.list_venue_invites(uuid), public.revoke_venue_invite(uuid), public.remove_venue_member(uuid, uuid), public.leave_venue(uuid) to authenticated;
grant execute on function public.inspect_venue_invite(text) to anon, authenticated;

notify pgrst, 'reload schema';

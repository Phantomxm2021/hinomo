-- A venue has at most one shareable invitation at a time. New invitations
-- replace older active tokens and can be accepted by multiple distinct users.

alter table public.venue_invites
  add column reusable boolean not null default false,
  add constraint venue_invites_reusable_not_marked_used
    check (not reusable or (accepted_by is null and accepted_at is null));

create table private.venue_invite_acceptances (
  invite_id uuid not null references public.venue_invites(id) on delete cascade,
  user_id uuid not null,
  accepted_at timestamptz not null default pg_catalog.now(),
  primary key (invite_id, user_id)
);

alter table private.venue_invite_acceptances enable row level security;

revoke all on table private.venue_invite_acceptances from public, anon, authenticated, service_role;

-- Preserve a truthful acceptance count for already-used, pre-migration
-- invitations. `accepted_by` deliberately has no auth.users foreign key, so
-- the history table stores the historical identifier without one as well.
insert into private.venue_invite_acceptances (invite_id, user_id, accepted_at)
select invites.id, invites.accepted_by, invites.accepted_at
from public.venue_invites as invites
where invites.accepted_by is not null
  and invites.accepted_at is not null
on conflict (invite_id, user_id) do nothing;

-- The return record adds `reusable`, so PostgreSQL requires replacing this
-- function rather than CREATE OR REPLACE.
drop function public.create_venue_invite(uuid);

create function public.create_venue_invite(p_venue_id uuid)
returns table (
  invite_id uuid,
  token text,
  expires_at timestamptz,
  reusable boolean
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

  select 1 + count(*)::integer into occupied_seats
  from public.venue_members as members
  where members.venue_id = p_venue_id;

  if occupied_seats >= 5 then
    raise exception using errcode = 'P0001', message = 'venue_member_limit_reached';
  end if;

  with revoked_invites as (
    update public.venue_invites as invites
    set revoked_at = pg_catalog.now()
    where invites.venue_id = p_venue_id
      and invites.accepted_at is null
      and invites.revoked_at is null
      and invites.expires_at > pg_catalog.now()
    returning invites.id
  )
  insert into private.venue_membership_audit (venue_id, actor_id, event_code)
  select p_venue_id, caller, 'invite_revoked'
  from revoked_invites;

  new_token := pg_catalog.rtrim(
    pg_catalog.replace(
      pg_catalog.replace(pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'),
      '/', '_'
    ),
    '='
  );

  insert into public.venue_invites (id, venue_id, created_by, token_hash, expires_at, reusable)
  values (
    new_invite_id,
    p_venue_id,
    caller,
    extensions.digest(new_token, 'sha256'),
    new_expires_at,
    true
  );
  insert into private.venue_membership_audit (venue_id, actor_id, event_code)
  values (p_venue_id, caller, 'invite_created');

  return query select new_invite_id, new_token, new_expires_at, true;
end;
$$;

create or replace function public.inspect_venue_invite(p_token text)
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
    when invite.revoked_at is not null then 'revoked'
    when invite.expires_at <= pg_catalog.now() then 'expired'
    when not invite.reusable and invite.accepted_at is not null then 'used'
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

create or replace function public.accept_venue_invite(p_token text)
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

  -- Read the venue before taking its advisory lock. The row is locked only
  -- after that lock so create/revoke and accept cannot deadlock each other.
  select * into invite
  from public.venue_invites as invites
  where invites.token_hash = extensions.digest(p_token, 'sha256');

  if not found then
    raise exception using errcode = 'P0001', message = 'venue_invite_missing';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('venue-members:' || invite.venue_id::text, 0)
  );

  select * into invite
  from public.venue_invites as invites
  where invites.id = invite.id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'venue_invite_missing';
  end if;
  if public.is_venue_member(invite.venue_id) then
    return query select invite.venue_id, 'already_member'::text;
    return;
  end if;
  if invite.revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'venue_invite_revoked';
  end if;
  if invite.expires_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'venue_invite_expired';
  end if;
  if not invite.reusable and invite.accepted_at is not null then
    raise exception using errcode = 'P0001', message = 'venue_invite_used';
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
  insert into private.venue_invite_acceptances (invite_id, user_id)
  values (invite.id, caller)
  on conflict (invite_id, user_id) do nothing;
  if not invite.reusable then
    update public.venue_invites
    set accepted_by = caller, accepted_at = pg_catalog.now()
    where id = invite.id;
  end if;
  insert into private.venue_membership_audit (venue_id, actor_id, subject_user_id, event_code)
  values (invite.venue_id, caller, caller, 'member_joined');

  return query select invite.venue_id, 'joined'::text;
end;
$$;

-- The return record adds reusable and accepted_count, requiring a replacement.
drop function public.list_venue_invites(uuid);

create function public.list_venue_invites(p_venue_id uuid)
returns table (
  invite_id uuid,
  created_at timestamptz,
  expires_at timestamptz,
  status text,
  reusable boolean,
  accepted_count integer
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
      when invites.revoked_at is not null then 'revoked'
      when invites.expires_at <= pg_catalog.now() then 'expired'
      when not invites.reusable and invites.accepted_at is not null then 'used'
      when 1 + (select count(*)::integer from public.venue_members as members where members.venue_id = invites.venue_id) >= 5 then 'full'
      else 'active'
    end,
    invites.reusable,
    (select count(*)::integer from private.venue_invite_acceptances as acceptances where acceptances.invite_id = invites.id)
  from public.venue_invites as invites
  where invites.venue_id = p_venue_id
  order by invites.created_at desc, invites.id;
end;
$$;

create or replace function public.revoke_venue_invite(p_invite_id uuid)
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
  where invites.id = p_invite_id;

  if not found or not public.is_venue_owner(invite.venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('venue-members:' || invite.venue_id::text, 0)
  );

  select * into invite
  from public.venue_invites as invites
  where invites.id = p_invite_id
  for update;

  if not found or not public.is_venue_owner(invite.venue_id) then
    raise exception using errcode = 'P0001', message = 'venue_access_denied';
  end if;
  if not invite.reusable and invite.accepted_at is not null then
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

revoke all on function public.create_venue_invite(uuid) from public, anon, authenticated, service_role;
revoke all on function public.inspect_venue_invite(text) from public, anon, authenticated, service_role;
revoke all on function public.accept_venue_invite(text) from public, anon, authenticated, service_role;
revoke all on function public.list_venue_invites(uuid) from public, anon, authenticated, service_role;
revoke all on function public.revoke_venue_invite(uuid) from public, anon, authenticated, service_role;

grant execute on function public.create_venue_invite(uuid), public.accept_venue_invite(text), public.list_venue_invites(uuid), public.revoke_venue_invite(uuid) to authenticated;
grant execute on function public.inspect_venue_invite(text) to anon, authenticated;

notify pgrst, 'reload schema';

create type public.account_entitlement_status as enum ('active', 'revoked');

create table public.account_entitlements (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_code text not null check (entitlement_code = 'boxes_unlimited_lifetime'),
  status public.account_entitlement_status not null default 'active',
  source_provider text not null check (nullif(pg_catalog.btrim(source_provider), '') is not null),
  source_reference text not null check (nullif(pg_catalog.btrim(source_reference), '') is not null),
  granted_at timestamptz not null default pg_catalog.now(),
  revoked_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint account_entitlements_status_timestamps_check check (
    (status = 'active'::public.account_entitlement_status and revoked_at is null)
    or (
      status = 'revoked'::public.account_entitlement_status
      and revoked_at is not null
      and revoked_at >= granted_at
    )
  )
);

create unique index account_entitlements_active_idx
on public.account_entitlements (user_id, entitlement_code)
where status = 'active';

create unique index account_entitlements_source_idx
on public.account_entitlements (source_provider, source_reference);

create trigger account_entitlements_set_updated_at
before update on public.account_entitlements
for each row execute function public.set_updated_at();

alter table public.account_entitlements enable row level security;

create policy account_entitlements_select_own on public.account_entitlements
for select to authenticated
using (user_id = auth.uid());

revoke all on table public.account_entitlements from public, anon, authenticated, service_role;

create function public.get_box_plan_summary()
returns table (
  box_count integer,
  free_limit integer,
  unlimited_boxes boolean,
  can_create boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with caller as (
    select auth.uid() as id
  ), summary as (
    select
      (
        select count(*)::integer
        from public.boxes as boxes
        where boxes.owner_id = caller.id
      ) as box_count,
      exists (
        select 1
        from public.account_entitlements as entitlements
        where entitlements.user_id = caller.id
          and entitlements.entitlement_code = 'boxes_unlimited_lifetime'
          and entitlements.status = 'active'::public.account_entitlement_status
      ) as unlimited_boxes
    from caller
    where caller.id is not null
  )
  select
    summary.box_count,
    3::integer as free_limit,
    summary.unlimited_boxes,
    summary.unlimited_boxes or summary.box_count < 3 as can_create
  from summary;
$$;

create function public.create_box(
  p_space_id uuid,
  p_name text,
  p_category text,
  p_location text,
  p_description text,
  p_visibility public.box_visibility
)
returns table (
  id uuid,
  public_id uuid,
  box_code text,
  name text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  has_unlimited_boxes boolean;
  current_box_count integer;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller::text, 0));

  if not exists (
    select 1
    from public.spaces as spaces
    where spaces.id = p_space_id
      and spaces.owner_id = caller
  ) then
    raise exception using errcode = '42501', message = 'space is not accessible';
  end if;

  select exists (
    select 1
    from public.account_entitlements as entitlements
    where entitlements.user_id = caller
      and entitlements.entitlement_code = 'boxes_unlimited_lifetime'
      and entitlements.status = 'active'::public.account_entitlement_status
  ) into has_unlimited_boxes;

  if not has_unlimited_boxes then
    select count(*)::integer into current_box_count
    from public.boxes as boxes
    where boxes.owner_id = caller;

    if current_box_count >= 3 then
      raise exception using errcode = 'P0001', message = 'box_limit_reached';
    end if;
  end if;

  return query
  insert into public.boxes as created_box (owner_id, space_id, name, category, location, description, visibility)
  values (caller, p_space_id, p_name, p_category, p_location, p_description, p_visibility)
  returning created_box.id, created_box.public_id, created_box.box_code, created_box.name;
end;
$$;

create function public.grant_account_entitlement(
  p_user_id uuid,
  p_entitlement_code text,
  p_source_provider text,
  p_source_reference text,
  p_granted_at timestamptz
)
returns table (
  entitlement_id uuid,
  created boolean,
  duplicate_active boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  existing_source public.account_entitlements%rowtype;
  existing_active public.account_entitlements%rowtype;
  inserted_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role is required';
  end if;

  if p_user_id is null
    or p_entitlement_code is distinct from 'boxes_unlimited_lifetime'
    or nullif(pg_catalog.btrim(p_source_provider), '') is null
    or nullif(pg_catalog.btrim(p_source_reference), '') is null then
    raise exception using errcode = '22023', message = 'invalid_account_entitlement';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_entitlement_code, 0)
  );

  select * into existing_source
  from public.account_entitlements as entitlements
  where entitlements.source_provider = p_source_provider
    and entitlements.source_reference = p_source_reference
  for update;

  if found then
    return query select existing_source.id, false, false;
    return;
  end if;

  select * into existing_active
  from public.account_entitlements as entitlements
  where entitlements.user_id = p_user_id
    and entitlements.entitlement_code = p_entitlement_code
    and entitlements.status = 'active'::public.account_entitlement_status
  for update;

  if found then
    return query select existing_active.id, false, true;
    return;
  end if;

  insert into public.account_entitlements (
    user_id, entitlement_code, source_provider, source_reference, granted_at
  ) values (
    p_user_id, p_entitlement_code, p_source_provider, p_source_reference,
    coalesce(p_granted_at, pg_catalog.now())
  ) on conflict (source_provider, source_reference) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    select entitlements.id into inserted_id
    from public.account_entitlements as entitlements
    where entitlements.source_provider = p_source_provider
      and entitlements.source_reference = p_source_reference;
    return query select inserted_id, false, false;
    return;
  end if;

  return query select inserted_id, true, false;
end;
$$;

create function public.revoke_account_entitlement(
  p_source_provider text,
  p_source_reference text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  active_entitlement public.account_entitlements%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role is required';
  end if;

  select * into active_entitlement
  from public.account_entitlements as entitlements
  where entitlements.source_provider = p_source_provider
    and entitlements.source_reference = p_source_reference
    and entitlements.status = 'active'::public.account_entitlement_status
  for update;

  if not found then
    return 0;
  end if;

  update public.account_entitlements
  set status = 'revoked'::public.account_entitlement_status,
      revoked_at = pg_catalog.now()
  where id = active_entitlement.id;

  return 1;
end;
$$;

-- Compatibility window: existing clients may still create boxes directly.
-- Task 3 revokes this grant after all clients use create_box.
grant insert (owner_id, space_id, name, category, location, description, visibility)
on table public.boxes to authenticated;

revoke all on function public.get_box_plan_summary() from public, anon, authenticated, service_role;
revoke all on function public.create_box(uuid, text, text, text, text, public.box_visibility)
from public, anon, authenticated, service_role;
revoke all on function public.grant_account_entitlement(uuid, text, text, text, timestamptz)
from public, anon, authenticated, service_role;
revoke all on function public.revoke_account_entitlement(text, text)
from public, anon, authenticated, service_role;

grant execute on function public.get_box_plan_summary() to authenticated;
grant execute on function public.create_box(uuid, text, text, text, text, public.box_visibility)
to authenticated;
grant execute on function public.grant_account_entitlement(uuid, text, text, text, timestamptz)
to service_role;
grant execute on function public.revoke_account_entitlement(text, text)
to service_role;

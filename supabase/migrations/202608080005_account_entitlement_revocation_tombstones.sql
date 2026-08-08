create table public.account_entitlement_revocations (
  source_provider text not null check (nullif(pg_catalog.btrim(source_provider), '') is not null),
  source_reference text not null check (nullif(pg_catalog.btrim(source_reference), '') is not null),
  revoked_at timestamptz not null default pg_catalog.now(),
  primary key (source_provider, source_reference)
);

alter table public.account_entitlement_revocations enable row level security;
revoke all on table public.account_entitlement_revocations from public, anon, authenticated, service_role;

create or replace function public.grant_account_entitlement(
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
    pg_catalog.hashtextextended(
      'account_entitlement_source:' || p_source_provider || ':' || p_source_reference,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_entitlement_code, 0)
  );

  if exists (
    select 1
    from public.account_entitlement_revocations as revocations
    where revocations.source_provider = p_source_provider
      and revocations.source_reference = p_source_reference
  ) then
    return query select null::uuid, false, false;
    return;
  end if;

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

create or replace function public.revoke_account_entitlement(
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

  if nullif(pg_catalog.btrim(p_source_provider), '') is null
    or nullif(pg_catalog.btrim(p_source_reference), '') is null then
    raise exception using errcode = '22023', message = 'invalid_account_entitlement';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'account_entitlement_source:' || p_source_provider || ':' || p_source_reference,
      0
    )
  );

  insert into public.account_entitlement_revocations (source_provider, source_reference)
  values (p_source_provider, p_source_reference)
  on conflict (source_provider, source_reference) do nothing;

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

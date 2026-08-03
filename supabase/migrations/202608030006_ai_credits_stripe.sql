-- Prepaid AI credit ledger, Stripe purchases, and packing reservations.

create type public.credit_grant_kind as enum ('purchased', 'promotional', 'refund');
create type public.credit_reservation_status as enum ('reserved', 'consumed', 'released');
create type public.credit_transaction_kind as enum ('grant', 'reserve', 'consume', 'release', 'expire', 'refund', 'revoke');

create table public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_'),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.credit_grants (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.credit_grant_kind not null,
  original_credits integer not null check (original_credits > 0),
  remaining_credits integer not null check (remaining_credits between 0 and original_credits),
  effective_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz,
  source_reference text not null check (char_length(source_reference) between 1 and 255),
  revoked_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  check (expires_at is null or expires_at > effective_at),
  unique (kind, source_reference)
);

create table public.credit_reservations (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  packing_session_id uuid not null references public.packing_sessions(id) on delete cascade,
  analysis_revision integer not null check (analysis_revision > 0),
  credit_amount integer not null check (credit_amount between 1 and 100),
  status public.credit_reservation_status not null default 'reserved',
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 255),
  created_at timestamptz not null default pg_catalog.now(),
  settled_at timestamptz
);

create unique index credit_reservations_active_revision_idx
on public.credit_reservations (packing_session_id, analysis_revision)
where status = 'reserved';

create table public.credit_reservation_allocations (
  reservation_id uuid not null references public.credit_reservations(id) on delete cascade,
  grant_id uuid not null references public.credit_grants(id) on delete restrict,
  credit_amount integer not null check (credit_amount > 0),
  primary key (reservation_id, grant_id)
);

create table public.credit_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  grant_id uuid references public.credit_grants(id) on delete set null,
  reservation_id uuid references public.credit_reservations(id) on delete set null,
  kind public.credit_transaction_kind not null,
  credit_amount integer not null check (credit_amount > 0),
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 255),
  description text check (description is null or char_length(description) <= 240),
  created_at timestamptz not null default pg_catalog.now()
);

create table public.stripe_webhook_events (
  stripe_event_id text primary key check (stripe_event_id ~ '^evt_'),
  event_type text not null check (char_length(event_type) between 1 and 120),
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 120),
  created_at timestamptz not null default pg_catalog.now(),
  processed_at timestamptz
);

create table public.ai_model_usage_events (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.packing_sessions(id) on delete cascade,
  job_id uuid not null references public.packing_analysis_jobs(id) on delete cascade,
  operation text not null check (operation in ('observe', 'original_review', 'track_instances', 'localize', 'crop_validation')),
  provider_request_id text not null,
  model_id text not null,
  response_status text not null check (response_status in ('valid', 'empty', 'json_invalid', 'schema_invalid')),
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  duration_ms integer not null check (duration_ms >= 0),
  created_at timestamptz not null default pg_catalog.now(),
  unique (job_id, operation, provider_request_id)
);

create index credit_grants_spend_idx
on public.credit_grants (user_id, expires_at, created_at)
where remaining_credits > 0 and revoked_at is null;
create index credit_transactions_user_created_idx
on public.credit_transactions (user_id, created_at desc);
alter table public.billing_customers enable row level security;
alter table public.credit_grants enable row level security;
alter table public.credit_reservations enable row level security;
alter table public.credit_reservation_allocations enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.ai_model_usage_events enable row level security;

create function private.reserve_packing_credits(
  p_user_id uuid,
  p_session_id uuid,
  p_revision integer,
  p_credit_amount integer,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  reservation public.credit_reservations%rowtype;
  grant_row public.credit_grants%rowtype;
  needed integer := p_credit_amount;
  allocation integer;
begin
  if p_credit_amount is null or p_credit_amount not between 1 and 100
    or p_revision is null or p_revision < 1 then
    raise exception using errcode = '22023', message = 'invalid_credit_reservation';
  end if;

  select * into reservation from public.credit_reservations
  where idempotency_key = p_idempotency_key for update;
  if found then
    if reservation.user_id <> p_user_id or reservation.packing_session_id <> p_session_id
      or reservation.analysis_revision <> p_revision or reservation.credit_amount <> p_credit_amount then
      raise exception using errcode = '22023', message = 'credit_reservation_conflict';
    end if;
    if reservation.status = 'reserved' then return reservation.id; end if;
    raise exception using errcode = '22023', message = 'credit_reservation_conflict';
  end if;

  insert into public.credit_reservations (
    user_id, packing_session_id, analysis_revision, credit_amount, idempotency_key
  ) values (p_user_id, p_session_id, p_revision, p_credit_amount, p_idempotency_key)
  returning * into reservation;

  for grant_row in
    select * from public.credit_grants grants
    where grants.user_id = p_user_id
      and grants.remaining_credits > 0
      and grants.revoked_at is null
      and grants.effective_at <= pg_catalog.now()
      and (grants.expires_at is null or grants.expires_at > pg_catalog.now())
    order by grants.expires_at asc nulls last, grants.created_at, grants.id
    for update
  loop
    exit when needed = 0;
    allocation := least(needed, grant_row.remaining_credits);
    update public.credit_grants set remaining_credits = remaining_credits - allocation
    where id = grant_row.id;
    insert into public.credit_reservation_allocations (reservation_id, grant_id, credit_amount)
    values (reservation.id, grant_row.id, allocation);
    needed := needed - allocation;
  end loop;

  if needed > 0 then
    raise exception using errcode = 'P0001', message = 'insufficient_credits';
  end if;

  insert into public.credit_transactions (
    user_id, reservation_id, kind, credit_amount, idempotency_key, description
  ) values (
    p_user_id, reservation.id, 'reserve', p_credit_amount,
    p_idempotency_key || ':reserve', 'AI 装箱额度预留'
  );
  return reservation.id;
end;
$$;

create function private.settle_packing_credit_reservation(
  p_session_id uuid,
  p_revision integer,
  p_consume boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare reservation public.credit_reservations%rowtype;
begin
  select * into reservation from public.credit_reservations reservations
  where reservations.packing_session_id = p_session_id
    and reservations.analysis_revision = p_revision
    and reservations.status = 'reserved'
  order by reservations.created_at desc limit 1 for update;
  if not found then return; end if;

  if p_consume then
    update public.credit_reservations set status = 'consumed', settled_at = pg_catalog.now()
    where id = reservation.id;
    insert into public.credit_transactions (
      user_id, reservation_id, kind, credit_amount, idempotency_key, description
    ) values (
      reservation.user_id, reservation.id, 'consume', reservation.credit_amount,
      reservation.id || ':consume', 'AI 装箱识别'
    ) on conflict (idempotency_key) do nothing;
  else
    update public.credit_grants grants set
      remaining_credits = grants.remaining_credits + allocations.credit_amount
    from public.credit_reservation_allocations allocations
    where allocations.reservation_id = reservation.id and grants.id = allocations.grant_id;
    update public.credit_reservations set status = 'released', settled_at = pg_catalog.now()
    where id = reservation.id;
    insert into public.credit_transactions (
      user_id, reservation_id, kind, credit_amount, idempotency_key, description
    ) values (
      reservation.user_id, reservation.id, 'release', reservation.credit_amount,
      reservation.id || ':release', 'AI 装箱额度退回'
    ) on conflict (idempotency_key) do nothing;
  end if;
end;
$$;

create function public.get_credit_summary()
returns table(
  credits_available integer,
  credits_reserved integer
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    coalesce((select sum(grants.remaining_credits)::integer from public.credit_grants grants
      where grants.user_id = auth.uid() and grants.revoked_at is null and grants.effective_at <= pg_catalog.now()
        and (grants.expires_at is null or grants.expires_at > pg_catalog.now())), 0),
    coalesce((select sum(reservations.credit_amount)::integer from public.credit_reservations reservations
      where reservations.user_id = auth.uid() and reservations.status = 'reserved'), 0)
  where auth.uid() is not null;
$$;

create function public.list_credit_transactions(p_limit integer default 20)
returns table(
  id uuid,
  kind public.credit_transaction_kind,
  credit_amount integer,
  description text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select transactions.id, transactions.kind, transactions.credit_amount,
    transactions.description, transactions.created_at
  from public.credit_transactions transactions
  where transactions.user_id = auth.uid()
  order by transactions.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

create function public.upsert_billing_customer(p_user_id uuid, p_stripe_customer_id text)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role is required';
  end if;
  insert into public.billing_customers (user_id, stripe_customer_id)
  values (p_user_id, p_stripe_customer_id)
  on conflict (user_id) do update set
    stripe_customer_id = excluded.stripe_customer_id,
    updated_at = pg_catalog.now();
end;
$$;

create function public.grant_credits(
  p_user_id uuid,
  p_kind public.credit_grant_kind,
  p_credit_amount integer,
  p_effective_at timestamptz,
  p_expires_at timestamptz,
  p_source_reference text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare grant_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role is required';
  end if;
  if p_credit_amount is null or p_credit_amount < 1 then
    raise exception using errcode = '22023', message = 'invalid_credit_grant';
  end if;
  insert into public.credit_grants (
    user_id, kind, original_credits, remaining_credits, effective_at, expires_at, source_reference
  ) values (
    p_user_id, p_kind, p_credit_amount, p_credit_amount,
    coalesce(p_effective_at, pg_catalog.now()), p_expires_at, p_source_reference
  ) on conflict (kind, source_reference) do nothing
  returning id into grant_id;
  if grant_id is null then
    select grants.id into grant_id from public.credit_grants grants
    where grants.kind = p_kind and grants.source_reference = p_source_reference;
    return grant_id;
  end if;
  insert into public.credit_transactions (
    user_id, grant_id, kind, credit_amount, idempotency_key, description
  ) values (
    p_user_id, grant_id,
    case when p_kind = 'refund' then 'refund'::public.credit_transaction_kind else 'grant'::public.credit_transaction_kind end,
    p_credit_amount, 'grant:' || p_kind || ':' || p_source_reference, p_description
  );
  return grant_id;
end;
$$;

create function public.revoke_unused_credits(
  p_kind public.credit_grant_kind,
  p_source_reference text,
  p_description text default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  grant_row public.credit_grants%rowtype;
  revoked integer;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role is required';
  end if;
  select * into grant_row from public.credit_grants grants
  where grants.kind = p_kind and grants.source_reference = p_source_reference for update;
  if not found then return 0; end if;
  revoked := grant_row.remaining_credits;
  if revoked = 0 then return 0; end if;
  update public.credit_grants set remaining_credits = 0, revoked_at = pg_catalog.now() where id = grant_row.id;
  insert into public.credit_transactions (
    user_id, grant_id, kind, credit_amount, idempotency_key, description
  ) values (
    grant_row.user_id, grant_row.id, 'revoke', revoked,
    'revoke:' || p_kind || ':' || p_source_reference,
    coalesce(p_description, '未使用额度已收回')
  ) on conflict (idempotency_key) do nothing;
  return revoked;
end;
$$;

create function public.release_packing_credit_reservation(p_session_id uuid, p_revision integer)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role is required';
  end if;
  perform private.settle_packing_credit_reservation(p_session_id, p_revision, false);
end;
$$;

create or replace function public.create_packing_session(p_box_id uuid)
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
  if not exists (select 1 from public.boxes boxes where boxes.id = p_box_id and boxes.owner_id = caller) then
    raise exception using errcode = '42501', message = 'box is not accessible';
  end if;
  insert into public.packing_sessions (box_id, owner_id)
  values (p_box_id, caller) returning * into created_session;
  return created_session;
end;
$$;

create or replace function public.complete_packing_session(p_session_id uuid)
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
  target_revision integer;
begin
  if caller is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  select * into current_session from public.packing_sessions sessions
  where sessions.id = p_session_id and sessions.owner_id = caller for update;
  if not found then raise exception using errcode = '42501', message = 'packing session is not accessible'; end if;
  if current_session.status in ('queued', 'processing', 'ready', 'partial_failed', 'failed') then return current_session; end if;
  if current_session.status = 'canceled'::public.packing_session_status then
    raise exception using errcode = '22023', message = 'canceled packing session cannot be completed';
  end if;
  select count(*), count(*) filter (where upload_status = 'confirmed'::public.packing_photo_status)
  into total_count, confirmed_count from public.packing_photos photos where photos.session_id = current_session.id;
  if total_count not between 1 and 100 or confirmed_count <> total_count then
    raise exception using errcode = '22023', message = 'all packing photos must be uploaded before completion';
  end if;
  target_revision := current_session.current_revision + 1;
  perform private.reserve_packing_credits(
    caller, current_session.id, target_revision, total_count,
    'packing:' || current_session.id || ':revision:' || target_revision || ':initial'
  );
  update public.packing_sessions set
    status = 'queued'::public.packing_session_status, photo_count = total_count,
    completed_at = pg_catalog.now(), last_error_code = null
  where id = current_session.id returning * into current_session;
  insert into public.packing_analysis_jobs (session_id, stage, scope_key, input_fingerprint)
  values (current_session.id, 'normalize'::public.packing_job_stage, 'session', 'source-v1')
  on conflict do nothing;
  return current_session;
end;
$$;

create or replace function public.request_packing_reanalysis(p_session_id uuid)
returns public.packing_sessions
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  current_session public.packing_sessions%rowtype;
  target_revision integer;
  attempt_key text;
begin
  select * into current_session from public.packing_sessions sessions
  where sessions.id = p_session_id and sessions.owner_id = caller for update;
  if not found then raise exception using errcode = '42501', message = 'packing session is not accessible'; end if;
  if current_session.status not in ('ready', 'partial_failed', 'failed') then
    raise exception using errcode = '22023', message = 'packing session cannot be reanalyzed';
  end if;
  target_revision := current_session.current_revision + 1;
  attempt_key := 'packing:' || current_session.id || ':revision:' || target_revision || ':reanalyze:' || extensions.gen_random_uuid();
  perform private.reserve_packing_credits(caller, current_session.id, target_revision, current_session.photo_count, attempt_key);
  delete from public.packing_analysis_jobs where session_id = current_session.id;
  update public.packing_sessions set status = 'queued', processed_at = null, last_error_code = null
  where id = current_session.id returning * into current_session;
  insert into public.packing_analysis_jobs (session_id, stage, scope_key, input_fingerprint)
  values (current_session.id, 'normalize', 'session', pg_catalog.left('reanalyze-' || extensions.gen_random_uuid(), 128));
  return current_session;
end;
$$;

create or replace function public.publish_packing_revision(
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
declare
  published_at_value timestamptz := pg_catalog.now();
  has_results boolean;
begin
  if p_revision is null or p_revision < 1
    or nullif(pg_catalog.btrim(p_model_id), '') is null
    or nullif(pg_catalog.btrim(p_prompt_version), '') is null
    or nullif(pg_catalog.btrim(p_schema_version), '') is null then
    raise exception using errcode = '22023', message = 'invalid packing revision metadata';
  end if;
  perform 1 from public.packing_sessions sessions where sessions.id = p_session_id for update;
  if not found then raise exception using errcode = '22023', message = 'packing session does not exist'; end if;
  if exists (
    select 1 from public.packing_detected_items items
    where items.session_id = p_session_id and items.analysis_revision = p_revision
      and items.visibility = 'clear' and items.crop_status <> 'ready' and items.review_status <> 'needs_review'
  ) then
    raise exception using errcode = '22023', message = 'clear packing items require a verified crop or review';
  end if;
  select exists (select 1 from public.packing_detected_items items
    where items.session_id = p_session_id and items.analysis_revision = p_revision)
  into has_results;
  update public.packing_detected_items set published_at = published_at_value
  where session_id = p_session_id and analysis_revision = p_revision and published_at is null;
  update public.packing_sessions set
    current_revision = p_revision, status = 'ready', model_id = p_model_id,
    prompt_version = p_prompt_version, schema_version = p_schema_version,
    processed_at = published_at_value, last_error_code = null
  where id = p_session_id;
  perform private.settle_packing_credit_reservation(p_session_id, p_revision, has_results);
end;
$$;

create or replace function public.fail_packing_analysis_job(
  p_job_id uuid,
  p_error_code text,
  p_retryable boolean default true
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_job public.packing_analysis_jobs%rowtype;
  terminal boolean;
  target_revision integer;
begin
  if p_error_code is null or char_length(p_error_code) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'packing job error code is required';
  end if;
  select * into current_job from public.packing_analysis_jobs jobs where jobs.id = p_job_id for update;
  if not found or current_job.status <> 'processing' then
    raise exception using errcode = '22023', message = 'packing job is not processing';
  end if;
  terminal := not p_retryable or current_job.attempts >= 5;
  update public.packing_analysis_jobs set
    status = case when terminal then 'failed'::public.packing_job_status else 'pending'::public.packing_job_status end,
    lease_expires_at = null,
    next_attempt_at = case when terminal then next_attempt_at else
      pg_catalog.now() + pg_catalog.make_interval(secs => least(3600, 30 * pg_catalog.power(2::numeric, current_job.attempts)::integer)) end,
    last_error_code = p_error_code
  where id = current_job.id;

  if not terminal then return; end if;
  update public.packing_sessions set status = 'partial_failed', last_error_code = p_error_code
  where id = current_job.session_id;

  if current_job.stage = 'observe' and not exists (
    select 1 from public.packing_analysis_jobs jobs where jobs.session_id = current_job.session_id
      and jobs.stage = 'observe' and jobs.status in ('pending', 'processing')
  ) then
    insert into public.packing_analysis_jobs (session_id, stage, scope_key, input_fingerprint)
    values (current_job.session_id, 'track_instances', 'session', 'packing-atlas-v4:track')
    on conflict do nothing;
  elsif current_job.stage = 'localize' and not exists (
    select 1 from public.packing_analysis_jobs jobs where jobs.session_id = current_job.session_id
      and jobs.stage = 'localize' and jobs.status in ('pending', 'processing')
  ) then
    select items.analysis_revision into target_revision from public.packing_detected_items items
    where items.id = pg_catalog.split_part(current_job.scope_key, ':', 2)::uuid;
    if target_revision is not null then
      insert into public.packing_analysis_jobs (session_id, stage, scope_key, input_fingerprint)
      values (current_job.session_id, 'publish', 'revision:' || target_revision, 'packing-atlas-v4:publish')
      on conflict do nothing;
    end if;
  elsif current_job.stage in ('track_instances', 'consolidate', 'publish') then
    select sessions.current_revision + 1 into target_revision from public.packing_sessions sessions
    where sessions.id = current_job.session_id;
    perform private.settle_packing_credit_reservation(current_job.session_id, target_revision, false);
  end if;
end;
$$;

revoke all on table public.billing_customers, public.credit_grants,
  public.credit_reservations, public.credit_reservation_allocations, public.credit_transactions,
  public.stripe_webhook_events, public.ai_model_usage_events from public, anon, authenticated;
revoke all on function private.reserve_packing_credits(uuid, uuid, integer, integer, text),
  private.settle_packing_credit_reservation(uuid, integer, boolean)
  from public, anon, authenticated;
revoke all on function public.get_credit_summary(), public.list_credit_transactions(integer),
  public.upsert_billing_customer(uuid, text),
  public.grant_credits(uuid, public.credit_grant_kind, integer, timestamptz, timestamptz, text, text),
  public.revoke_unused_credits(public.credit_grant_kind, text, text),
  public.release_packing_credit_reservation(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_credit_summary(), public.list_credit_transactions(integer) to authenticated;
grant execute on function public.upsert_billing_customer(uuid, text),
  public.grant_credits(uuid, public.credit_grant_kind, integer, timestamptz, timestamptz, text, text),
  public.revoke_unused_credits(public.credit_grant_kind, text, text),
  public.release_packing_credit_reservation(uuid, integer)
  to service_role;
grant all on table public.billing_customers, public.credit_grants,
  public.credit_reservations, public.credit_reservation_allocations, public.credit_transactions,
  public.stripe_webhook_events, public.ai_model_usage_events to service_role;

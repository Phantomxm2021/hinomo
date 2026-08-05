-- Localized AI output with bilingual search aliases.
--
-- The locale is captured on a packing session so a later profile preference
-- change cannot change the language of an in-flight analysis.  AI-produced
-- aliases are kept separate from the user-facing display fields and are used
-- only as additional search terms.

alter table public.packing_sessions
add column output_locale text;

update public.packing_sessions sessions
set output_locale = coalesce(
  (select profiles.locale from public.profiles profiles where profiles.id = sessions.owner_id),
  'zh-CN'
)
where sessions.output_locale is null;

alter table public.packing_sessions
alter column output_locale set default 'zh-CN',
alter column output_locale set not null;

alter table public.packing_sessions
add constraint packing_sessions_output_locale_check
check (output_locale in ('zh-CN', 'en-US'));

alter table public.packing_detected_items
add column search_aliases text[] not null default '{}'::text[];

alter table public.items
add column search_aliases text[] not null default '{}'::text[];

-- The localized pipeline records two additional text-only model operations.
-- Keep the existing audit table and expand its allow-list rather than creating
-- a second usage-event shape.
alter table public.ai_model_usage_events
drop constraint if exists ai_model_usage_events_operation_check;

alter table public.ai_model_usage_events
add constraint ai_model_usage_events_operation_check
check (operation in (
  'observe', 'original_review', 'track_instances', 'localize',
  'crop_validation', 'language_repair', 'alias_backfill'
));

create or replace function private.valid_search_aliases(p_aliases text[])
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_aliases is not null
    and pg_catalog.cardinality(p_aliases) <= 16
    and not exists (
      select 1
      from pg_catalog.unnest(p_aliases) as aliases(alias)
      where aliases.alias is null
        or pg_catalog.char_length(pg_catalog.btrim(aliases.alias)) not between 1 and 80
    );
$$;

alter table public.packing_detected_items
add constraint packing_detected_items_search_aliases_check
check (private.valid_search_aliases(search_aliases));

alter table public.items
add constraint items_search_aliases_check
check (private.valid_search_aliases(search_aliases));

create or replace function private.merge_search_aliases(
  p_existing text[],
  p_incoming text[]
)
returns text[]
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(
    (
      select pg_catalog.array_agg(aliases.alias order by aliases.first_position)
      from (
        select
          pg_catalog.btrim(input.alias) as alias,
          min(input.position) as first_position
        from pg_catalog.unnest(
          coalesce(p_existing, '{}'::text[]) || coalesce(p_incoming, '{}'::text[])
        ) with ordinality as input(alias, position)
        where input.alias is not null
          and pg_catalog.char_length(pg_catalog.btrim(input.alias)) between 1 and 80
        group by pg_catalog.btrim(input.alias)
        order by min(input.position)
        limit 16
      ) as aliases
    ),
    '{}'::text[]
  );
$$;

create or replace function private.prevent_packing_output_locale_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.output_locale is distinct from old.output_locale then
    raise exception using
      errcode = '22023',
      message = 'packing session output locale is immutable';
  end if;
  return new;
end;
$$;

create trigger packing_sessions_output_locale_immutable
before update of output_locale on public.packing_sessions
for each row execute function private.prevent_packing_output_locale_update();

create or replace function public.create_packing_session(p_box_id uuid)
returns public.packing_sessions
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  session_locale text;
  created_session public.packing_sessions;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  if not exists (
    select 1 from public.boxes boxes where boxes.id = p_box_id and boxes.owner_id = caller
  ) then
    raise exception using errcode = '42501', message = 'box is not accessible';
  end if;

  select coalesce(
    (select profiles.locale from public.profiles profiles where profiles.id = caller),
    'zh-CN'
  ) into session_locale;

  insert into public.packing_sessions (box_id, owner_id, output_locale)
  values (p_box_id, caller, session_locale)
  returning * into created_session;
  return created_session;
end;
$$;

drop function public.search_my_items(text);
create function public.search_my_items(p_query text)
returns table (
  item_id uuid,
  item_name text,
  quantity integer,
  stored_quantity integer,
  box_id uuid,
  box_public_id uuid,
  box_name text,
  venue_name text,
  space_name text,
  location text
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  with search_input as (
    select pg_catalog.btrim(p_query) as query,
      '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
        pg_catalog.lower(pg_catalog.btrim(p_query)), E'\\', E'\\\\'
      ), '%', E'\\%'), '_', E'\\_') || '%' as pattern
    where nullif(pg_catalog.btrim(p_query), '') is not null
  ), results as (
    select
      items.id as item_id,
      items.name as item_name,
      items.quantity,
      items.stored_quantity,
      boxes.id as box_id,
      boxes.public_id as box_public_id,
      boxes.name as box_name,
      venues.name as venue_name,
      spaces.name as space_name,
      boxes.location,
      case
        when pg_catalog.lower(items.name) = pg_catalog.lower(search_input.query) then 0
        when pg_catalog.lower(items.name) ilike search_input.pattern escape E'\\' then 1
        else 2
      end as match_rank,
      items.updated_at
    from public.items items
    cross join search_input
    join public.boxes boxes on boxes.id = items.box_id
    join public.spaces spaces on spaces.id = boxes.space_id
    join public.venues venues on venues.id = spaces.venue_id
    where boxes.owner_id = auth.uid()
      and pg_catalog.lower(
        coalesce(items.name, '') || ' ' || coalesce(items.category, '') || ' ' ||
        coalesce(items.description, '') || ' ' ||
        coalesce(pg_catalog.array_to_string(items.search_aliases, ' '), '')
      ) ilike search_input.pattern escape E'\\'
  )
  select item_id, item_name, quantity, stored_quantity,
    box_id, box_public_id, box_name, venue_name, space_name, location
  from results
  order by match_rank, updated_at desc, item_name
  limit 100;
$$;

revoke all on function public.search_my_items(text) from public;
grant execute on function public.search_my_items(text) to authenticated;

drop function public.search_my_inventory(text);
create function public.search_my_inventory(p_query text)
returns table (
  result_id uuid,
  source text,
  item_name text,
  quantity integer,
  quantity_kind text,
  stored_quantity integer,
  box_id uuid,
  box_public_id uuid,
  box_name text,
  venue_name text,
  space_name text,
  location text
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  with search_input as (
    select pg_catalog.btrim(p_query) as query,
      '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
        pg_catalog.lower(pg_catalog.btrim(p_query)), E'\\', E'\\\\'
      ), '%', E'\\%'), '_', E'\\_') || '%' as pattern
    where nullif(pg_catalog.btrim(p_query), '') is not null
  ), results as (
    select
      items.id as result_id,
      'formal'::text as source,
      items.name as item_name,
      items.quantity,
      'exact'::text as quantity_kind,
      items.stored_quantity,
      boxes.id as box_id,
      boxes.public_id as box_public_id,
      boxes.name as box_name,
      venues.name as venue_name,
      spaces.name as space_name,
      boxes.location,
      1 as source_rank,
      case
        when pg_catalog.lower(items.name) = pg_catalog.lower(search_input.query) then 0
        when pg_catalog.lower(items.name) ilike search_input.pattern escape E'\\' then 1
        else 2
      end as match_rank,
      items.updated_at
    from public.items items
    cross join search_input
    join public.boxes boxes on boxes.id = items.box_id
    join public.spaces spaces on spaces.id = boxes.space_id
    join public.venues venues on venues.id = spaces.venue_id
    where boxes.owner_id = auth.uid()
      and pg_catalog.lower(
        coalesce(items.name, '') || ' ' || coalesce(items.category, '') || ' ' ||
        coalesce(items.description, '') || ' ' ||
        coalesce(pg_catalog.array_to_string(items.search_aliases, ' '), '')
      ) ilike search_input.pattern escape E'\\'

    union all

    select
      detected.id,
      'ai'::text,
      detected.name,
      detected.quantity_value,
      detected.quantity_kind::text,
      null::integer,
      boxes.id,
      boxes.public_id,
      boxes.name,
      venues.name,
      spaces.name,
      boxes.location,
      case when detected.review_status in ('confirmed', 'corrected') then 2 else 3 end,
      case
        when pg_catalog.lower(detected.name) = pg_catalog.lower(search_input.query) then 0
        when pg_catalog.lower(detected.name) ilike search_input.pattern escape E'\\' then 1
        else 2
      end,
      detected.updated_at
    from public.packing_detected_items detected
    cross join search_input
    join public.packing_sessions sessions
      on sessions.id = detected.session_id and sessions.current_revision = detected.analysis_revision
    join public.boxes boxes on boxes.id = detected.box_id
    join public.spaces spaces on spaces.id = boxes.space_id
    join public.venues venues on venues.id = spaces.venue_id
    where boxes.owner_id = auth.uid()
      and detected.published_at is not null
      and detected.review_status not in ('dismissed', 'promoted')
      and pg_catalog.lower(
        coalesce(detected.name, '') || ' ' || coalesce(detected.category, '') || ' ' ||
        coalesce(detected.description, '') || ' ' ||
        coalesce(pg_catalog.array_to_string(detected.search_aliases, ' '), '')
      ) ilike search_input.pattern escape E'\\'
  )
  select result_id, source, item_name, quantity, quantity_kind, stored_quantity,
    box_id, box_public_id, box_name, venue_name, space_name, location
  from results
  order by source_rank, match_rank, updated_at desc, item_name
  limit 100;
$$;

revoke all on function public.search_my_inventory(text) from public, anon;
grant execute on function public.search_my_inventory(text) to authenticated;

create or replace function public.finalize_packing_item_promotion(
  p_promotion_id uuid,
  p_mime_type text,
  p_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  promotion public.packing_item_promotions%rowtype;
  detected public.packing_detected_items%rowtype;
begin
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_size_bytes is null or p_size_bytes <= 0 then
    raise exception using errcode = '22023', message = 'invalid promoted media metadata';
  end if;

  select * into promotion from public.packing_item_promotions promotions
  where promotions.id = p_promotion_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'packing promotion does not exist';
  end if;
  if promotion.status = 'completed'::public.packing_promotion_status then
    return promotion.target_item_id;
  end if;

  select * into detected from public.packing_detected_items items
  where items.id = promotion.detected_item_id for update;
  if not found or detected.quantity_kind <> 'exact'::public.packing_quantity_kind
    or detected.quantity_value is null then
    raise exception using errcode = '22023', message = 'detected item can no longer be promoted';
  end if;

  insert into public.items as target (
    id, box_id, name, category, quantity, description,
    image_object_key, image_mime_type, image_size_bytes, search_aliases
  ) values (
    promotion.target_item_id, detected.box_id, detected.name, detected.category,
    detected.quantity_value, detected.description,
    promotion.target_object_key, p_mime_type, p_size_bytes, detected.search_aliases
  ) on conflict (id) do update set
    search_aliases = private.merge_search_aliases(target.search_aliases, excluded.search_aliases);

  update public.packing_detected_items
  set review_status = 'promoted'::public.packing_review_status
  where id = detected.id;
  update public.packing_item_promotions set
    status = 'completed'::public.packing_promotion_status,
    completed_at = pg_catalog.now(),
    last_error_code = null
  where id = promotion.id;
  return promotion.target_item_id;
end;
$$;

revoke all on function public.finalize_packing_item_promotion(uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.finalize_packing_item_promotion(uuid, text, bigint) to service_role;

-- Historical alias backfill runs in its own queue.  It must never share the
-- analysis queue: a bad text-only model response cannot change a session's
-- processing state or block a new packing analysis.
create table public.packing_search_alias_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  detected_item_id uuid not null references public.packing_detected_items(id) on delete cascade,
  alias_version text not null default 'packing-alias-v1'
    check (char_length(pg_catalog.btrim(alias_version)) between 1 and 80),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  next_attempt_at timestamptz not null default pg_catalog.now(),
  lease_expires_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 120),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (detected_item_id, alias_version)
);

create index packing_search_alias_jobs_claim_idx
on public.packing_search_alias_jobs(status, next_attempt_at, created_at);
create index packing_search_alias_jobs_lease_idx
on public.packing_search_alias_jobs(status, lease_expires_at);

alter table public.packing_search_alias_jobs enable row level security;
create trigger packing_search_alias_jobs_set_updated_at
before update on public.packing_search_alias_jobs
for each row execute function public.set_updated_at();

create function public.claim_packing_search_alias_jobs(
  p_batch_size integer default 1,
  p_lease_seconds integer default 390
)
returns table (
  job_id uuid,
  detected_item_id uuid,
  session_id uuid,
  name text,
  category text,
  output_locale text,
  attempts integer,
  alias_version text
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if p_batch_size is null or p_batch_size not between 1 and 25
    or p_lease_seconds is null or p_lease_seconds not between 30 and 1800 then
    raise exception using errcode = '22023', message = 'invalid alias job claim options';
  end if;

  -- Recover abandoned leases without touching the packing session. A
  -- terminal job remains failed and is never claimed again.
  update public.packing_search_alias_jobs jobs
  set
    status = case when jobs.attempts >= 5 then 'failed' else 'pending' end,
    lease_expires_at = null,
    next_attempt_at = pg_catalog.now(),
    last_error_code = 'worker_lease_expired'
  where jobs.status = 'processing'
    and jobs.lease_expires_at <= pg_catalog.now();

  return query
  with candidates as (
    select jobs.id
    from public.packing_search_alias_jobs jobs
    where jobs.status = 'pending'
      and jobs.attempts < 5
      and jobs.next_attempt_at <= pg_catalog.now()
    order by jobs.next_attempt_at, jobs.created_at
    limit p_batch_size
    for update skip locked
  ), claimed as (
    update public.packing_search_alias_jobs jobs
    set
      status = 'processing',
      attempts = jobs.attempts + 1,
      lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
      last_error_code = null
    from candidates
    where jobs.id = candidates.id
    returning jobs.*
  )
  select claimed.id, detected.id, detected.session_id, detected.name,
    detected.category, coalesce(profiles.locale, 'zh-CN'), claimed.attempts,
    claimed.alias_version
  from claimed
  join public.packing_detected_items detected on detected.id = claimed.detected_item_id
  join public.packing_sessions sessions on sessions.id = detected.session_id
  left join public.profiles profiles on profiles.id = sessions.owner_id;
end;
$$;

create function public.complete_packing_search_alias_job(
  p_job_id uuid,
  p_search_aliases text[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_job public.packing_search_alias_jobs%rowtype;
  detected public.packing_detected_items%rowtype;
  normalized_aliases text[];
begin
  if p_search_aliases is not null
    and pg_catalog.cardinality(p_search_aliases) > 16 then
    raise exception using errcode = '22023', message = 'too many packing search aliases';
  end if;
  if p_search_aliases is not null
    and not private.valid_search_aliases(p_search_aliases) then
    raise exception using errcode = '22023', message = 'invalid packing search aliases';
  end if;

  select * into current_job
  from public.packing_search_alias_jobs jobs
  where jobs.id = p_job_id
  for update;
  if not found or current_job.status <> 'processing' then
    raise exception using errcode = '22023', message = 'packing alias job is not processing';
  end if;

  select * into detected
  from public.packing_detected_items items
  where items.id = current_job.detected_item_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'packing alias item does not exist';
  end if;

  normalized_aliases := private.merge_search_aliases(
    detected.search_aliases,
    coalesce(p_search_aliases, '{}'::text[])
  );
  update public.packing_detected_items
  set search_aliases = normalized_aliases
  where id = detected.id;

  -- If this item was promoted while the backfill was running, carry the same
  -- aliases into its formal item without changing any display fields.
  update public.items target
  set search_aliases = private.merge_search_aliases(target.search_aliases, normalized_aliases)
  from public.packing_item_promotions promotions
  where promotions.detected_item_id = detected.id
    and promotions.target_item_id = target.id
    and promotions.status = 'completed';

  update public.packing_search_alias_jobs
  set status = 'completed', lease_expires_at = null, last_error_code = null
  where id = current_job.id;
end;
$$;

create function public.fail_packing_search_alias_job(
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
  current_job public.packing_search_alias_jobs%rowtype;
  terminal boolean;
begin
  if p_error_code is null or pg_catalog.char_length(p_error_code) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'packing alias job error code is required';
  end if;
  select * into current_job
  from public.packing_search_alias_jobs jobs
  where jobs.id = p_job_id
  for update;
  if not found or current_job.status <> 'processing' then
    raise exception using errcode = '22023', message = 'packing alias job is not processing';
  end if;

  terminal := not p_retryable or current_job.attempts >= 5;
  update public.packing_search_alias_jobs set
    status = case when terminal then 'failed' else 'pending' end,
    lease_expires_at = null,
    next_attempt_at = case
      when terminal then next_attempt_at
      else pg_catalog.now() + pg_catalog.make_interval(
        secs => least(3600, 30 * pg_catalog.power(2::numeric, current_job.attempts)::integer)
      )
    end,
    last_error_code = p_error_code
  where id = current_job.id;
  -- Deliberately no packing_sessions update here. Alias backfill is best effort.
end;
$$;

revoke all on table public.packing_search_alias_jobs from public, anon, authenticated;
revoke all on function public.claim_packing_search_alias_jobs(integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_packing_search_alias_job(uuid, text[])
  from public, anon, authenticated;
revoke all on function public.fail_packing_search_alias_job(uuid, text, boolean)
  from public, anon, authenticated;
grant all on table public.packing_search_alias_jobs to service_role;
grant execute on function public.claim_packing_search_alias_jobs(integer, integer) to service_role;
grant execute on function public.complete_packing_search_alias_job(uuid, text[]) to service_role;
grant execute on function public.fail_packing_search_alias_job(uuid, text, boolean) to service_role;

-- Historical rows are queued exactly once per alias version. A single wake is
-- enough; the Worker self-wakes while either queue still returns work.
insert into public.packing_search_alias_jobs (detected_item_id, alias_version)
select detected.id, 'packing-alias-v1'
from public.packing_detected_items detected
where detected.published_at is not null
  and pg_catalog.cardinality(detected.search_aliases) = 0
on conflict (detected_item_id, alias_version) do nothing;

select private.invoke_packing_edge_function()
where exists (
  select 1 from public.packing_search_alias_jobs where status = 'pending'
);

notify pgrst, 'reload schema';

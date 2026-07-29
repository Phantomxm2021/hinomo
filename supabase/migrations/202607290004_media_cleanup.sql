-- Media cleanup is asynchronous: user-facing writes only enqueue object keys.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.media_cleanup_jobs
  add column request_id bigint unique;

create index cleanup_jobs_processing_recovery_idx
  on public.media_cleanup_jobs(status, updated_at)
  where status = 'processing'::public.cleanup_status;

create function public.enqueue_removed_media()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_key text;
  new_key text;
begin
  if tg_table_name = 'boxes' then
    old_key := old.cover_object_key;
    new_key := case when tg_op = 'DELETE' then null else new.cover_object_key end;
  elsif tg_table_name = 'items' then
    old_key := old.image_object_key;
    new_key := case when tg_op = 'DELETE' then null else new.image_object_key end;
  else
    old_key := old.object_key;
    new_key := null;
  end if;

  if old_key is not null and old_key is distinct from new_key then
    insert into public.media_cleanup_jobs (object_key)
    values (old_key)
    on conflict (object_key) do nothing;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger boxes_media_replaced_cleanup
after update of cover_object_key on public.boxes
for each row
execute function public.enqueue_removed_media();

create trigger boxes_media_deleted_cleanup
after delete on public.boxes
for each row
execute function public.enqueue_removed_media();

create trigger items_media_replaced_cleanup
after update of image_object_key on public.items
for each row
execute function public.enqueue_removed_media();

create trigger items_media_deleted_cleanup
after delete on public.items
for each row
execute function public.enqueue_removed_media();

create trigger pending_upload_deleted_cleanup
after delete on public.media_uploads
for each row
when (old.status = 'pending'::public.media_upload_status)
execute function public.enqueue_removed_media();

create function public.expire_media_uploads(p_cutoff timestamptz default pg_catalog.now())
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  processed integer;
begin
  with expired_uploads as (
    update public.media_uploads
    set status = 'expired'::public.media_upload_status
    where status = 'pending'::public.media_upload_status
      and expires_at <= p_cutoff
    returning object_key
  ), queued_jobs as (
    insert into public.media_cleanup_jobs (object_key)
    select object_key
    from expired_uploads
    on conflict (object_key) do nothing
    returning id
  )
  select count(*) into processed
  from expired_uploads;

  return processed;
end;
$$;

create function public.process_media_cleanup_jobs(p_batch_size integer default 25)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  job record;
  request bigint;
  submitted integer := 0;
  next_attempts integer;
begin
  if p_batch_size is null or p_batch_size not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'cleanup batch size must be between 1 and 100';
  end if;

  for job in
    select id, object_key, attempts
    from public.media_cleanup_jobs
    where status = 'pending'::public.cleanup_status
      and request_id is null
      and next_attempt_at <= pg_catalog.now()
    order by next_attempt_at, created_at
    limit p_batch_size
    for update skip locked
  loop
    begin
      request := net.http_delete(
        url := private.r2_presign_from_vault('DELETE', job.object_key, null, 300)
      );

      update public.media_cleanup_jobs
      set
        status = 'processing'::public.cleanup_status,
        request_id = request,
        updated_at = pg_catalog.now()
      where id = job.id;

      submitted := submitted + 1;
    exception when others then
      next_attempts := job.attempts + 1;

      update public.media_cleanup_jobs
      set
        attempts = next_attempts,
        status = case
          when next_attempts >= 5 then 'failed'::public.cleanup_status
          else 'pending'::public.cleanup_status
        end,
        request_id = null,
        next_attempt_at = pg_catalog.now() + pg_catalog.make_interval(
          secs => least(3600, 30 * pg_catalog.power(2::numeric, next_attempts)::integer)
        ),
        last_error = 'cleanup submission failed',
        updated_at = pg_catalog.now()
      where id = job.id;
    end;
  end loop;

  return submitted;
end;
$$;

create function public.collect_media_cleanup_results()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  job record;
  handled integer := 0;
  next_attempts integer;
  retry_delay_seconds integer;
  sanitized_error text;
begin
  for job in
    select
      cleanup_jobs.id,
      cleanup_jobs.attempts,
      responses.id is not null as has_response,
      responses.status_code,
      responses.error_msg
    from public.media_cleanup_jobs as cleanup_jobs
    left join net._http_response as responses
      on responses.id = cleanup_jobs.request_id
    where cleanup_jobs.status = 'processing'::public.cleanup_status
      and (
        responses.id is not null
        or cleanup_jobs.updated_at <= pg_catalog.now() - interval '10 minutes'
      )
    for update of cleanup_jobs skip locked
  loop
    if job.has_response
      and (job.status_code between 200 and 299 or job.status_code = 404) then
      update public.media_cleanup_jobs
      set
        status = 'completed'::public.cleanup_status,
        request_id = null,
        last_error = null,
        updated_at = pg_catalog.now()
      where id = job.id;
    else
      next_attempts := job.attempts + 1;
      retry_delay_seconds := least(
        3600,
        30 * pg_catalog.power(2::numeric, next_attempts)::integer
      );
      sanitized_error := case
        when not job.has_response then 'cleanup response timed out'
        when job.error_msg is null or pg_catalog.btrim(job.error_msg) = '' then
          'HTTP ' || coalesce(job.status_code::text, 'response without a status code')
        else pg_catalog.left(
          pg_catalog.regexp_replace(
            pg_catalog.regexp_replace(job.error_msg, 'https?://[^[:space:]]+', '[redacted-url]', 'gi'),
            '[[:cntrl:]]+',
            ' ',
            'g'
          ),
          500
        )
      end;

      update public.media_cleanup_jobs
      set
        attempts = next_attempts,
        status = case
          when next_attempts >= 5 then 'failed'::public.cleanup_status
          else 'pending'::public.cleanup_status
        end,
        request_id = null,
        next_attempt_at = pg_catalog.now() + pg_catalog.make_interval(secs => retry_delay_seconds),
        last_error = sanitized_error,
        updated_at = pg_catalog.now()
      where id = job.id;
    end if;

    handled := handled + 1;
  end loop;

  return handled;
end;
$$;

revoke all on table public.media_cleanup_jobs from public, anon, authenticated, service_role;
revoke all on function public.enqueue_removed_media() from public, anon, authenticated, service_role;
revoke all on function public.expire_media_uploads(timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.process_media_cleanup_jobs(integer) from public, anon, authenticated, service_role;
revoke all on function public.collect_media_cleanup_results() from public, anon, authenticated, service_role;

select cron.schedule(
  'expire-media-uploads',
  '*/10 * * * *',
  $cron$select public.expire_media_uploads(pg_catalog.now())$cron$
);

select cron.schedule(
  'submit-media-cleanup',
  '* * * * *',
  $cron$select public.process_media_cleanup_jobs(25)$cron$
);

select cron.schedule(
  'collect-media-cleanup',
  '*/5 * * * *',
  $cron$select public.collect_media_cleanup_results()$cron$
);

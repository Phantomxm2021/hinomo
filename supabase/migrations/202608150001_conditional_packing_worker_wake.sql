-- Keep the one-minute recovery cadence without booting the Edge Function when
-- both packing queues are idle. Immediate database triggers and the worker's
-- self-wake still provide low-latency processing for newly queued work.

create or replace function private.has_due_packing_work()
returns boolean
language sql
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.packing_analysis_jobs jobs
    where (
      jobs.status = 'pending'::public.packing_job_status
      and jobs.attempts < 5
      and jobs.next_attempt_at <= pg_catalog.now()
    ) or (
      jobs.status = 'processing'::public.packing_job_status
      and jobs.lease_expires_at <= pg_catalog.now()
    )
  ) or exists (
    select 1
    from public.packing_search_alias_jobs jobs
    where (
      jobs.status = 'pending'
      and jobs.attempts < 5
      and jobs.next_attempt_at <= pg_catalog.now()
    ) or (
      jobs.status = 'processing'
      and jobs.lease_expires_at <= pg_catalog.now()
    )
  );
$$;

create or replace function public.has_due_packing_work()
returns boolean
language sql
security definer
set search_path = pg_catalog, public
as $$
  select private.has_due_packing_work();
$$;

create or replace function private.invoke_packing_edge_function_if_due()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.has_due_packing_work() then
    return null;
  end if;
  return private.invoke_packing_edge_function();
end;
$$;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'invoke-packing-edge-function'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'invoke-packing-edge-function',
  '* * * * *',
  $cron$select private.invoke_packing_edge_function_if_due()$cron$
);

revoke all on function private.has_due_packing_work()
  from public, anon, authenticated, service_role;
revoke all on function private.invoke_packing_edge_function_if_due()
  from public, anon, authenticated, service_role;
revoke all on function public.has_due_packing_work()
  from public, anon, authenticated;
grant execute on function public.has_due_packing_work() to service_role;

notify pgrst, 'reload schema';

-- Promotion jobs are created after the original packing session has already
-- completed, so the session-status wake trigger does not run. Wake the Edge
-- Function immediately instead of waiting for the one-minute recovery cron.

create trigger packing_promotion_jobs_wake_edge_function
after insert on public.packing_analysis_jobs
for each row
when (
  new.stage = 'publish'::public.packing_job_stage
  and new.scope_key like 'promotion:%'
)
execute function private.wake_packing_edge_function();

create trigger packing_promotion_retries_wake_edge_function
after update of status on public.packing_analysis_jobs
for each row
when (
  new.stage = 'publish'::public.packing_job_stage
  and new.scope_key like 'promotion:%'
  and new.status = 'pending'::public.packing_job_status
  and old.status is distinct from new.status
)
execute function private.wake_packing_edge_function();

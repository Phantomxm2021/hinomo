begin;
select plan(23);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;

select tests.create_supabase_user('alias-owner');
select tests.authenticate_as('alias-owner');
select public.update_profile_locale('zh-CN');
insert into public.venues (id, owner_id, name)
values ('af000000-0000-4000-8000-000000000001', auth.uid(), 'Alias venue');
insert into public.spaces (id, owner_id, venue_id, name)
values ('af100000-0000-4000-8000-000000000001', auth.uid(),
  'af000000-0000-4000-8000-000000000001', 'Alias space');
insert into public.boxes (id, owner_id, space_id, name, visibility)
values ('af200000-0000-4000-8000-000000000001', auth.uid(),
  'af100000-0000-4000-8000-000000000001', 'Alias box', 'private');
create temporary table alias_test_state (
  owner_id uuid not null,
  box_id uuid not null,
  session_id uuid not null,
  detected_item_id uuid not null,
  first_job_id uuid,
  second_job_id uuid,
  session_status_before text
) on commit drop;
grant select, update on alias_test_state to service_role;
insert into alias_test_state (owner_id, box_id, session_id, detected_item_id)
select auth.uid(), boxes.id, (public.create_packing_session(boxes.id)).id,
  'af400000-0000-4000-8000-000000000001'
from public.boxes boxes
where boxes.id = 'af200000-0000-4000-8000-000000000001';

select tests.clear_authentication();
set local role postgres;
update public.packing_sessions
set status = 'ready'::public.packing_session_status, current_revision = 1
where id = (select session_id from alias_test_state);
insert into public.packing_detected_items (
  id, session_id, box_id, analysis_revision, name, category, description,
  quantity_kind, quantity_value, visibility, crop_status, cover_object_key,
  cover_mime_type, cover_size_bytes, cover_width, cover_height, model_id,
  prompt_version, published_at, search_aliases
)
select detected_item_id, session_id, box_id, 1, 'Keyboard', 'Tools', null,
  'exact'::public.packing_quantity_kind, 1, 'clear'::public.packing_visibility,
  'ready'::public.packing_crop_status,
  'users/' || owner_id || '/boxes/' || box_id || '/packing/alias-cover.webp',
  'image/webp', 512, 64, 64, 'qwen-test', 'prompt-test', pg_catalog.now(),
  '{}'::text[]
from alias_test_state;
insert into public.packing_search_alias_jobs (detected_item_id, alias_version)
select detected_item_id, 'packing-alias-v1' from alias_test_state;
update alias_test_state
set session_status_before = (
  select status::text from public.packing_sessions where id = session_id
);

set local role service_role;
update alias_test_state state
set first_job_id = claims.job_id
from lateral public.claim_packing_search_alias_jobs(25, 390) claims
where state.detected_item_id = claims.detected_item_id
  and claims.alias_version = 'packing-alias-v1';
select is((select count(*)::integer from alias_test_state where first_job_id is not null), 1,
  'service role can claim a historical alias job');
set local role postgres;

set local role service_role;
select public.complete_packing_search_alias_job(
  (select first_job_id from alias_test_state), array['键盘', 'keyboard']::text[]
);
set local role postgres;
select is(
  (select search_aliases from public.packing_detected_items
   where id = (select detected_item_id from alias_test_state)),
  array['键盘', 'keyboard']::text[],
  'alias completion updates only the detected item aliases'
);
select is(
  (select status::text from public.packing_sessions where id = (select session_id from alias_test_state)),
  (select session_status_before from alias_test_state),
  'alias completion preserves the packing session status'
);
select is(
  (select status from public.packing_search_alias_jobs where id = (select first_job_id from alias_test_state)),
  'completed', 'alias completion marks the isolated job complete'
);

select tests.authenticate_as('alias-owner');
select public.request_packing_item_promotion((select detected_item_id from alias_test_state));
select tests.clear_authentication();
set local role service_role;
select public.finalize_packing_item_promotion(
  (select id from public.packing_item_promotions
   where detected_item_id = (select detected_item_id from alias_test_state)),
  'image/webp', 512
);
set local role postgres;
-- Simulate a promotion that completed while this backfill lease was running;
-- the isolated completion RPC must merge the aliases into its formal target.
update public.items target
set search_aliases = '{}'::text[]
from public.packing_item_promotions promotions
where promotions.detected_item_id = (select detected_item_id from alias_test_state)
  and promotions.target_item_id = target.id;
insert into public.packing_search_alias_jobs (detected_item_id, alias_version)
select detected_item_id, 'packing-alias-v2' from alias_test_state;
set local role service_role;
update alias_test_state state
set second_job_id = claims.job_id
from lateral public.claim_packing_search_alias_jobs(25, 390) claims
where state.detected_item_id = claims.detected_item_id
  and claims.alias_version = 'packing-alias-v2';
select public.complete_packing_search_alias_job(
  (select second_job_id from alias_test_state), array['键盘', 'keyboard']::text[]
);
set local role postgres;
select is(
  (select search_aliases from public.items
   where id = (select target_item_id from public.packing_item_promotions
               where detected_item_id = (select detected_item_id from alias_test_state))),
  array['键盘', 'keyboard']::text[],
  'alias completion merges aliases into a completed promotion target'
);

select has_column('public', 'packing_atlases', 'upload_status', 'Atlas upload status exists');
select has_column('public', 'packing_atlases', 'confirmed_at', 'Atlas confirmation time exists');
select has_function('public', 'create_packing_atlas_upload',
  array['uuid', 'integer', 'integer', 'integer', 'integer', 'integer', 'bigint', 'text'],
  'client Atlas upload RPC exists');
select has_function('public', 'confirm_packing_atlas_upload', array['uuid'], 'Atlas confirmation RPC exists');
select has_function('public', 'delete_packing_photo', array['uuid'], 'capturing photo removal RPC exists');
select has_function('public', 'create_packing_service_media_url', array['text', 'text', 'text'],
  'service media signing RPC exists');
select ok(has_function_privilege('authenticated',
  'public.create_packing_atlas_upload(uuid, integer, integer, integer, integer, integer, bigint, text)', 'execute'),
  'authenticated users can prepare their Atlas upload');
select ok(not has_function_privilege('authenticated',
  'public.create_packing_service_media_url(text, text, text)', 'execute'),
  'clients cannot create worker media URLs');
select ok(has_function_privilege('authenticated',
  'public.delete_packing_photo(uuid)', 'execute'),
  'authenticated users can remove their own capturing photos');
select trigger_is('public', 'packing_sessions', 'packing_sessions_require_client_atlases',
  'private.validate_packing_atlases_before_queue()', 'queue transition requires persisted Atlases');
select trigger_is('public', 'packing_sessions', 'packing_sessions_wake_edge_function',
  'private.wake_packing_edge_function()', 'queued sessions wake the Edge Function');
select is((select count(*)::integer from cron.job where jobname = 'invoke-packing-edge-function'), 1,
  'Cron fallback invokes the packing Edge Function');

select has_table('public', 'packing_search_alias_jobs', 'historical alias backfill queue exists');
select has_function('public', 'claim_packing_search_alias_jobs', array['integer', 'integer'],
  'worker can lease historical alias jobs');
select has_function('public', 'complete_packing_search_alias_job', array['uuid', 'text[]'],
  'worker can complete historical alias jobs');
select has_function('public', 'fail_packing_search_alias_job', array['uuid', 'text', 'boolean'],
  'worker can retry historical alias jobs');
select ok(not has_table_privilege('authenticated', 'public.packing_search_alias_jobs', 'select'),
  'clients cannot inspect historical alias jobs');
select ok(not has_function_privilege('authenticated',
  'public.claim_packing_search_alias_jobs(integer, integer)', 'execute'),
  'clients cannot lease historical alias jobs');

select * from finish();
rollback;

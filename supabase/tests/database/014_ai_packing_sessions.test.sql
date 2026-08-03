begin;
select plan(29);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;

select vault.create_secret('0123456789abcdef0123456789abcdef', 'r2_account_id', 'packing test account');
select vault.create_secret('nomo-test-bucket', 'r2_bucket_name', 'packing test bucket');
select vault.create_secret('R2TESTACCESSKEY', 'r2_access_key_id', 'packing test access key');
select vault.create_secret('r2-test-secret-key', 'r2_secret_access_key', 'packing test secret key');

select tests.create_supabase_user('packing-owner');
select tests.create_supabase_user('packing-other');
select tests.clear_authentication();
set local role postgres;

create temporary table packing_test_state (
  owner_id uuid not null,
  other_id uuid not null,
  box_id uuid not null,
  session_id uuid,
  photo_id uuid,
  atlas_id uuid,
  object_key text,
  upload_url text,
  disposable_session_id uuid
) on commit drop;

grant select, update on packing_test_state to authenticated;

insert into packing_test_state (owner_id, other_id, box_id)
values (
  tests.get_supabase_uid('packing-owner'),
  tests.get_supabase_uid('packing-other'),
  'ab000000-0000-4000-8000-000000000001'
);

insert into public.venues (id, owner_id, name)
select 'aa000000-0000-4000-8000-000000000001', owner_id, 'AI 装箱场地' from packing_test_state;
insert into public.spaces (id, owner_id, venue_id, name)
select 'aa100000-0000-4000-8000-000000000001', owner_id,
  'aa000000-0000-4000-8000-000000000001', 'AI 装箱空间' from packing_test_state;
insert into public.boxes (id, owner_id, space_id, name, visibility)
select box_id, owner_id, 'aa100000-0000-4000-8000-000000000001', 'AI 装箱测试箱', 'private'
from packing_test_state;

select has_table('public', 'packing_sessions', 'packing sessions table exists');
select has_table('public', 'packing_detected_instances', 'physical instance table exists');
select has_table('public', 'packing_detected_items', 'AI checklist table exists');
select has_table('public', 'packing_detected_instance_evidence', 'instance evidence table exists');
select has_table('public', 'packing_item_promotions', 'promotion workflow table exists');
select has_function('public', 'create_packing_session', array['uuid'], 'create session RPC exists');
select has_function('public', 'complete_packing_session', array['uuid'], 'complete session RPC exists');
select has_function('public', 'claim_packing_analysis_jobs', array['integer', 'integer'], 'worker claim RPC exists');
select has_function('public', 'update_packing_detected_item', array['uuid', 'text', 'text', 'text', 'packing_quantity_kind', 'integer', 'packing_review_status'], 'controlled AI item update RPC exists');
select has_function('public', 'merge_packing_detected_items', array['uuid', 'uuid'], 'AI item merge RPC exists');
select has_function('public', 'request_packing_item_promotion', array['uuid'], 'promotion request RPC exists');
select has_function('public', 'request_packing_reanalysis', array['uuid'], 'reanalysis RPC exists');
select ok(not has_table_privilege('authenticated', 'public.packing_analysis_jobs', 'select'), 'clients cannot inspect worker jobs');
select ok(not has_table_privilege('authenticated', 'public.packing_detected_items', 'update'), 'clients edit AI items only through controlled RPCs');

select tests.authenticate_as('packing-owner');
update packing_test_state
set session_id = (public.create_packing_session(box_id)).id;

select is(
  (select status::text from public.packing_sessions where id = (select session_id from packing_test_state)),
  'capturing',
  'owner creates a capturing session'
);

select throws_ok(
  $$select public.complete_packing_session((select session_id from packing_test_state))$$,
  '22023', 'all packing photos must be uploaded before completion',
  'an empty session cannot be completed'
);

with upload as (
  select * from public.create_packing_photo_upload(
    (select session_id from packing_test_state), 1, 'image/webp', 1024
  )
)
update packing_test_state state
set photo_id = upload.photo_id, object_key = upload.object_key, upload_url = upload.upload_url
from upload;

select like(
  (select object_key from packing_test_state),
  'users/%/boxes/%/packing/%/original/%.webp',
  'packing photo uses the private session object path'
);
select like(
  (select upload_url from packing_test_state),
  '%X-Amz-SignedHeaders=content-type%3Bhost%',
  'packing upload signs the content type'
);
select is(
  (select photo_id from public.create_packing_photo_upload(
    (select session_id from packing_test_state), 1, 'image/webp', 1024
  )),
  (select photo_id from packing_test_state),
  'repeating an unfinished upload request is idempotent'
);

select public.confirm_packing_photo_upload((select photo_id from packing_test_state));
select is(
  (select upload_status::text from public.packing_photos where id = (select photo_id from packing_test_state)),
  'confirmed',
  'owner confirms the uploaded photo'
);

with upload as (
  select * from public.create_packing_atlas_upload(
    (select session_id from packing_test_state), 1, 1, 1, 512, 552, 2048, repeat('a', 64)
  )
)
update packing_test_state state set atlas_id = upload.atlas_id from upload;
select public.confirm_packing_atlas_upload((select atlas_id from packing_test_state));

select is(
  (public.complete_packing_session((select session_id from packing_test_state))).status::text,
  'queued',
  'completed session enters the worker queue'
);
select is(
  (select count(*)::integer from public.packing_analysis_jobs
   where session_id = (select session_id from packing_test_state) and stage = 'observe'),
  1,
  'completion creates one Atlas observation job'
);
select lives_ok(
  $$select public.complete_packing_session((select session_id from packing_test_state))$$,
  'completing an already queued session is idempotent'
);
select is(
  (select count(*)::integer from public.packing_analysis_jobs
   where session_id = (select session_id from packing_test_state)),
  1,
  'idempotent completion does not duplicate jobs'
);

update packing_test_state
set disposable_session_id = (public.create_packing_session(box_id)).id;
select lives_ok(
  $$select public.cancel_packing_session((select disposable_session_id from packing_test_state))$$,
  'owner can cancel an unfinished session'
);
select is(
  (select status::text from public.packing_sessions where id = (select disposable_session_id from packing_test_state)),
  'canceled',
  'canceled session keeps an explicit terminal state'
);

select tests.authenticate_as('packing-other');
select is(
  (select count(*)::integer from public.packing_sessions where id = (select session_id from packing_test_state)),
  0,
  'another owner cannot read the session'
);
select throws_ok(
  $$select public.delete_packing_session((select session_id from packing_test_state))$$,
  '42501', 'packing session is not accessible',
  'another owner cannot delete the session'
);

select tests.authenticate_as('packing-owner');
select lives_ok(
  $$select public.delete_packing_session((select disposable_session_id from packing_test_state))$$,
  'owner can delete a packing session'
);

select * from finish();
rollback;

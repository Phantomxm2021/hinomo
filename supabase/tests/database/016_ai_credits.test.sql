begin;
select plan(15);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('credit-buyer');
select tests.create_supabase_user('credit-empty');
select tests.clear_authentication();
set local role postgres;

create temporary table credit_test_state (
  buyer_id uuid not null,
  empty_id uuid not null,
  box_id uuid not null,
  session_id uuid,
  photo_id uuid,
  atlas_id uuid
) on commit drop;
grant select, update on credit_test_state to authenticated;
insert into credit_test_state values (
  tests.get_supabase_uid('credit-buyer'), tests.get_supabase_uid('credit-empty'),
  'cb000000-0000-4000-8000-000000000001', null, null, null
);
insert into public.venues (id, owner_id, name)
select 'ca000000-0000-4000-8000-000000000001', buyer_id, '额度测试场地' from credit_test_state;
insert into public.spaces (id, owner_id, venue_id, name)
select 'ca100000-0000-4000-8000-000000000001', buyer_id,
  'ca000000-0000-4000-8000-000000000001', '额度测试空间' from credit_test_state;
insert into public.boxes (id, owner_id, space_id, name, visibility)
select box_id, buyer_id, 'ca100000-0000-4000-8000-000000000001', '额度测试箱', 'private' from credit_test_state;
insert into public.credit_grants (
  user_id, kind, original_credits, remaining_credits, effective_at, expires_at, source_reference
)
select buyer_id, 'purchased', 2, 2, pg_catalog.now() - interval '1 minute',
  null, 'checkout:cs_credit_test' from credit_test_state;

select has_table('public', 'billing_customers', 'Stripe customer mapping exists');
select has_table('public', 'credit_grants', 'credit grants exist');
select has_table('public', 'credit_transactions', 'append-only credit ledger exists');
select has_table('public', 'credit_reservations', 'packing reservations exist');
select has_function('public', 'get_credit_summary', array[]::text[], 'credit summary RPC exists');
select has_function('public', 'list_credit_transactions', array['integer'], 'credit history RPC exists');
select ok(not has_table_privilege('authenticated', 'public.credit_grants', 'update'), 'clients cannot mutate grants');

select tests.authenticate_as('credit-empty');
select is((select credits_available from public.get_credit_summary()), 0, 'users can have an empty prepaid balance');

select tests.authenticate_as('credit-buyer');
select is((select credits_available from public.get_credit_summary()), 2, 'purchased credit is reported');
update credit_test_state set session_id = (public.create_packing_session(box_id)).id;
with upload as (
  select * from public.create_packing_photo_upload((select session_id from credit_test_state), 1, 'image/webp', 1024)
) update credit_test_state state set photo_id = upload.photo_id from upload;
select public.confirm_packing_photo_upload((select photo_id from credit_test_state));
with upload as (
  select * from public.create_packing_atlas_upload(
    (select session_id from credit_test_state), 1, 1, 1, 512, 552, 2048, repeat('b', 64)
  )
) update credit_test_state state set atlas_id = upload.atlas_id from upload;
select public.confirm_packing_atlas_upload((select atlas_id from credit_test_state));
select is((public.complete_packing_session((select session_id from credit_test_state))).status::text,
  'queued', 'credit balance reserves and queues analysis');
select is((select credits_available from public.get_credit_summary()), 1, 'reservation removes credit from available balance');
select is((select credits_reserved from public.get_credit_summary()), 1, 'reserved credit is reported separately');
select is((select count(*)::integer from public.credit_transactions where kind = 'reserve'), 1,
  'reservation creates one ledger entry');
select lives_ok(
  $$select public.complete_packing_session((select session_id from credit_test_state))$$,
  'idempotent completion does not reserve again'
);
select is((select count(*)::integer from public.credit_reservations), 1,
  'idempotent completion keeps one reservation');

select * from finish();
rollback;

begin;
select plan(31);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('box-limit-owner');
select tests.create_supabase_user('box-limit-empty');
select tests.create_supabase_user('box-limit-other');
select tests.clear_authentication();
set local role postgres;

create temporary table box_entitlement_test_state (
  owner_id uuid not null,
  legacy_id uuid not null,
  other_id uuid not null,
  owner_space_id uuid not null,
  legacy_space_id uuid not null,
  box_id uuid,
  legacy_box_1_id uuid not null,
  legacy_box_2_id uuid not null,
  legacy_box_3_id uuid not null,
  legacy_box_4_id uuid not null
) on commit drop;
grant select, update on box_entitlement_test_state to authenticated;

insert into box_entitlement_test_state values (
  tests.get_supabase_uid('box-limit-owner'),
  tests.get_supabase_uid('box-limit-empty'),
  tests.get_supabase_uid('box-limit-other'),
  '18000000-0000-4000-8000-000000000001',
  '18000000-0000-4000-8000-000000000002',
  null,
  '18000000-0000-4000-8000-000000000011',
  '18000000-0000-4000-8000-000000000012',
  '18000000-0000-4000-8000-000000000013',
  '18000000-0000-4000-8000-000000000014'
);

insert into public.venues (id, owner_id, name)
select '18000000-0000-4000-8000-000000000101', owner_id, 'Box limit owner venue'
from box_entitlement_test_state
union all
select '18000000-0000-4000-8000-000000000102', legacy_id, 'Box limit legacy venue'
from box_entitlement_test_state;

insert into public.spaces (id, owner_id, venue_id, name)
select owner_space_id, owner_id, '18000000-0000-4000-8000-000000000101', 'Box limit owner space'
from box_entitlement_test_state
union all
select legacy_space_id, legacy_id, '18000000-0000-4000-8000-000000000102', 'Box limit legacy space'
from box_entitlement_test_state;

select has_table('public', 'account_entitlements', 'account entitlement ledger exists');
select has_function('public', 'get_box_plan_summary', array[]::text[], 'box plan summary exists');
select has_function('public', 'create_box',
  array['uuid', 'text', 'text', 'text', 'text', 'public.box_visibility'],
  'atomic box creation RPC exists');
select has_function('public', 'grant_account_entitlement',
  array['uuid', 'text', 'text', 'text', 'timestamptz'],
  'service-only entitlement grant exists');
select has_function('public', 'revoke_account_entitlement',
  array['text', 'text'], 'service-only entitlement revoke exists');

select tests.authenticate_as('box-limit-owner');
select is((select box_count from public.get_box_plan_summary()), 0, 'a new account starts with zero boxes');
select is((select free_limit from public.get_box_plan_summary()), 3, 'the free box limit is three');
select is((select unlimited_boxes from public.get_box_plan_summary()), false, 'a new account does not have unlimited boxes');
select is((select can_create from public.get_box_plan_summary()), true, 'a new account can create a box');

with created as (
  select public.create_box((select owner_space_id from box_entitlement_test_state), 'Limit box 1', null, null, null, 'private') as box
)
update box_entitlement_test_state set box_id = (created.box).id from created;
select public.create_box((select owner_space_id from box_entitlement_test_state), 'Limit box 2', null, null, null, 'private');
select public.create_box((select owner_space_id from box_entitlement_test_state), 'Limit box 3', null, null, null, 'private');
select is((select box_count from public.get_box_plan_summary()), 3, 'three boxes consume the whole free limit');
select throws_ok(
  $$select public.create_box('18000000-0000-4000-8000-000000000001', 'Limit box 4', null, null, null, 'private')$$,
  'P0001', 'box_limit_reached', 'a fourth free box is rejected with box_limit_reached'
);
select is((select count(*)::integer from public.boxes where owner_id = auth.uid()), 3, 'a rejected create does not add a fourth box');
delete from public.boxes where id = (select box_id from box_entitlement_test_state);
select lives_ok(
  $$select public.create_box('18000000-0000-4000-8000-000000000001', 'Limit box replacement', null, null, null, 'private')$$,
  'deleting a box frees a free-limit slot'
);
select is((select box_count from public.get_box_plan_summary()), 3,
  'a replacement box restores the count to the free limit');

select tests.clear_authentication();
set local role postgres;
insert into public.boxes (id, owner_id, space_id, name, visibility)
select legacy_box_1_id, legacy_id, legacy_space_id, 'Legacy box 1', 'private' from box_entitlement_test_state
union all select legacy_box_2_id, legacy_id, legacy_space_id, 'Legacy box 2', 'private' from box_entitlement_test_state
union all select legacy_box_3_id, legacy_id, legacy_space_id, 'Legacy box 3', 'private' from box_entitlement_test_state
union all select legacy_box_4_id, legacy_id, legacy_space_id, 'Legacy box 4', 'private' from box_entitlement_test_state;
select tests.authenticate_as('box-limit-empty');
select is((select box_count from public.get_box_plan_summary()), 4, 'a legacy account may retain four existing boxes');
select is((select can_create from public.get_box_plan_summary()), false, 'a legacy account over the limit cannot create another box');
select is((select count(*)::integer from public.boxes where owner_id = auth.uid()), 4, 'a legacy account can still read its existing boxes');

select tests.clear_authentication();
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select is(
  (select created from public.grant_account_entitlement(
    (select owner_id from box_entitlement_test_state), 'boxes_unlimited_lifetime', 'lifetime', 'checkout:box-limit-1', null
  )),
  true,
  'the first lifetime entitlement grant is created'
);
select is(
  (select created from public.grant_account_entitlement(
    (select owner_id from box_entitlement_test_state), 'boxes_unlimited_lifetime', 'lifetime', 'checkout:box-limit-1', null
  )),
  false,
  'a repeated entitlement source is idempotent'
);
select is((select count(*)::integer from public.account_entitlements
  where user_id = (select owner_id from box_entitlement_test_state)
    and entitlement_code = 'boxes_unlimited_lifetime'
    and source_reference = 'checkout:box-limit-1'), 1,
  'an idempotent grant does not add a second entitlement row');

select tests.authenticate_as('box-limit-owner');
select is((select unlimited_boxes from public.get_box_plan_summary()), true, 'a lifetime entitlement enables unlimited boxes');
select is((select can_create from public.get_box_plan_summary()), true, 'a lifetime entitlement allows creating more boxes');
select lives_ok(
  $$select public.create_box('18000000-0000-4000-8000-000000000001', 'Unlimited box 5', null, null, null, 'private')$$,
  'an entitled account can create more than three boxes'
);

select tests.clear_authentication();
select set_config('request.jwt.claim.role', 'service_role', true);
select lives_ok(
  $$select public.revoke_account_entitlement('lifetime', 'checkout:box-limit-1')$$,
  'revoking an entitlement source succeeds'
);
select lives_ok(
  $$select public.revoke_account_entitlement('lifetime', 'checkout:box-limit-1')$$,
  'repeating an entitlement revocation is harmless'
);
select tests.authenticate_as('box-limit-owner');
select is((select unlimited_boxes from public.get_box_plan_summary()), false, 'revocation restores the free plan');
select is((select can_create from public.get_box_plan_summary()), false, 'a four-box account cannot create after revocation');

select tests.clear_authentication();
select set_config('request.jwt.claim.role', 'service_role', true);
select public.grant_account_entitlement(
  (select owner_id from box_entitlement_test_state), 'boxes_unlimited_lifetime', 'lifetime', 'checkout:box-limit-2', null
);
select is((select count(*)::integer from public.account_entitlements
  where user_id = (select owner_id from box_entitlement_test_state)
    and entitlement_code = 'boxes_unlimited_lifetime'
    and source_reference = 'checkout:box-limit-1'
    and revoked_at is not null), 1,
  'revoked entitlement history is retained');
select is((select count(*)::integer from public.account_entitlements
  where user_id = (select owner_id from box_entitlement_test_state)
    and entitlement_code = 'boxes_unlimited_lifetime'
    and revoked_at is null), 1,
  'a replacement source leaves exactly one active entitlement for the owner');

select tests.authenticate_as('box-limit-other');
select throws_ok(
  $$select public.create_box('18000000-0000-4000-8000-000000000001', 'Other owner box', null, null, null, 'private')$$,
  '42501', null, 'another user cannot create a box in the owner space'
);
select tests.clear_authentication();
select throws_ok(
  $$select public.create_box('18000000-0000-4000-8000-000000000001', 'Anonymous box', null, null, null, 'private')$$,
  '42501', null, 'anonymous users cannot create boxes'
);

select * from finish();
rollback;

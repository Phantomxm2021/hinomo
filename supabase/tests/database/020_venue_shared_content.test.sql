begin;
select plan(51);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('shared-content-owner');
select tests.create_supabase_user('shared-content-member');
select tests.create_supabase_user('shared-content-outsider');

create temporary table shared_content_state (
  owner_id uuid not null,
  member_id uuid not null,
  outsider_id uuid not null,
  shared_venue_id uuid not null,
  private_venue_id uuid not null,
  second_owner_venue_id uuid not null,
  shared_space_id uuid not null,
  second_owner_space_id uuid not null,
  owner_box_id uuid,
  member_box_id uuid,
  member_item_id uuid
) on commit drop;
grant select on shared_content_state to authenticated;

insert into shared_content_state (
  owner_id, member_id, outsider_id, shared_venue_id, private_venue_id,
  second_owner_venue_id, shared_space_id, second_owner_space_id
) values (
  tests.get_supabase_uid('shared-content-owner'),
  tests.get_supabase_uid('shared-content-member'),
  tests.get_supabase_uid('shared-content-outsider'),
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000011',
  '20000000-0000-4000-8000-000000000012'
);

select tests.authenticate_as('shared-content-owner');
insert into public.venues (id, owner_id, name) values
  ((select shared_venue_id from shared_content_state), auth.uid(), 'Shared venue'),
  ((select private_venue_id from shared_content_state), auth.uid(), 'Private venue'),
  ((select second_owner_venue_id from shared_content_state), auth.uid(), 'Second owner venue');
insert into public.spaces (id, owner_id, venue_id, name) values
  ((select shared_space_id from shared_content_state), auth.uid(), (select shared_venue_id from shared_content_state), 'Shared space'),
  ((select second_owner_space_id from shared_content_state), auth.uid(), (select second_owner_venue_id from shared_content_state), 'Second owner space');

select public.create_box((select shared_space_id from shared_content_state), 'Owner box one', null, null, null, 'private');
with created as (
  select public.create_box((select shared_space_id from shared_content_state), 'Owner box two', null, null, null, 'private') as box
)
update shared_content_state set owner_box_id = (created.box).id from created;

select tests.clear_authentication();
set local role postgres;
insert into public.venue_members (venue_id, user_id)
select shared_venue_id, member_id from shared_content_state;

select tests.authenticate_as('shared-content-outsider');
insert into public.venues (id, owner_id, name) values ('20000000-0000-4000-8000-000000000004', auth.uid(), 'Outsider venue');
insert into public.spaces (id, owner_id, venue_id, name)
values ('20000000-0000-4000-8000-000000000013', auth.uid(), '20000000-0000-4000-8000-000000000004', 'Outsider space');
select public.create_box('20000000-0000-4000-8000-000000000013', 'Outsider public box', null, null, null, 'public');

select has_function('public', 'create_space', array['uuid', 'text', 'text'], 'member-safe create space RPC exists');
select has_function('public', 'update_space', array['uuid', 'uuid', 'text', 'text'], 'member-safe update space RPC exists');
select has_function('public', 'save_space_layout', array['uuid', 'numeric', 'numeric', 'numeric', 'numeric'], 'member-safe layout RPC exists');
select has_function('public', 'get_venue_box_plan_summary', array['uuid'], 'venue box summary RPC exists');
select has_function('public', 'list_accessible_boxes', array['uuid'], 'accessible box list RPC exists');
select has_function('public', 'update_box', array['uuid', 'uuid', 'text', 'text', 'text', 'text', 'public.box_visibility'], 'member-safe update box RPC exists');

select tests.authenticate_as('shared-content-member');
select is((select count(*)::integer from public.venues where id = (select shared_venue_id from shared_content_state)), 1,
  'member reads the shared venue');
select is((select count(*)::integer from public.spaces where id = (select shared_space_id from shared_content_state)), 1,
  'member reads the shared space');
select is((select count(*)::integer from public.boxes where id = (select owner_box_id from shared_content_state)), 1,
  'member reads a shared box');
select is((select count(*)::integer from public.items where box_id = (select owner_box_id from shared_content_state)), 0,
  'member can query shared items');
select is((select count(*)::integer from public.venues where id = (select private_venue_id from shared_content_state)), 0,
  'member cannot read the owner private venue');
select is((select count(*)::integer from public.list_accessible_boxes(null) where name = 'Outsider public box'), 0,
  'unfiltered accessible boxes do not leak unrelated public boxes');

create temporary table member_created_space on commit drop as
select * from public.create_space((select shared_venue_id from shared_content_state), 'Member space', 'Created by member');
grant select on member_created_space to authenticated;
select is((select owner_id from public.spaces where id = (select id from member_created_space)), (select owner_id from shared_content_state),
  'member-created space is owned by the venue owner');
select lives_ok(
  $$select public.update_space((select id from member_created_space), (select shared_venue_id from shared_content_state), 'Renamed member space', 'Edited by member')$$,
  'member can edit a shared space through the RPC'
);
select lives_ok(
  $$select public.save_space_layout((select id from member_created_space), 10, 10, 30, 30)$$,
  'member can save a shared space layout through the RPC'
);
select is((select owner_id from public.space_layouts where space_id = (select id from member_created_space)), (select owner_id from shared_content_state),
  'member-saved layout is owned by the venue owner');
select lives_ok(
  $$insert into public.spaces (id, owner_id, venue_id, name)
    values ('20000000-0000-4000-8000-000000000014', auth.uid(), (select shared_venue_id from shared_content_state), 'Direct member space')$$,
  'owner compatibility space insert allows member low-risk content creation'
);
select is((select owner_id from public.spaces where id = '20000000-0000-4000-8000-000000000014'), (select owner_id from shared_content_state),
  'direct member space insert cannot forge the venue owner');

insert into public.venues (id, owner_id, name)
values ('20000000-0000-4000-8000-000000000005', auth.uid(), 'Member personal venue');
insert into public.spaces (id, owner_id, venue_id, name)
values ('20000000-0000-4000-8000-000000000015', auth.uid(), '20000000-0000-4000-8000-000000000005', 'Member personal space');
select lives_ok(
  $$select public.create_box('20000000-0000-4000-8000-000000000015', 'Member personal box', null, null, null, 'private')$$,
  'member can create an independent personal box'
);
select is((select box_count from public.get_box_plan_summary()), 1,
  'member has an independent personal box count');
select is((select box_count from public.get_venue_box_plan_summary((select shared_venue_id from shared_content_state))), 2,
  'member personal boxes do not consume the shared venue owner quota');

with created as (
  select public.create_box((select id from member_created_space), 'Member box', null, null, null, 'private') as box
)
update shared_content_state set member_box_id = (created.box).id from created;
select is((select owner_id from public.boxes where id = (select member_box_id from shared_content_state)), (select owner_id from shared_content_state),
  'member-created third box belongs to the venue owner');
select is((select box_count from public.get_venue_box_plan_summary((select shared_venue_id from shared_content_state))), 3,
  'venue box summary counts the venue owner boxes');
select throws_ok(
  $$select public.create_box((select id from member_created_space), 'Over limit', null, null, null, 'private')$$,
  'P0001', 'box_limit_reached', 'member is limited by the venue owner box quota'
);
select tests.clear_authentication();
select set_config('request.jwt.claim.role', 'service_role', true);
select public.grant_account_entitlement((select member_id from shared_content_state), 'boxes_unlimited_lifetime', 'test', 'shared-content-member-unlimited', null);
select tests.authenticate_as('shared-content-member');
select is((select unlimited_boxes from public.get_venue_box_plan_summary((select shared_venue_id from shared_content_state))), false,
  'member unlimited entitlement does not make the venue owner quota unlimited');
select throws_ok(
  $$select public.create_box((select id from member_created_space), 'Still over owner limit', null, null, null, 'private')$$,
  'P0001', 'box_limit_reached', 'member entitlement cannot bypass the venue owner box quota'
);
select lives_ok(
  $$select public.update_box((select member_box_id from shared_content_state), (select shared_space_id from shared_content_state), 'Moved member box', null, 'Shelf', null, 'private')$$,
  'member can edit and move a box within the shared venue'
);
select lives_ok(
  $$insert into public.items (id, box_id, name, quantity) values ('20000000-0000-4000-8000-000000000021', (select member_box_id from shared_content_state), 'Member item', 1)$$,
  'member can create an item in a shared box'
);
update shared_content_state set member_item_id = '20000000-0000-4000-8000-000000000021';
select lives_ok(
  $$update public.items set name = 'Edited member item' where id = (select member_item_id from shared_content_state)$$,
  'member can edit an item in a shared box'
);
select lives_ok(
  $$select public.move_item((select member_item_id from shared_content_state), (select owner_box_id from shared_content_state), null)$$,
  'member can move an item within the shared venue'
);
select lives_ok(
  $$delete from public.items where id = (select member_item_id from shared_content_state)$$,
  'member can delete an item in a shared box'
);

select is_empty(
  $$delete from public.spaces where id = (select shared_space_id from shared_content_state) returning id$$,
  'member cannot delete a shared space'
);
select is_empty(
  $$delete from public.boxes where id = (select member_box_id from shared_content_state) returning id$$,
  'member cannot delete a shared box'
);
select is_empty(
  $$delete from public.venues where id = (select shared_venue_id from shared_content_state) returning id$$,
  'member cannot delete a shared venue'
);
select throws_ok(
  $$select public.update_box((select member_box_id from shared_content_state), (select shared_space_id from shared_content_state), 'No visibility change', null, null, null, 'public')$$,
  'P0001', 'venue_owner_required', 'member cannot change box visibility through the RPC'
);
select throws_ok(
  $$update public.boxes set visibility = 'public' where id = (select member_box_id from shared_content_state)$$,
  'P0001', 'venue_owner_required', 'compatibility box update grant cannot change member visibility'
);
select throws_ok(
  $$update public.spaces set venue_id = (select private_venue_id from shared_content_state) where id = (select id from member_created_space)$$,
  'P0001', 'venue_owner_required', 'compatibility space update grant cannot move a member space'
);
select throws_ok(
  $$update public.boxes set space_id = (select second_owner_space_id from shared_content_state) where id = (select member_box_id from shared_content_state)$$,
  'P0001', 'venue_access_denied', 'compatibility box update grant cannot move a member box across venues'
);
select throws_ok(
  $$select public.update_space((select id from member_created_space), (select private_venue_id from shared_content_state), 'Wrong venue', null)$$,
  'P0001', 'venue_owner_required', 'member cannot move a space to another venue'
);
select throws_ok(
  $$select public.update_box((select member_box_id from shared_content_state), (select second_owner_space_id from shared_content_state), 'Wrong venue box', null, null, null, 'private')$$,
  'P0001', 'venue_access_denied', 'member cannot move a box to another venue'
);

select tests.authenticate_as('shared-content-outsider');
select is((select count(*)::integer from public.venues where id = (select shared_venue_id from shared_content_state)), 0,
  'outsider cannot read the shared venue');
select is((select count(*)::integer from public.spaces where id = (select shared_space_id from shared_content_state)), 0,
  'outsider cannot read the shared space');
select is((select count(*)::integer from public.boxes where id = (select member_box_id from shared_content_state)), 0,
  'outsider cannot read private shared boxes');
select throws_ok(
  $$select * from public.create_space((select shared_venue_id from shared_content_state), 'Outsider space', null)$$,
  'P0001', 'venue_access_denied', 'outsider cannot create shared spaces'
);
select throws_ok(
  $$select public.create_box((select shared_space_id from shared_content_state), 'Outsider box', null, null, null, 'private')$$,
  '42501', 'space is not accessible', 'outsider cannot create shared boxes'
);

select tests.clear_authentication();
select set_config('request.jwt.claim.role', 'service_role', true);
select public.grant_account_entitlement((select owner_id from shared_content_state), 'boxes_unlimited_lifetime', 'test', 'shared-content-owner-unlimited', null);
select tests.authenticate_as('shared-content-member');
select lives_ok(
  $$select public.create_box((select shared_space_id from shared_content_state), 'Unlimited member box', null, null, null, 'private')$$,
  'owner unlimited entitlement lets a member create another shared box'
);
select is((select unlimited_boxes from public.get_venue_box_plan_summary((select shared_venue_id from shared_content_state))), true,
  'venue summary uses the owner entitlement rather than the member entitlement');

select tests.authenticate_as('shared-content-owner');
select lives_ok(
  $$update public.spaces set name = 'Owner direct compatibility' where id = (select shared_space_id from shared_content_state)$$,
  'owner direct space update remains compatible'
);
select lives_ok(
  $$update public.boxes set visibility = 'public' where id = (select member_box_id from shared_content_state)$$,
  'owner direct box visibility update remains compatible'
);
select lives_ok(
  $$delete from public.boxes where id = (select member_box_id from shared_content_state)$$,
  'owner can still delete a shared box'
);
select lives_ok(
  $$select public.create_box((select shared_space_id from shared_content_state), 'Owner compatibility create', null, null, null, 'private')$$,
  'owner can still create a shared box through the existing RPC'
);

select * from finish();
rollback;

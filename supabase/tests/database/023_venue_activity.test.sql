begin;
select plan(42);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('venue-activity-owner');
select tests.create_supabase_user('venue-activity-member');
select tests.create_supabase_user('venue-activity-outsider');

create temporary table activity_state (
  owner_id uuid not null,
  member_id uuid not null,
  outsider_id uuid not null,
  venue_a_id uuid not null,
  venue_b_id uuid not null,
  space_a_id uuid not null,
  space_a_target_id uuid not null,
  space_b_id uuid not null,
  box_a_id uuid not null,
  box_a_target_id uuid not null,
  box_b_id uuid not null,
  item_id uuid not null
) on commit drop;
grant select on activity_state to authenticated;

insert into activity_state values (
  tests.get_supabase_uid('venue-activity-owner'),
  tests.get_supabase_uid('venue-activity-member'),
  tests.get_supabase_uid('venue-activity-outsider'),
  '23000000-0000-4000-8000-000000000001',
  '23000000-0000-4000-8000-000000000002',
  '23000000-0000-4000-8000-000000000011',
  '23000000-0000-4000-8000-000000000012',
  '23000000-0000-4000-8000-000000000013',
  '23000000-0000-4000-8000-000000000021',
  '23000000-0000-4000-8000-000000000022',
  '23000000-0000-4000-8000-000000000023',
  '23000000-0000-4000-8000-000000000031'
);

select tests.authenticate_as('venue-activity-owner');
insert into public.venues (id, owner_id, name) values
  ((select venue_a_id from activity_state), auth.uid(), 'Family home'),
  ((select venue_b_id from activity_state), auth.uid(), 'Private studio');
insert into public.spaces (id, owner_id, venue_id, name) values
  ((select space_a_id from activity_state), auth.uid(), (select venue_a_id from activity_state), 'Living room'),
  ((select space_a_target_id from activity_state), auth.uid(), (select venue_a_id from activity_state), 'Garage'),
  ((select space_b_id from activity_state), auth.uid(), (select venue_b_id from activity_state), 'Private loft');
insert into public.boxes (id, owner_id, space_id, name, visibility) values
  ((select box_a_id from activity_state), auth.uid(), (select space_a_id from activity_state), 'Camping bin', 'private'),
  ((select box_a_target_id from activity_state), auth.uid(), (select space_a_target_id from activity_state), 'Outdoor bin', 'private'),
  ((select box_b_id from activity_state), auth.uid(), (select space_b_id from activity_state), 'Private archive', 'private');

select tests.clear_authentication();
set local role postgres;
insert into public.profiles (id, display_name) values
  ((select owner_id from activity_state), 'Owner Li'),
  ((select member_id from activity_state), 'Member Lin');
insert into public.venue_members (venue_id, user_id)
select venue_a_id, member_id from activity_state;

select has_type('public', 'venue_activity_event', 'venue activity enum exists');
select has_column('public', 'activity_logs', 'venue_id', 'activity logs retain venue identity');
select has_column('public', 'activity_logs', 'event_code', 'activity logs retain product event code');
select has_function('public', 'list_venue_activity', array['uuid', 'uuid', 'public.venue_activity_event', 'timestamp with time zone', 'uuid', 'integer'],
  'venue activity feed RPC exists');
select ok(not has_function_privilege('authenticated', 'private.write_venue_activity(uuid, uuid, public.venue_activity_event, public.audit_entity, uuid, jsonb)', 'execute'),
  'clients cannot execute the private venue activity writer');

select tests.authenticate_as('venue-activity-member');
insert into public.items (id, box_id, name, quantity)
select item_id, box_a_id, 'Camping lantern', 3 from activity_state;
select is((select count(*)::integer from public.activity_logs where entity_id = (select item_id from activity_state)
  and event_code = 'item_created'), 1, 'member item creation writes one product event');
select is((select actor_id from public.activity_logs where entity_id = (select item_id from activity_state)
  and event_code = 'item_created'), auth.uid(), 'item creation records the actual member actor');
select is((select snapshot->>'actor_display_name' from public.activity_logs where entity_id = (select item_id from activity_state)
  and event_code = 'item_created'), 'Member Lin', 'item creation snapshots the actor display name');
select is((select snapshot->>'entity_name' from public.activity_logs where entity_id = (select item_id from activity_state)
  and event_code = 'item_created'), 'Camping lantern', 'item creation snapshots the item name');

update public.items set description = 'ordinary field update' where id = (select item_id from activity_state);
select is((select count(*)::integer from public.activity_logs where entity_id = (select item_id from activity_state)
  and event_code is not null), 1, 'ordinary item updates do not enter the product feed');
update public.items set quantity = 6 where id = (select item_id from activity_state);
select is((select count(*)::integer from public.activity_logs where entity_id = (select item_id from activity_state)
  and event_code = 'item_quantity_changed'), 1, 'quantity changes write one product event');
select is((select snapshot->>'quantity_before' || ':' || snapshot->>'quantity_after' from public.activity_logs
  where entity_id = (select item_id from activity_state) and event_code = 'item_quantity_changed'), '3:6',
  'quantity event snapshots before and after values');

update public.items set box_id = (select box_a_target_id from activity_state), quantity = 8 where id = (select item_id from activity_state);
select is((select count(*)::integer from public.activity_logs where entity_id = (select item_id from activity_state)
  and venue_id = (select venue_a_id from activity_state) and event_code = 'item_moved'), 1,
  'within-venue move writes one product event when box and quantity change together');
select is((select count(*)::integer from public.activity_logs where entity_id = (select item_id from activity_state)
  and venue_id = (select venue_a_id from activity_state) and event_code = 'item_quantity_changed'), 2,
  'one update changing box and quantity writes both product event types');
select is((select snapshot #>> '{from,name}' || ':' || snapshot #>> '{to,name}' from public.activity_logs
  where entity_id = (select item_id from activity_state) and event_code = 'item_moved' order by created_at desc, id desc limit 1),
  'Camping bin:Outdoor bin', 'within-venue move snapshots both box names');
select is((select snapshot->>'quantity_before' || ':' || snapshot->>'quantity_after' from public.activity_logs
  where entity_id = (select item_id from activity_state) and event_code = 'item_quantity_changed' order by created_at desc, id desc limit 1), '6:8',
  'combined item update snapshots the quantity change');

update public.boxes set space_id = (select space_a_target_id from activity_state) where id = (select box_a_id from activity_state);
select is((select count(*)::integer from public.activity_logs where entity_id = (select box_a_id from activity_state)
  and event_code = 'box_moved'), 1, 'box space changes write one product event');
select is((select snapshot #>> '{from,name}' || ':' || snapshot #>> '{to,name}' from public.activity_logs
  where entity_id = (select box_a_id from activity_state) and event_code = 'box_moved'), 'Living room:Garage',
  'box move snapshots both space names');

select tests.authenticate_as('venue-activity-owner');
select public.move_item((select item_id from activity_state), (select box_b_id from activity_state), null);
select is((select count(*)::integer from public.activity_logs where entity_id = (select item_id from activity_state)
  and event_code = 'item_moved' and venue_id = (select venue_a_id from activity_state) and snapshot->>'direction' = 'out'), 1,
  'cross-venue item move writes one source event');
select is((select count(*)::integer from public.activity_logs where entity_id = (select item_id from activity_state)
  and event_code = 'item_moved' and venue_id = (select venue_b_id from activity_state)), 1,
  'cross-venue item move writes one destination event');
select is((select snapshot->>'direction' from public.activity_logs where entity_id = (select item_id from activity_state)
  and event_code = 'item_moved' and venue_id = (select venue_a_id from activity_state) and snapshot->>'direction' = 'out'), 'out', 'source move is marked out');
select is((select snapshot #>> '{to,name}' from public.activity_logs where entity_id = (select item_id from activity_state)
  and event_code = 'item_moved' and venue_id = (select venue_a_id from activity_state) and snapshot->>'direction' = 'out'), null::text,
  'source move does not disclose the private destination box name');
select is((select snapshot #>> '{from,name}' from public.activity_logs where entity_id = (select item_id from activity_state)
  and event_code = 'item_moved' and venue_id = (select venue_b_id from activity_state)), null::text,
  'destination move does not disclose the private source box name');

update public.boxes set space_id = (select space_b_id from activity_state) where id = (select box_a_id from activity_state);
select is((select count(*)::integer from public.activity_logs where entity_id = (select box_a_id from activity_state)
  and event_code = 'box_moved' and venue_id = (select venue_a_id from activity_state) and snapshot->>'direction' = 'out'), 1,
  'cross-venue box move writes one source event');
select is((select count(*)::integer from public.activity_logs where entity_id = (select box_a_id from activity_state)
  and event_code = 'box_moved' and venue_id = (select venue_b_id from activity_state) and snapshot->>'direction' = 'in'), 1,
  'cross-venue box move writes one destination event');
select is((select snapshot #>> '{to,name}' from public.activity_logs where entity_id = (select box_a_id from activity_state)
  and event_code = 'box_moved' and venue_id = (select venue_a_id from activity_state) and snapshot->>'direction' = 'out'), null::text,
  'source box move does not disclose the private destination space name');
select is((select snapshot #>> '{from,name}' from public.activity_logs where entity_id = (select box_a_id from activity_state)
  and event_code = 'box_moved' and venue_id = (select venue_b_id from activity_state) and snapshot->>'direction' = 'in'), null::text,
  'destination box move does not disclose the private source space name');

delete from public.items where id = (select item_id from activity_state);
select is((select snapshot->>'entity_name' from public.activity_logs where entity_id = (select item_id from activity_state)
  and event_code = 'item_deleted'), 'Camping lantern', 'deleted item remains readable from its whitelisted snapshot');

select tests.authenticate_as('venue-activity-member');
select ok(exists (select 1 from public.list_venue_activity((select venue_a_id from activity_state))),
  'current member can read venue activity');
select ok((select count(*)::integer > 0 from public.list_venue_activity((select venue_a_id from activity_state),
  (select member_id from activity_state))), 'activity feed filters by actor');
select ok((select count(*)::integer > 0 and bool_and(event_code = 'item_moved')
  from public.list_venue_activity((select venue_a_id from activity_state), null, 'item_moved')),
  'activity feed filters by event code');
select throws_ok($$select * from public.list_venue_activity((select venue_a_id from activity_state), null, null, null, null, 0)$$,
  '22023', 'invalid venue activity limit', 'activity feed rejects a zero limit');
select throws_ok($$select * from public.list_venue_activity((select venue_a_id from activity_state), null, null, null, null, 51)$$,
  '22023', 'invalid venue activity limit', 'activity feed rejects a limit above fifty');
create temporary table activity_first_page on commit drop as
select * from public.list_venue_activity((select venue_a_id from activity_state), null, null, null, null, 1);
select is((select count(*)::integer from activity_first_page), 1, 'activity feed honors a one-row page limit');
select ok(not exists (
  select 1 from public.list_venue_activity(
    (select venue_a_id from activity_state), null, null,
    (select created_at from activity_first_page), (select id from activity_first_page), 50
  ) where id = (select id from activity_first_page)
), 'tuple cursor excludes the preceding activity row');
select throws_ok($$select * from public.list_venue_activity((select venue_a_id from activity_state), null, null,
  (select created_at from activity_first_page), null, 50)$$,
  '22023', 'invalid venue activity cursor', 'activity feed rejects a half cursor');
select ok(not exists (
  select 1 from (
    select created_at, id, lag(created_at) over (order by created_at desc, id desc) as previous_created_at,
      lag(id) over (order by created_at desc, id desc) as previous_id
    from public.list_venue_activity((select venue_a_id from activity_state), null, null, null, null, 50)
  ) ordered where previous_created_at < created_at or (previous_created_at = created_at and previous_id < id)
), 'activity feed ordering is stable by created_at then id descending');

select tests.clear_authentication();
set local role postgres;
insert into public.packing_sessions (id, box_id, owner_id, current_revision)
select '23000000-0000-4000-8000-000000000041', box_a_target_id, owner_id, 1 from activity_state;
insert into public.packing_detected_items (
  id, session_id, box_id, analysis_revision, name, quantity_kind, quantity_value, visibility, model_id, prompt_version, published_at
)
select '23000000-0000-4000-8000-000000000042', '23000000-0000-4000-8000-000000000041', box_a_target_id, 1,
  'Promoted lantern', 'exact', 1, 'clear', 'test-model', 'test-prompt', pg_catalog.now()
from activity_state;
insert into public.packing_item_promotions (
  id, detected_item_id, session_id, owner_id, requested_by, target_item_id, target_object_key
)
select '23000000-0000-4000-8000-000000000043', '23000000-0000-4000-8000-000000000042',
  '23000000-0000-4000-8000-000000000041', owner_id, member_id,
  '23000000-0000-4000-8000-000000000044', 'users/activity-promotion.webp'
from activity_state;
select public.finalize_packing_item_promotion('23000000-0000-4000-8000-000000000043', 'image/webp', 128);
select is((select count(*)::integer from public.activity_logs where entity_id = '23000000-0000-4000-8000-000000000044'
  and event_code = 'item_created' and actor_id = (select member_id from activity_state)), 1,
  'service-role promotion writes item creation with requested_by actor');
delete from public.venue_members where venue_id = (select venue_a_id from activity_state)
  and user_id = (select member_id from activity_state);
select tests.authenticate_as('venue-activity-owner');
select is((select actor_is_current from public.list_venue_activity((select venue_a_id from activity_state),
  (select member_id from activity_state), null, null, null, 50) where actor_id = (select member_id from activity_state) limit 1), false,
  'former member activity identifies a no-longer-current actor');
select tests.authenticate_as('venue-activity-member');
select is((select count(*)::integer from public.activity_logs where venue_id = (select venue_a_id from activity_state)
  and event_code is not null), 0, 'revoked member cannot directly select product activity rows');
select throws_ok($$select * from public.list_venue_activity((select venue_a_id from activity_state))$$,
  '42501', 'venue_access_denied', 'former member cannot read activity after leaving');
select tests.authenticate_as('venue-activity-outsider');
select throws_ok($$select * from public.list_venue_activity((select venue_a_id from activity_state))$$,
  '42501', 'venue_access_denied', 'outsider cannot read venue activity');

select * from finish();
rollback;

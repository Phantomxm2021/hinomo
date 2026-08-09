begin;
select plan(56);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('family-owner');
select tests.create_supabase_user('family-member-a');
select tests.create_supabase_user('family-member-b');
select tests.create_supabase_user('family-member-c');
select tests.create_supabase_user('family-member-d');
select tests.create_supabase_user('family-member-e');
select tests.create_supabase_user('family-outsider');
create temporary table family_state (
  member_b_id uuid not null,
  member_c_id uuid not null
) on commit drop;
grant select on family_state to authenticated;
insert into family_state values (
  tests.get_supabase_uid('family-member-b'),
  tests.get_supabase_uid('family-member-c')
);

select tests.authenticate_as('family-owner');
insert into public.venues (id, owner_id, name, description)
values (
  '19000000-0000-4000-8000-000000000001',
  auth.uid(),
  'Family home',
  'The shared venue'
);
insert into public.spaces (id, owner_id, venue_id, name)
values (
  '19000000-0000-4000-8000-000000000002',
  auth.uid(),
  '19000000-0000-4000-8000-000000000001',
  'Living room'
);

select has_table('public', 'venue_members', 'venue members exist');
select has_table('public', 'venue_invites', 'venue invites exist');
select has_table('private', 'venue_membership_audit', 'membership audit exists');
select has_function('public', 'can_access_venue', array['uuid'], 'venue access helper exists');
select has_function('public', 'can_edit_venue_content', array['uuid'], 'venue edit helper exists');
select has_function('public', 'create_venue_invite', array['uuid'], 'owner can create invite');
select has_function('public', 'inspect_venue_invite', array['text'], 'invite inspection exists');
select has_function('public', 'accept_venue_invite', array['text'], 'authenticated user can accept invite');
select has_function('public', 'remove_venue_member', array['uuid', 'uuid'], 'owner can remove member');
select has_function('public', 'leave_venue', array['uuid'], 'member can leave venue');
select has_function('public', 'list_accessible_venues', array[]::text[], 'accessible venue list exists');
select has_function('public', 'list_venue_members', array['uuid'], 'venue member list exists');
select ok(not has_table_privilege('authenticated', 'public.venue_members', 'insert'),
  'clients cannot insert memberships directly');
select ok(not has_table_privilege('authenticated', 'public.venue_invites', 'select'),
  'clients cannot read invite hashes');
select ok(not has_table_privilege('service_role', 'private.venue_membership_audit', 'select'),
  'service role cannot read private membership audit');
select ok(not has_table_privilege('authenticated', 'private.venue_membership_audit', 'insert'),
  'authenticated cannot write private membership audit');
select ok((select can_manage_members and can_delete_venue and can_delete_space and can_delete_box and can_change_box_visibility and can_use_ai
  from public.get_venue_access_summary('19000000-0000-4000-8000-000000000001')),
  'owner capability summary retains every dangerous capability');

create temporary table invite_a on commit drop as
select * from public.create_venue_invite('19000000-0000-4000-8000-000000000001');

select is((select count(*)::integer from invite_a), 1, 'owner creates an invite');
select tests.clear_authentication();
set local role postgres;
select ok(not exists (
  select 1
  from public.venue_invites as invites
  join invite_a on invites.id = invite_a.invite_id
  where invites.token_hash = convert_to(invite_a.token, 'utf8')
), 'raw token is not stored');
select is((select octet_length(invites.token_hash) from public.venue_invites as invites join invite_a on invites.id = invite_a.invite_id),
  32, 'invite stores a 32-byte hash');
select ok((select expires_at > pg_catalog.now() + interval '23 hours 59 minutes' and expires_at <= pg_catalog.now() + interval '24 hours' from invite_a),
  'invite expires in 24 hours');

select tests.authenticate_as('family-member-a');
select is((select result from public.accept_venue_invite((select token from invite_a))), 'joined',
  'member accepts a valid invite');
select tests.clear_authentication();
set local role postgres;
select is((select count(*)::integer from public.venue_members where venue_id = '19000000-0000-4000-8000-000000000001'),
  1, 'acceptance creates one member');
select tests.authenticate_as('family-member-a');
select ok(public.can_access_venue('19000000-0000-4000-8000-000000000001'), 'joined member can access venue');
select is((select role from public.list_accessible_venues() where id = '19000000-0000-4000-8000-000000000001'),
  'member', 'accessible venue list marks a shared venue as member access');
select is((select count(*)::integer from public.list_venue_members('19000000-0000-4000-8000-000000000001')),
  2, 'member list includes the owner and the joined member');
select ok((select can_use_ai and not can_manage_members and not can_delete_venue and not can_delete_space and not can_delete_box and not can_change_box_visibility
  from public.get_venue_access_summary('19000000-0000-4000-8000-000000000001')),
  'member capability summary permits AI only');
select is((select result from public.accept_venue_invite((select token from invite_a))), 'already_member',
  'same account gets already_member when accepting again');

select tests.authenticate_as('family-member-b');
select throws_ok(
  $$select * from public.accept_venue_invite((select token from invite_a))$$,
  'P0001', 'venue_invite_used', 'another account cannot reuse an invite'
);

select tests.authenticate_as('family-owner');
create temporary table owner_invite on commit drop as
select * from public.create_venue_invite('19000000-0000-4000-8000-000000000001');
select throws_ok(
  $$select * from public.accept_venue_invite((select token from owner_invite))$$,
  'P0001', 'venue_owner_cannot_join', 'owner cannot join their own venue'
);
select lives_ok($$select public.revoke_venue_invite((select invite_id from owner_invite))$$,
  'owner revokes their own unused invite');

create temporary table revoked_invite on commit drop as
select * from public.create_venue_invite('19000000-0000-4000-8000-000000000001');
select lives_ok($$select public.revoke_venue_invite((select invite_id from revoked_invite))$$,
  'owner revokes a pending invite');

select tests.authenticate_as('family-member-b');
select throws_ok(
  $$select * from public.accept_venue_invite((select token from revoked_invite))$$,
  'P0001', 'venue_invite_revoked', 'revoked invite is rejected'
);

select tests.authenticate_as('family-owner');
create temporary table expired_invite on commit drop as
select * from public.create_venue_invite('19000000-0000-4000-8000-000000000001');
select tests.clear_authentication();
set local role postgres;
update public.venue_invites
set expires_at = pg_catalog.now() - interval '1 second'
where id = (select invite_id from expired_invite);

select tests.authenticate_as('family-member-b');
select throws_ok(
  $$select * from public.accept_venue_invite((select token from expired_invite))$$,
  'P0001', 'venue_invite_expired', 'expired invite is rejected'
);

select tests.authenticate_as('family-owner');
create temporary table invite_b on commit drop as
select * from public.create_venue_invite('19000000-0000-4000-8000-000000000001');
create temporary table invite_c on commit drop as
select * from public.create_venue_invite('19000000-0000-4000-8000-000000000001');
create temporary table invite_d on commit drop as
select * from public.create_venue_invite('19000000-0000-4000-8000-000000000001');

select tests.authenticate_as('family-member-b');
select is((select result from public.accept_venue_invite((select token from invite_b))), 'joined', 'second member joins');
select tests.authenticate_as('family-member-c');
select is((select result from public.accept_venue_invite((select token from invite_c))), 'joined', 'third member joins');
select tests.authenticate_as('family-member-d');
select is((select result from public.accept_venue_invite((select token from invite_d))), 'joined', 'fourth member joins');

select tests.authenticate_as('family-owner');
select is((select member_count from public.get_venue_access_summary('19000000-0000-4000-8000-000000000001')), 5,
  'member count includes the owner');
select is((select max_members from public.get_venue_access_summary('19000000-0000-4000-8000-000000000001')), 5,
  'member cap is five seats including owner');
select throws_ok(
  $$select * from public.create_venue_invite('19000000-0000-4000-8000-000000000001')$$,
  'P0001', 'venue_member_limit_reached', 'fifth additional member is rejected'
);

select throws_ok(
  $$select public.leave_venue('19000000-0000-4000-8000-000000000001')$$,
  'P0001', 'venue_owner_cannot_leave', 'owner cannot leave their own venue'
);

select tests.authenticate_as('family-outsider');
select throws_ok(
  $$select * from public.list_venue_members('19000000-0000-4000-8000-000000000001')$$,
  'P0001', 'venue_access_denied', 'outsider cannot list members'
);
select throws_ok(
  $$select public.revoke_venue_invite((select invite_id from invite_b))$$,
  'P0001', 'venue_access_denied', 'outsider cannot revoke an invite'
);
select throws_ok(
  $$select public.remove_venue_member('19000000-0000-4000-8000-000000000001', (select member_b_id from family_state))$$,
  'P0001', 'venue_access_denied', 'outsider cannot remove a member'
);

select tests.authenticate_as('family-member-b');
select lives_ok($$select public.leave_venue('19000000-0000-4000-8000-000000000001')$$,
  'member can leave venue');
select ok(not public.can_access_venue('19000000-0000-4000-8000-000000000001'),
  'departed member loses venue access');
select is((select count(*)::integer from public.spaces where id = '19000000-0000-4000-8000-000000000002'), 0,
  'a former member cannot see venue business data');

select tests.authenticate_as('family-owner');
select lives_ok(
  $$select public.remove_venue_member('19000000-0000-4000-8000-000000000001', (select member_c_id from family_state))$$,
  'owner can remove a member'
);

select tests.authenticate_as('family-member-c');
select ok(not public.can_access_venue('19000000-0000-4000-8000-000000000001'),
  'removed member loses venue access');

select tests.authenticate_as('family-owner');
select is((select count(*)::integer from public.spaces where id = '19000000-0000-4000-8000-000000000002'), 1,
  'membership changes do not delete business data');
select tests.clear_authentication();
set local role postgres;
select is((select count(*)::integer from private.venue_membership_audit
  where venue_id = '19000000-0000-4000-8000-000000000001'), 15,
  'audit records the exact number of membership events');
select is((select count(*)::integer from private.venue_membership_audit
  where venue_id = '19000000-0000-4000-8000-000000000001' and event_code = 'invite_created'), 7,
  'audit records every invite creation');
select is((select count(*)::integer from private.venue_membership_audit
  where venue_id = '19000000-0000-4000-8000-000000000001' and event_code = 'invite_revoked'), 2,
  'audit records every invite revocation');
select is((select count(*)::integer from private.venue_membership_audit
  where venue_id = '19000000-0000-4000-8000-000000000001' and event_code = 'member_joined'), 4,
  'audit records every member join');
select is((select count(*)::integer from private.venue_membership_audit
  where venue_id = '19000000-0000-4000-8000-000000000001' and event_code = 'member_left'), 1,
  'audit records the member leave');
select is((select count(*)::integer from private.venue_membership_audit
  where venue_id = '19000000-0000-4000-8000-000000000001' and event_code = 'member_removed'), 1,
  'audit records the member removal');

select * from finish();
rollback;

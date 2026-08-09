begin;
select plan(65);

select ok(has_table_privilege('authenticated', 'public.spaces', 'select'), 'authenticated can select spaces');
select ok(has_table_privilege('authenticated', 'public.spaces', 'insert'), 'authenticated can insert spaces');
select ok(has_table_privilege('authenticated', 'public.spaces', 'update'), 'authenticated can update spaces');
select ok(has_table_privilege('authenticated', 'public.spaces', 'delete'), 'authenticated can delete spaces');

select ok(has_table_privilege('authenticated', 'public.boxes', 'select'), 'authenticated can select boxes');
select ok(not has_table_privilege('authenticated', 'public.boxes', 'insert'), 'authenticated cannot insert boxes directly');
select ok(has_table_privilege('authenticated', 'public.boxes', 'delete'), 'authenticated can delete boxes');
select ok(has_table_privilege('authenticated', 'public.items', 'select'), 'authenticated can select items');
select ok(has_table_privilege('authenticated', 'public.items', 'delete'), 'authenticated can delete items');

select ok(has_table_privilege('anon', 'public.boxes', 'select'), 'anonymous users can select public boxes through RLS');
select ok(has_table_privilege('anon', 'public.items', 'select'), 'anonymous users can select public items through RLS');
select ok(has_table_privilege('authenticated', 'public.activity_logs', 'select'), 'authenticated can read authorized activity logs');
select ok(has_sequence_privilege('authenticated', 'public.box_code_seq', 'usage'), 'box inserts can allocate a generated box code');

select ok(not has_table_privilege('authenticated', 'public.account_entitlements', 'select'),
  'authenticated users cannot inspect the entitlement ledger directly');
select ok(not has_table_privilege('anon', 'public.account_entitlements', 'select'),
  'anonymous users cannot inspect the entitlement ledger directly');
select ok(has_table_privilege('service_role', 'public.account_entitlements', 'select'),
  'service role can check active entitlements before creating Checkout');
select ok(not has_table_privilege('service_role', 'public.account_entitlements', 'insert'),
  'service role cannot insert entitlements directly');
select ok(not has_table_privilege('service_role', 'public.account_entitlements', 'update'),
  'service role cannot update entitlements directly');
select ok(not has_table_privilege('service_role', 'public.account_entitlements', 'delete'),
  'service role cannot delete entitlements directly');
select ok(not has_table_privilege('authenticated', 'public.account_entitlement_revocations', 'select'),
  'authenticated users cannot inspect entitlement revocation tombstones');
select ok(not has_table_privilege('anon', 'public.account_entitlement_revocations', 'select'),
  'anonymous users cannot inspect entitlement revocation tombstones');
select ok(not has_table_privilege('service_role', 'public.account_entitlement_revocations', 'select'),
  'service role cannot inspect entitlement revocation tombstones directly');
select ok(not has_table_privilege('service_role', 'public.account_entitlement_revocations', 'insert'),
  'service role cannot insert entitlement revocation tombstones directly');
select ok(not has_table_privilege('service_role', 'public.account_entitlement_revocations', 'update'),
  'service role cannot update entitlement revocation tombstones directly');
select ok(not has_table_privilege('service_role', 'public.account_entitlement_revocations', 'delete'),
  'service role cannot delete entitlement revocation tombstones directly');

select function_privs_are('public', 'get_box_plan_summary', array[]::text[], 'authenticated', array['EXECUTE'],
  'authenticated users can read their box plan summary');
select function_privs_are('public', 'create_box', array['uuid', 'text', 'text', 'text', 'text', 'public.box_visibility'], 'authenticated', array['EXECUTE'],
  'authenticated users can create boxes through the atomic RPC');
select function_privs_are('public', 'grant_account_entitlement', array['uuid', 'text', 'text', 'text', 'timestamptz'], 'authenticated', array[]::text[],
  'authenticated users cannot grant entitlements');
select function_privs_are('public', 'grant_account_entitlement', array['uuid', 'text', 'text', 'text', 'timestamptz'], 'anon', array[]::text[],
  'anonymous users cannot grant entitlements');
select function_privs_are('public', 'grant_account_entitlement', array['uuid', 'text', 'text', 'text', 'timestamptz'], 'service_role', array['EXECUTE'],
  'service role can grant entitlements');
select function_privs_are('public', 'revoke_account_entitlement', array['text', 'text'], 'authenticated', array[]::text[],
  'authenticated users cannot revoke entitlements');
select function_privs_are('public', 'revoke_account_entitlement', array['text', 'text'], 'anon', array[]::text[],
  'anonymous users cannot revoke entitlements');
select function_privs_are('public', 'revoke_account_entitlement', array['text', 'text'], 'service_role', array['EXECUTE'],
  'service role can revoke entitlements');

select ok(not has_table_privilege('authenticated', 'public.venue_members', 'select'),
  'authenticated users cannot read memberships directly');
select ok(not has_table_privilege('authenticated', 'public.venue_members', 'insert, update, delete'),
  'authenticated users cannot write memberships directly');
select ok(not has_table_privilege('anon', 'public.venue_members', 'insert, update, delete'),
  'anonymous users cannot write memberships directly');
select ok(not has_table_privilege('service_role', 'public.venue_members', 'insert, update, delete'),
  'service role cannot write memberships directly');
select ok(not has_table_privilege('authenticated', 'public.venue_invites', 'select'),
  'authenticated users cannot read invite hashes directly');
select ok(not has_table_privilege('authenticated', 'public.venue_invites', 'insert, update, delete'),
  'authenticated users cannot write invites directly');
select ok(not has_table_privilege('anon', 'public.venue_invites', 'insert, update, delete'),
  'anonymous users cannot write invites directly');
select ok(not has_table_privilege('service_role', 'public.venue_invites', 'insert, update, delete'),
  'service role cannot write invites directly');
select ok(not has_table_privilege('authenticated', 'private.venue_membership_audit', 'select'),
  'authenticated users cannot read private membership audit');
select ok(not has_table_privilege('authenticated', 'private.venue_membership_audit', 'insert, update, delete'),
  'authenticated users cannot write private membership audit');
select ok(not has_table_privilege('service_role', 'private.venue_membership_audit', 'select'),
  'service role cannot read private membership audit');
select ok(not has_table_privilege('service_role', 'private.venue_membership_audit', 'insert, update, delete'),
  'service role cannot write private membership audit');

select function_privs_are('public', 'can_access_venue', array['uuid'], 'authenticated', array['EXECUTE'],
  'authenticated users can ask about venue access');
select function_privs_are('public', 'can_access_venue', array['uuid'], 'anon', array[]::text[],
  'anonymous users cannot ask about venue access');
select function_privs_are('public', 'create_venue_invite', array['uuid'], 'authenticated', array['EXECUTE'],
  'authenticated users can create venue invites through the RPC');
select function_privs_are('public', 'create_venue_invite', array['uuid'], 'anon', array[]::text[],
  'anonymous users cannot create venue invites');
select function_privs_are('public', 'accept_venue_invite', array['text'], 'authenticated', array['EXECUTE'],
  'authenticated users can accept venue invites');
select function_privs_are('public', 'accept_venue_invite', array['text'], 'anon', array[]::text[],
  'anonymous users cannot accept venue invites');
select function_privs_are('public', 'inspect_venue_invite', array['text'], 'anon', array['EXECUTE'],
  'anonymous users can inspect an invite without its token hash');
select function_privs_are('public', 'inspect_venue_invite', array['text'], 'authenticated', array['EXECUTE'],
  'authenticated users can inspect an invite without its token hash');
select function_privs_are('public', 'list_accessible_venues', array[]::text[], 'authenticated', array['EXECUTE'],
  'authenticated users can list accessible venues');
select function_privs_are('public', 'list_accessible_venues', array[]::text[], 'anon', array[]::text[],
  'anonymous users cannot list accessible venues');
select function_privs_are('public', 'list_venue_members', array['uuid'], 'authenticated', array['EXECUTE'],
  'authenticated users can list venue members through the RPC');
select function_privs_are('public', 'list_venue_members', array['uuid'], 'anon', array[]::text[],
  'anonymous users cannot list venue members');
select function_privs_are('public', 'list_venue_invites', array['uuid'], 'authenticated', array['EXECUTE'],
  'authenticated users can list venue invites through the RPC');
select function_privs_are('public', 'list_venue_invites', array['uuid'], 'anon', array[]::text[],
  'anonymous users cannot list venue invites');
select function_privs_are('public', 'remove_venue_member', array['uuid', 'uuid'], 'authenticated', array['EXECUTE'],
  'authenticated users can remove members through the RPC');
select function_privs_are('public', 'remove_venue_member', array['uuid', 'uuid'], 'anon', array[]::text[],
  'anonymous users cannot remove venue members');
select function_privs_are('public', 'leave_venue', array['uuid'], 'authenticated', array['EXECUTE'],
  'authenticated users can leave a venue through the RPC');
select function_privs_are('public', 'leave_venue', array['uuid'], 'anon', array[]::text[],
  'anonymous users cannot leave a venue');
select function_privs_are('public', 'revoke_venue_invite', array['uuid'], 'authenticated', array['EXECUTE'],
  'authenticated users can revoke invites through the RPC');
select function_privs_are('public', 'revoke_venue_invite', array['uuid'], 'anon', array[]::text[],
  'anonymous users cannot revoke venue invites');

select * from finish();
rollback;

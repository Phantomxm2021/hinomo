begin;
select plan(25);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select vault.create_secret('0123456789abcdef0123456789abcdef', 'r2_account_id', 'pgTAP R2 account');
select vault.create_secret('nomo-test-bucket', 'r2_bucket_name', 'pgTAP R2 bucket');
select vault.create_secret('R2TESTACCESSKEY', 'r2_access_key_id', 'pgTAP R2 access key');
select vault.create_secret('r2-test-secret-key', 'r2_secret_access_key', 'pgTAP R2 secret key');
select tests.create_supabase_user('shared-workflow-owner');
select tests.create_supabase_user('shared-workflow-member');
select tests.create_supabase_user('shared-workflow-outsider');

create temporary table workflow_state (
  owner_id uuid not null,
  member_id uuid not null,
  outsider_id uuid not null,
  shared_venue_id uuid not null,
  private_venue_id uuid not null,
  second_venue_id uuid not null,
  shared_space_id uuid not null,
  private_space_id uuid not null,
  second_space_id uuid not null,
  shared_box_id uuid not null,
  shared_target_box_id uuid not null,
  private_box_id uuid not null,
  second_box_id uuid not null,
  shared_item_id uuid not null,
  private_item_id uuid not null,
  cover_upload_id uuid,
  cover_object_key text,
  media_upload_id uuid,
  media_object_key text
) on commit drop;
grant select, update on workflow_state to authenticated;

insert into workflow_state values (
  tests.get_supabase_uid('shared-workflow-owner'),
  tests.get_supabase_uid('shared-workflow-member'),
  tests.get_supabase_uid('shared-workflow-outsider'),
  '21000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000002',
  '21000000-0000-4000-8000-000000000003',
  '21000000-0000-4000-8000-000000000011',
  '21000000-0000-4000-8000-000000000012',
  '21000000-0000-4000-8000-000000000013',
  '21000000-0000-4000-8000-000000000021',
  '21000000-0000-4000-8000-000000000022',
  '21000000-0000-4000-8000-000000000023',
  '21000000-0000-4000-8000-000000000024',
  '21000000-0000-4000-8000-000000000031',
  '21000000-0000-4000-8000-000000000032',
  null, null
);

select tests.authenticate_as('shared-workflow-owner');
insert into public.venues (id, owner_id, name) values
  ((select shared_venue_id from workflow_state), auth.uid(), 'Shared workflow venue'),
  ((select private_venue_id from workflow_state), auth.uid(), 'Private workflow venue'),
  ((select second_venue_id from workflow_state), auth.uid(), 'Second workflow venue');
insert into public.spaces (id, owner_id, venue_id, name) values
  ((select shared_space_id from workflow_state), auth.uid(), (select shared_venue_id from workflow_state), 'Shared workflow space'),
  ((select private_space_id from workflow_state), auth.uid(), (select private_venue_id from workflow_state), 'Private workflow space'),
  ((select second_space_id from workflow_state), auth.uid(), (select second_venue_id from workflow_state), 'Second workflow space');
insert into public.boxes (id, owner_id, space_id, name, visibility) values
  ((select shared_box_id from workflow_state), auth.uid(), (select shared_space_id from workflow_state), 'Shared workflow box', 'private'),
  ((select shared_target_box_id from workflow_state), auth.uid(), (select shared_space_id from workflow_state), 'Shared workflow target', 'private'),
  ((select private_box_id from workflow_state), auth.uid(), (select private_space_id from workflow_state), 'Private workflow box', 'private'),
  ((select second_box_id from workflow_state), auth.uid(), (select second_space_id from workflow_state), 'Second workflow box', 'private');
insert into public.items (id, box_id, name, quantity) values
  ((select shared_item_id from workflow_state), (select shared_box_id from workflow_state), 'Shared workflow lantern', 2),
  ((select private_item_id from workflow_state), (select private_box_id from workflow_state), 'Private workflow lantern', 1);

select tests.clear_authentication();
set local role postgres;
insert into public.venue_members (venue_id, user_id)
select shared_venue_id, member_id from workflow_state
union all
select second_venue_id, member_id from workflow_state;

select tests.authenticate_as('shared-workflow-member');
select is((select count(*)::integer from public.search_my_items('Shared workflow lantern')), 1,
  'member search_my_items finds a formal item in a shared private box');
select is((select count(*)::integer from public.search_my_inventory('Shared workflow lantern') where source = 'formal'), 1,
  'member search_my_inventory finds a formal item in a shared private box');
select is((select count(*)::integer from public.search_my_items('Private workflow lantern')), 0,
  'member search_my_items does not find a private venue item');
select is((select count(*)::integer from public.search_my_inventory('Private workflow lantern')), 0,
  'member search_my_inventory does not find a private venue item');
select is((select count(*)::integer from public.list_accessible_boxes((select shared_venue_id from workflow_state))), 2,
  'member can scan shared private boxes through the accessible-boxes RPC');

select is((select stored_quantity from public.take_out_item((select shared_item_id from workflow_state), 1, null, null)), 1,
  'member can take out a shared item');
select is((select stored_quantity from public.return_item((select shared_item_id from workflow_state), 1, null)), 2,
  'member can return a shared item');
select is((select box_id from public.move_item((select shared_item_id from workflow_state), (select shared_target_box_id from workflow_state), null)),
  (select shared_target_box_id from workflow_state), 'member can move a shared item within its venue');
select throws_ok(
  $$select public.move_item((select shared_item_id from workflow_state), (select second_box_id from workflow_state), null)$$,
  '42501', 'venue_access_denied', 'member cannot move an item across venues even when a member of both'
);
select is((select count(*)::integer from public.item_movements where item_id = (select shared_item_id from workflow_state)), 3,
  'member can read movement history for an accessible shared venue');

select tests.authenticate_as('shared-workflow-owner');
select is((select box_id from public.move_item((select shared_item_id from workflow_state), (select second_box_id from workflow_state), null)),
  (select second_box_id from workflow_state), 'owner retains cross-venue item moves');
select public.move_item((select shared_item_id from workflow_state), (select shared_box_id from workflow_state), null);

select tests.authenticate_as('shared-workflow-outsider');
select is((select count(*)::integer from public.item_movements where item_id = (select shared_item_id from workflow_state)), 0,
  'outsider cannot read movement history for an inaccessible venue');
select is((select count(*)::integer from public.list_accessible_boxes((select shared_venue_id from workflow_state))), 0,
  'outsider cannot scan shared private boxes through the accessible-boxes RPC');
select throws_ok(
  $$select * from public.create_media_upload((select shared_box_id from workflow_state), (select shared_item_id from workflow_state), 'item', 'image/jpeg', 8)$$,
  '42501', 'media target is not accessible', 'outsider cannot create an upload with a guessed shared box and item id'
);
select throws_ok(
  $$select * from public.create_media_download('users/00000000-0000-0000-0000-000000000000/boxes/21000000-0000-4000-8000-000000000021/items/21000000-0000-4000-8000-000000000031/fake.jpg')$$,
  '42501', 'media object is not accessible', 'outsider cannot download a guessed object key'
);

select tests.authenticate_as('shared-workflow-member');
with created as (
  select upload_id, object_key
  from workflow_state as state,
  lateral public.create_media_upload(state.shared_box_id, null, 'cover', 'image/png', 8)
)
update workflow_state as state
set cover_upload_id = created.upload_id, cover_object_key = created.object_key
from created;
select ok((select cover_object_key ~ ('^users/' || owner_id || '/boxes/' || shared_box_id || '/cover/[0-9a-f-]+\\.png$') from workflow_state),
  'member cover upload keys use the canonical venue owner prefix');
select lives_ok($$select public.confirm_media_upload((select cover_upload_id from workflow_state))$$,
  'member can confirm media for a shared private box');
select ok((select download_url like 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/nomo-test-bucket/%'
  from public.create_media_download((select cover_object_key from workflow_state))),
  'member can download confirmed media for a shared private box');
with created as (
  select upload_id, object_key
  from workflow_state as state,
  lateral public.create_media_upload(state.shared_box_id, state.shared_item_id, 'item', 'image/jpeg', 8)
)
update workflow_state as state
set media_upload_id = created.upload_id, media_object_key = created.object_key
from created;
select ok((select media_object_key ~ ('^users/' || owner_id || '/boxes/' || shared_box_id || '/items/' || shared_item_id || '/[0-9a-f-]+\\.jpg$') from workflow_state),
  'member upload keys use the canonical venue owner prefix');
select is((select owner_id from public.media_uploads where id = (select media_upload_id from workflow_state)),
  (select owner_id from workflow_state), 'member upload rows use the canonical venue owner');
select tests.authenticate_as('shared-workflow-outsider');
select throws_ok(
  $$select public.confirm_media_upload((select media_upload_id from workflow_state))$$,
  '42501', 'media upload is not accessible', 'outsider cannot confirm a guessed upload id'
);
select tests.authenticate_as('shared-workflow-member');
select lives_ok($$select public.confirm_media_upload((select media_upload_id from workflow_state))$$,
  'member can confirm media for a shared private item');
select ok((select download_url like 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/nomo-test-bucket/%'
  from public.create_media_download((select media_object_key from workflow_state))),
  'member can download confirmed media for a shared private item');

select tests.clear_authentication();
set local role postgres;
delete from public.venue_members
where venue_id = (select shared_venue_id from workflow_state)
  and user_id = (select member_id from workflow_state);
select tests.authenticate_as('shared-workflow-member');
select throws_ok(
  $$select * from public.create_media_download((select media_object_key from workflow_state))$$,
  '42501', 'media object is not accessible', 'removed member cannot receive a new media download URL'
);

select tests.clear_authentication();
select is((select count(*)::integer from public.boxes where id = (select shared_box_id from workflow_state)), 0,
  'anonymous reads remain unable to scan a shared private box');

select * from finish();
rollback;

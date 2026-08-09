begin;
select plan(26);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select vault.create_secret('0123456789abcdef0123456789abcdef', 'r2_account_id', 'shared packing R2 account');
select vault.create_secret('nomo-test-bucket', 'r2_bucket_name', 'shared packing R2 bucket');
select vault.create_secret('R2TESTACCESSKEY', 'r2_access_key_id', 'shared packing R2 access key');
select vault.create_secret('r2-test-secret-key', 'r2_secret_access_key', 'shared packing R2 secret key');
select tests.create_supabase_user('shared-packing-owner');
select tests.create_supabase_user('shared-packing-member');
select tests.create_supabase_user('shared-packing-other-member');
select tests.create_supabase_user('shared-packing-outsider');

create temporary table shared_packing_state (
  owner_id uuid not null,
  member_id uuid not null,
  other_member_id uuid not null,
  outsider_id uuid not null,
  venue_id uuid not null,
  space_id uuid not null,
  box_id uuid not null,
  private_box_id uuid not null,
  session_id uuid,
  photo_id uuid,
  atlas_id uuid,
  detected_id uuid,
  detected_merge_id uuid,
  promotion_id uuid,
  photo_key text
) on commit drop;
grant select, update on shared_packing_state to authenticated;

insert into shared_packing_state values (
  tests.get_supabase_uid('shared-packing-owner'),
  tests.get_supabase_uid('shared-packing-member'),
  tests.get_supabase_uid('shared-packing-other-member'),
  tests.get_supabase_uid('shared-packing-outsider'),
  '22000000-0000-4000-8000-000000000001',
  '22000000-0000-4000-8000-000000000011',
  '22000000-0000-4000-8000-000000000021',
  '22000000-0000-4000-8000-000000000022',
  null, null, null, null, null, null, null
);

select tests.authenticate_as('shared-packing-owner');
insert into public.venues (id, owner_id, name)
select venue_id, auth.uid(), 'Shared packing venue' from shared_packing_state;
insert into public.spaces (id, owner_id, venue_id, name)
select space_id, auth.uid(), venue_id, 'Shared packing space' from shared_packing_state;
insert into public.boxes (id, owner_id, space_id, name, visibility)
select box_id, auth.uid(), space_id, 'Shared packing box', 'private' from shared_packing_state
union all
select private_box_id, auth.uid(), space_id, 'Private packing box', 'private' from shared_packing_state;
select tests.clear_authentication();
set local role postgres;
insert into public.venue_members (venue_id, user_id)
select venue_id, member_id from shared_packing_state
union all
select venue_id, other_member_id from shared_packing_state;
insert into public.credit_grants (user_id, kind, original_credits, remaining_credits, effective_at, expires_at, source_reference)
select owner_id, 'promotional', 10, 10, pg_catalog.now() - interval '1 minute', pg_catalog.now() + interval '1 day', 'shared-packing-owner' from shared_packing_state
union all
select member_id, 'promotional', 10, 10, pg_catalog.now() - interval '1 minute', pg_catalog.now() + interval '1 day', 'shared-packing-member' from shared_packing_state
union all
select other_member_id, 'promotional', 10, 10, pg_catalog.now() - interval '1 minute', pg_catalog.now() + interval '1 day', 'shared-packing-other' from shared_packing_state;

select tests.authenticate_as('shared-packing-member');
update shared_packing_state set session_id = (public.create_packing_session(box_id)).id;
select is((select owner_id from public.packing_sessions where id = (select session_id from shared_packing_state)),
  (select owner_id from shared_packing_state), 'shared session uses the venue owner as canonical owner');
select is((select created_by from public.packing_sessions where id = (select session_id from shared_packing_state)),
  auth.uid(), 'shared session records the member actor');

with upload as (
  select * from public.create_packing_photo_upload((select session_id from shared_packing_state), 1, 'image/webp', 1024)
)
update shared_packing_state state set photo_id = upload.photo_id, photo_key = upload.object_key from upload;
select ok((select photo_key ~ ('^users/' || owner_id || '/boxes/' || box_id || '/packing/' || session_id || '/original/[0-9a-f-]+\\.webp$') from shared_packing_state),
  'member packing media uses the canonical venue owner prefix');
select is((select owner_id from public.packing_photos where id = (select photo_id from shared_packing_state)),
  (select owner_id from shared_packing_state), 'shared photo uses the venue owner as canonical owner');
select lives_ok($$select public.confirm_packing_photo_upload((select photo_id from shared_packing_state))$$,
  'member can confirm a shared packing photo');
with upload as (
  select * from public.create_packing_atlas_upload((select session_id from shared_packing_state), 1, 1, 1, 512, 552, 2048, repeat('a', 64))
)
update shared_packing_state state set atlas_id = upload.atlas_id from upload;
select lives_ok($$select public.confirm_packing_atlas_upload((select atlas_id from shared_packing_state))$$,
  'member can confirm a shared packing atlas');
select is((public.complete_packing_session((select session_id from shared_packing_state))).status::text, 'queued',
  'member can queue analysis for a shared session');
select is((select credits_available from public.get_credit_summary()), 9, 'completion reserves the member credit');
select is((select remaining_credits from public.credit_grants where user_id = (select owner_id from shared_packing_state)), 10,
  'completion does not charge the venue owner');
select is((select remaining_credits from public.credit_grants where user_id = (select other_member_id from shared_packing_state)), 10,
  'completion does not charge another member');

select tests.clear_authentication();
set local role postgres;
update public.packing_sessions set status = 'ready', current_revision = 1 where id = (select session_id from shared_packing_state);
insert into public.packing_sessions (id, box_id, owner_id, current_revision)
select '22000000-0000-4000-8000-000000000043', private_box_id, owner_id, 1 from shared_packing_state;
insert into public.packing_detected_items (id, session_id, box_id, analysis_revision, name, quantity_kind, quantity_value, visibility, review_status, crop_status, model_id, prompt_version, published_at)
select '22000000-0000-4000-8000-000000000041', session_id, box_id, 1, 'Shared packing lantern', 'exact', 1, 'clear', 'confirmed', 'ready', 'test-model', 'test-prompt', pg_catalog.now() from shared_packing_state
union all
select '22000000-0000-4000-8000-000000000042', session_id, box_id, 1, 'Shared packing lamp', 'exact', 1, 'clear', 'corrected', 'ready', 'test-model', 'test-prompt', pg_catalog.now() from shared_packing_state;
insert into public.packing_detected_items (id, session_id, box_id, analysis_revision, name, quantity_kind, quantity_value, visibility, review_status, crop_status, model_id, prompt_version, published_at)
select '22000000-0000-4000-8000-000000000044', '22000000-0000-4000-8000-000000000043', private_box_id, 1, 'Private packing lantern', 'exact', 1, 'clear', 'confirmed', 'ready', 'test-model', 'test-prompt', pg_catalog.now() from shared_packing_state;
update shared_packing_state set detected_id = '22000000-0000-4000-8000-000000000041', detected_merge_id = '22000000-0000-4000-8000-000000000042';
update public.packing_detected_items
set first_seen_photo_id = (select photo_id from shared_packing_state)
where id = '22000000-0000-4000-8000-000000000041';

select tests.authenticate_as('shared-packing-member');
select is((select count(*)::integer from public.packing_detected_items where session_id = (select session_id from shared_packing_state)), 2,
  'member can read published shared packing results');
select is((select count(*)::integer from public.search_my_inventory('Shared packing lantern') where source = 'ai'), 1,
  'member search finds published shared AI results');
select is((select count(*)::integer from public.search_my_inventory('Private packing lantern') where source = 'ai'), 0,
  'member search does not leak private venue AI results');
select lives_ok($$select public.update_packing_detected_item((select detected_id from shared_packing_state), 'Shared packing lantern', null, null, 'exact', 1, 'corrected')$$,
  'member can edit a shared detected item');
select lives_ok($$select public.merge_packing_detected_items((select detected_id from shared_packing_state), (select detected_merge_id from shared_packing_state))$$,
  'member can merge shared detected items');
update shared_packing_state set promotion_id = (public.request_packing_item_promotion(detected_id)).id;
select is((select owner_id from public.packing_item_promotions where id = (select promotion_id from shared_packing_state)),
  (select owner_id from shared_packing_state), 'promotion uses the venue owner as canonical owner');
select is((select requested_by from public.packing_item_promotions where id = (select promotion_id from shared_packing_state)), auth.uid(),
  'promotion records the member actor');
select ok((select target_object_key ~ ('^users/' || owner_id || '/boxes/' || box_id || '/item/[0-9a-f-]+\\.webp$') from public.packing_item_promotions join shared_packing_state on true where packing_item_promotions.id = shared_packing_state.promotion_id),
  'promotion service media uses the canonical venue owner prefix');
select is((public.request_packing_reanalysis((select session_id from shared_packing_state))).status::text, 'queued',
  'member can request reanalysis for a shared session');
select is((select credits_available from public.get_credit_summary()), 8, 'reanalysis reserves the member credit');
select is((select remaining_credits from public.credit_grants where user_id = (select owner_id from shared_packing_state)), 10,
  'reanalysis does not charge the venue owner');

select tests.authenticate_as('shared-packing-outsider');
select is((select count(*)::integer from public.packing_sessions where id = (select session_id from shared_packing_state)), 0,
  'outsider cannot read a shared packing session');
select throws_ok($$select public.create_packing_photo_upload((select session_id from shared_packing_state), 2, 'image/webp', 1024)$$,
  '42501', 'packing session is not accessible', 'outsider cannot create shared packing media');
select throws_ok($$select public.create_packing_media_download((select photo_key from shared_packing_state))$$,
  '42501', 'packing media is not accessible', 'outsider cannot download guessed shared packing media');

select tests.clear_authentication();
set local role postgres;
delete from public.venue_members where venue_id = (select venue_id from shared_packing_state) and user_id = (select member_id from shared_packing_state);
select tests.authenticate_as('shared-packing-member');
select is((select count(*)::integer from public.packing_sessions where id = (select session_id from shared_packing_state)), 0,
  'removed member can no longer read shared packing sessions');
select throws_ok($$select public.request_packing_reanalysis((select session_id from shared_packing_state))$$,
  '42501', 'packing session is not accessible', 'removed member cannot reanalyze a shared session');

select * from finish();
rollback;

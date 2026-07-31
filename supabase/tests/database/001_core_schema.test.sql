begin;
select plan(30);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('core-schema-owner');
select tests.authenticate_as('core-schema-owner');

insert into public.venues(id, owner_id, name)
values ('09000000-0000-0000-0000-000000000001', auth.uid(), 'Home venue');
insert into public.spaces(id, owner_id, venue_id, name)
values ('10000000-0000-0000-0000-000000000001', auth.uid(), '09000000-0000-0000-0000-000000000001', 'Home');

insert into public.boxes(id, public_id, box_code, owner_id, space_id, name)
values (
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'SUPPLIED-CODE',
  auth.uid(),
  '10000000-0000-0000-0000-000000000001',
  'First box'
);

insert into public.boxes(id, owner_id, space_id, name)
values (
  '20000000-0000-0000-0000-000000000002',
  auth.uid(),
  '10000000-0000-0000-0000-000000000001',
  'Second box'
);

insert into public.items(id, box_id, name)
values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'First item');

select has_table('public', 'spaces', 'spaces exists');
select has_table('public', 'boxes', 'boxes exists');
select has_table('public', 'items', 'items exists');
select has_table('public', 'activity_logs', 'activity_logs exists');
select has_table('public', 'media_uploads', 'media_uploads exists');
select has_table('public', 'media_cleanup_jobs', 'media_cleanup_jobs exists');
select col_is_unique('public', 'boxes', 'public_id', 'public_id is unique');
select col_is_unique('public', 'boxes', 'box_code', 'box_code is unique');
select throws_ok(
  $$insert into public.items(box_id, name, quantity) values (gen_random_uuid(), 'x', 0)$$,
  '23514', null, 'quantity must be positive'
);
select isnt(
  (select public_id from public.boxes where id = '20000000-0000-0000-0000-000000000001'),
  '30000000-0000-0000-0000-000000000001'::uuid,
  'supplied public_id is replaced'
);
select isnt(
  (select box_code from public.boxes where id = '20000000-0000-0000-0000-000000000001'),
  'SUPPLIED-CODE',
  'supplied box_code is replaced'
);
select matches(
  (select box_code from public.boxes where id = '20000000-0000-0000-0000-000000000001'),
  '^BX-[0-9]{5,}$', 'generated box_code has the required format'
);
select throws_ok(
  $$update public.boxes set public_id = gen_random_uuid() where id = '20000000-0000-0000-0000-000000000001'$$,
  '22023', 'boxes.public_id is immutable', 'public_id is immutable'
);
select throws_ok(
  $$update public.boxes set box_code = 'BX-99999' where id = '20000000-0000-0000-0000-000000000001'$$,
  '22023', 'boxes.box_code is immutable', 'box_code is immutable'
);
select throws_ok(
  $$insert into public.media_uploads(owner_id, box_id, item_id, media_kind, object_key, mime_type, size_bytes, expires_at)
    select auth.uid(), '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'item', 'media/cross-box', 'image/jpeg', 1, now()$$,
  '23503', null, 'media item must belong to its box'
);
select throws_ok(
  $$insert into public.boxes(owner_id, space_id, name, cover_object_key, cover_mime_type, cover_size_bytes)
    select auth.uid(), '10000000-0000-0000-0000-000000000001', 'Bad cover mime', 'covers/bad', 'image/gif', 1$$,
  '23514', null, 'box cover MIME type is limited'
);
select throws_ok(
  $$insert into public.items(box_id, name, image_object_key, image_mime_type, image_size_bytes)
    values ('20000000-0000-0000-0000-000000000001', 'Bad item mime', 'items/bad', 'image/gif', 1)$$,
  '23514', null, 'item image MIME type is limited'
);
select throws_ok(
  $$insert into public.boxes(owner_id, space_id, name, cover_object_key)
    select auth.uid(), '10000000-0000-0000-0000-000000000001', 'Partial cover metadata', 'covers/partial'$$,
  '23514', null, 'box cover metadata is all-or-nothing'
);
select throws_ok(
  $$insert into public.items(box_id, name, image_object_key)
    values ('20000000-0000-0000-0000-000000000001', 'Partial item metadata', 'items/partial')$$,
  '23514', null, 'item image metadata is all-or-nothing'
);
select throws_ok(
  $$insert into public.media_uploads(owner_id, box_id, media_kind, object_key, mime_type, size_bytes, expires_at)
    select auth.uid(), '20000000-0000-0000-0000-000000000001', 'item', 'media/no-item', 'image/jpeg', 1, now()$$,
  '23514', null, 'item media requires an item'
);
select throws_ok(
  $$insert into public.media_uploads(owner_id, box_id, media_kind, object_key, mime_type, size_bytes, expires_at)
    select auth.uid(), '20000000-0000-0000-0000-000000000001', 'cover', 'media/large', 'image/jpeg', 5242881, now()$$,
  '23514', null, 'media upload size is capped at 5 MiB'
);
select throws_ok(
  $$insert into public.media_uploads(owner_id, box_id, media_kind, object_key, mime_type, size_bytes, expires_at)
    select auth.uid(), '20000000-0000-0000-0000-000000000001', 'cover', 'media/bad-mime', 'image/gif', 1, now()$$,
  '23514', null, 'media upload MIME type is limited'
);
select throws_ok(
  $$insert into public.media_cleanup_jobs(object_key, attempts) values ('cleanup/negative', -1)$$,
  '23514', null, 'cleanup attempts cannot be negative'
);
select is(
  (select visibility::text from public.boxes where id = '20000000-0000-0000-0000-000000000001'),
  'private', 'box visibility defaults to private'
);
select col_type_is('public', 'boxes', 'visibility', 'box_visibility', 'box visibility uses its enum');
select has_index('public', 'boxes', 'boxes_owner_id_idx', 'boxes owner index exists');
select has_index('public', 'boxes', 'boxes_space_id_idx', 'boxes space index exists');
select has_index('public', 'items', 'items_box_id_idx', 'items box index exists');
select has_index('public', 'media_uploads', 'media_uploads_expiry_idx', 'media upload expiry index exists');
select has_index('public', 'media_cleanup_jobs', 'cleanup_jobs_due_idx', 'cleanup job due index exists');

select * from finish();
rollback;

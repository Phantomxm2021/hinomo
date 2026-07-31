begin;
select plan(31);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('media-cleanup-owner');
select tests.clear_authentication();
set local role postgres;

-- These fixtures run as the migration owner so RLS cannot hide cleanup side effects.
-- Every media metadata triple is complete to satisfy the core schema constraints.
create temporary table media_cleanup_state (
  owner_id uuid not null,
  space_id uuid not null,
  cover_box_id uuid not null,
  image_box_id uuid not null,
  delete_item_box_id uuid not null,
  delete_item_id uuid not null,
  delete_box_id uuid not null,
  delete_box_item_id uuid not null,
  upload_box_id uuid not null,
  expiry_box_id uuid not null
) on commit drop;

insert into media_cleanup_state values (
  tests.get_supabase_uid('media-cleanup-owner'),
  '81000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000002',
  '82000000-0000-0000-0000-000000000003',
  '83000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000004',
  '83000000-0000-0000-0000-000000000002',
  '82000000-0000-0000-0000-000000000005',
  '82000000-0000-0000-0000-000000000006'
);

insert into public.venues (id, owner_id, name)
select '80000000-0000-0000-0000-000000000001', owner_id, 'Media cleanup venue'
from media_cleanup_state;

insert into public.spaces (id, owner_id, venue_id, name)
select space_id, owner_id, '80000000-0000-0000-0000-000000000001', 'Media cleanup fixtures'
from media_cleanup_state;

insert into public.boxes (
  id, owner_id, space_id, name, cover_object_key, cover_mime_type, cover_size_bytes
)
select cover_box_id, owner_id, space_id, 'Cover replacement', 'cleanup/cover-old.webp', 'image/webp', 10 from media_cleanup_state
union all
select image_box_id, owner_id, space_id, 'Image replacement', null, null, null from media_cleanup_state
union all
select delete_item_box_id, owner_id, space_id, 'Item deletion', null, null, null from media_cleanup_state
union all
select delete_box_id, owner_id, space_id, 'Box deletion', 'cleanup/delete-box-cover.webp', 'image/webp', 10 from media_cleanup_state
union all
select upload_box_id, owner_id, space_id, 'Upload deletion', null, null, null from media_cleanup_state
union all
select expiry_box_id, owner_id, space_id, 'Upload expiry', null, null, null from media_cleanup_state;

insert into public.items (id, box_id, name, image_object_key, image_mime_type, image_size_bytes)
select image_box_id, image_box_id, 'Replacement image', 'cleanup/item-old.webp', 'image/webp', 10 from media_cleanup_state
union all
select delete_item_id, delete_item_box_id, 'Deleted item', 'cleanup/delete-item.webp', 'image/webp', 10 from media_cleanup_state
union all
select delete_box_item_id, delete_box_id, 'Cascaded item', 'cleanup/delete-box-item.webp', 'image/webp', 10 from media_cleanup_state;

select has_function('public', 'expire_media_uploads', array['timestamp with time zone'], 'expire function accepts its cutoff');
select has_function('public', 'process_media_cleanup_jobs', array['integer'], 'submit function accepts a batch size');
select has_function('public', 'collect_media_cleanup_results', array[]::text[], 'collect function has no arguments');
select is(
  (select count(*)::integer from cron.job where jobname in ('expire-media-uploads', 'submit-media-cleanup', 'collect-media-cleanup')),
  3,
  'all three named cleanup cron jobs are configured'
);
select is(
  (select array_agg(jobname order by jobname)::text from cron.job where jobname in ('expire-media-uploads', 'submit-media-cleanup', 'collect-media-cleanup')),
  '{collect-media-cleanup,expire-media-uploads,submit-media-cleanup}',
  'cleanup cron job names are exact'
);

update public.boxes
set cover_object_key = 'cleanup/cover-new.webp', cover_mime_type = 'image/webp', cover_size_bytes = 11
where id = (select cover_box_id from media_cleanup_state);
select is((select count(*)::integer from public.media_cleanup_jobs where object_key = 'cleanup/cover-old.webp'), 1, 'replacing a box cover queues the old key exactly once');

update public.items
set image_object_key = 'cleanup/item-new.webp', image_mime_type = 'image/webp', image_size_bytes = 11
where id = (select image_box_id from media_cleanup_state);
select is((select count(*)::integer from public.media_cleanup_jobs where object_key = 'cleanup/item-old.webp'), 1, 'replacing an item image queues the old key exactly once');

delete from public.items where id = (select delete_item_id from media_cleanup_state);
select is((select count(*)::integer from public.media_cleanup_jobs where object_key = 'cleanup/delete-item.webp'), 1, 'deleting an item queues its image key');

delete from public.boxes where id = (select delete_box_id from media_cleanup_state);
select is(
  (select array_agg(object_key order by object_key)::text from public.media_cleanup_jobs where object_key in ('cleanup/delete-box-cover.webp', 'cleanup/delete-box-item.webp')),
  '{cleanup/delete-box-cover.webp,cleanup/delete-box-item.webp}',
  'deleting a box queues its cover and cascaded item keys'
);

insert into public.media_uploads (owner_id, box_id, media_kind, object_key, mime_type, size_bytes, expires_at)
select owner_id, upload_box_id, 'cover', 'cleanup/pending-cascade.webp', 'image/webp', 10, now() + interval '1 hour'
from media_cleanup_state;
delete from public.boxes where id = (select upload_box_id from media_cleanup_state);
select is((select count(*)::integer from public.media_cleanup_jobs where object_key = 'cleanup/pending-cascade.webp'), 1, 'cascading a pending upload deletion queues its key');

insert into public.media_uploads (owner_id, box_id, media_kind, object_key, mime_type, size_bytes, status, confirmed_at, expires_at)
select owner_id, expiry_box_id, 'cover', 'cleanup/confirmed-delete.webp', 'image/webp', 10, 'confirmed', now(), now() + interval '1 hour'
from media_cleanup_state;
delete from public.media_uploads where object_key = 'cleanup/confirmed-delete.webp';
select is((select count(*)::integer from public.media_cleanup_jobs where object_key = 'cleanup/confirmed-delete.webp'), 0, 'deleting a confirmed upload does not queue its key');

insert into public.media_uploads (owner_id, box_id, media_kind, object_key, mime_type, size_bytes, status, expires_at)
select owner_id, expiry_box_id, 'cover', 'cleanup/expired-pending.webp', 'image/webp', 10, 'pending', now() - interval '1 minute' from media_cleanup_state
union all
select owner_id, expiry_box_id, 'cover', 'cleanup/future-pending.webp', 'image/webp', 10, 'pending', now() + interval '1 hour' from media_cleanup_state
union all
select owner_id, expiry_box_id, 'cover', 'cleanup/confirmed-future.webp', 'image/webp', 10, 'confirmed', now() - interval '1 minute' from media_cleanup_state;

select is(public.expire_media_uploads(now()), 1, 'expire processes only the due pending upload');
select is(
  (select string_agg(status::text, ',' order by object_key) from public.media_uploads where object_key in ('cleanup/confirmed-future.webp', 'cleanup/expired-pending.webp', 'cleanup/future-pending.webp')),
  'confirmed,expired,pending',
  'expire leaves future pending and confirmed uploads unchanged'
);
select is((select count(*)::integer from public.media_cleanup_jobs where object_key = 'cleanup/expired-pending.webp'), 1, 'expire queues the due upload key');
select is(public.expire_media_uploads(now()), 0, 'a second expire run is idempotent');
select is((select count(*)::integer from public.media_cleanup_jobs where object_key = 'cleanup/expired-pending.webp'), 1, 'idempotent expiry does not duplicate its cleanup job');

-- pg_net's response relation exposes these three fields; inserting only them avoids HTTP and
-- relies on extension defaults for the remaining response metadata.
select has_column('net', '_http_response', 'id', 'pg_net response relation has request ids');
select has_column('net', '_http_response', 'status_code', 'pg_net response relation has status codes');
select has_column('net', '_http_response', 'error_msg', 'pg_net response relation has error messages');

truncate public.media_cleanup_jobs;
insert into public.media_cleanup_jobs (id, object_key, status, request_id)
values
  ('84000000-0000-0000-0000-000000000001', 'cleanup/http-204.webp', 'processing', 9100001),
  ('84000000-0000-0000-0000-000000000002', 'cleanup/http-404.webp', 'processing', 9100002);
insert into net._http_response (id, status_code, error_msg)
values (9100001, 204, null), (9100002, 404, null);
select is(public.collect_media_cleanup_results(), 2, 'collect handles completed and missing-object responses');
select is(
  (select count(*)::integer from public.media_cleanup_jobs where object_key in ('cleanup/http-204.webp', 'cleanup/http-404.webp') and status = 'completed' and request_id is null),
  2,
  '2xx and 404 responses complete cleanup jobs'
);

insert into public.media_cleanup_jobs (id, object_key, status, request_id, attempts)
values ('84000000-0000-0000-0000-000000000003', 'cleanup/http-500.webp', 'processing', 9100003, 0);
insert into net._http_response (id, status_code, error_msg) values (9100003, 500, 'upstream unavailable');
select is(public.collect_media_cleanup_results(), 1, 'collect handles a 500 response');
select is((select attempts from public.media_cleanup_jobs where object_key = 'cleanup/http-500.webp'), 1, 'a 500 response increments attempts');
select ok((select status = 'pending' and request_id is null from public.media_cleanup_jobs where object_key = 'cleanup/http-500.webp'), 'a retryable response returns the job to pending without its request');
select ok((select next_attempt_at > now() from public.media_cleanup_jobs where object_key = 'cleanup/http-500.webp'), 'a retryable response uses a future backoff time');

insert into public.media_cleanup_jobs (id, object_key, status, request_id, attempts)
values ('84000000-0000-0000-0000-000000000004', 'cleanup/http-fifth.webp', 'processing', 9100004, 4);
insert into net._http_response (id, status_code, error_msg)
values (9100004, 500, 'https://secret.example/path' || E'\n' || repeat('x', 600));
select is(public.collect_media_cleanup_results(), 1, 'collect handles the fifth response failure');
select ok((select status = 'failed' and attempts = 5 and request_id is null from public.media_cleanup_jobs where object_key = 'cleanup/http-fifth.webp'), 'the fifth failure is terminal and clears its request');
select ok(
  (select char_length(last_error) <= 500 and last_error like '%[redacted-url]%' and last_error not like '%https://%' and position(E'\n' in last_error) = 0 from public.media_cleanup_jobs where object_key = 'cleanup/http-fifth.webp'),
  'response errors are bounded and sanitized'
);

insert into public.media_cleanup_jobs (id, object_key, status, request_id, updated_at)
values
  ('84000000-0000-0000-0000-000000000005', 'cleanup/stale-processing.webp', 'processing', 9100005, now() - interval '11 minutes'),
  ('84000000-0000-0000-0000-000000000006', 'cleanup/fresh-processing.webp', 'processing', 9100006, now());
select is(public.collect_media_cleanup_results(), 1, 'collect handles a stale processing job without a response');
select ok((select status = 'pending' and attempts = 1 and request_id is null from public.media_cleanup_jobs where object_key = 'cleanup/stale-processing.webp'), 'a stale no-response job is reset for retry');
select is((select status::text from public.media_cleanup_jobs where object_key = 'cleanup/fresh-processing.webp'), 'processing', 'a fresh no-response job remains processing');

select * from finish();
rollback;

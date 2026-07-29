begin;
select plan(9);

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

select * from finish();
rollback;

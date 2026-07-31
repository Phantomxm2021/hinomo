begin;
select plan(11);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('venue-owner');
select tests.create_supabase_user('venue-other');

select has_table('public', 'venues', 'venues table exists');
select col_is_not_null('public', 'spaces', 'venue_id', 'every space belongs to a venue');
select ok(has_table_privilege('authenticated', 'public.venues', 'select'), 'authenticated users may select venues');

select tests.authenticate_as('venue-owner');
insert into public.venues (id, owner_id, name)
values
  ('a1000000-0000-4000-8000-000000000001', auth.uid(), '家里'),
  ('a1000000-0000-4000-8000-000000000002', auth.uid(), '公司');
insert into public.spaces (id, owner_id, venue_id, name)
values ('a2000000-0000-4000-8000-000000000001', auth.uid(), 'a1000000-0000-4000-8000-000000000001', '卧室');

select throws_ok(
  $$insert into public.venues (owner_id, name) values (auth.uid(), ' 家里 ')$$,
  '23505', null, 'venue names are case-insensitively unique after trimming'
);

select tests.authenticate_as('venue-other');
insert into public.venues (id, owner_id, name)
values ('b1000000-0000-4000-8000-000000000001', auth.uid(), '其他场地');

select tests.authenticate_as('venue-owner');
select throws_ok(
  $$insert into public.spaces (owner_id, venue_id, name)
    values (auth.uid(), 'b1000000-0000-4000-8000-000000000001', '越权空间')$$,
  '42501', null, 'a space cannot use another owners venue'
);
select throws_ok(
  $$update public.spaces
    set venue_id = 'b1000000-0000-4000-8000-000000000001'
    where id = 'a2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'a space cannot move to another owners venue'
);
select throws_ok(
  $$delete from public.venues where id = 'a1000000-0000-4000-8000-000000000001'$$,
  '23503', null, 'a non-empty venue cannot be deleted'
);
select lives_ok(
  $$delete from public.venues where id = 'a1000000-0000-4000-8000-000000000002'$$,
  'an empty venue can be deleted'
);

select tests.authenticate_as('venue-other');
select is(
  (select count(*)::integer from public.venues where id = 'a1000000-0000-4000-8000-000000000001'),
  0,
  'another owner cannot read venues'
);
select is(
  (select count(*)::integer from public.spaces where id = 'a2000000-0000-4000-8000-000000000001'),
  0,
  'another owner cannot read spaces through venue relationships'
);
select is_empty(
  $$delete from public.venues where id = 'a1000000-0000-4000-8000-000000000001' returning id$$,
  'another owner cannot delete a venue'
);

select * from finish();
rollback;

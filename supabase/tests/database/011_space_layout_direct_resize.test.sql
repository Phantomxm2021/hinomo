begin;
select plan(3);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('layout-owner');
select tests.authenticate_as('layout-owner');

insert into public.venues (id, owner_id, name)
values ('c1000000-0000-4000-8000-000000000001', auth.uid(), '测试场地');

insert into public.spaces (id, owner_id, venue_id, name)
values ('c2000000-0000-4000-8000-000000000001', auth.uid(), 'c1000000-0000-4000-8000-000000000001', '贴边空间');

select lives_ok(
  $$insert into public.space_layouts (space_id, owner_id, x_percent, y_percent, width_percent, height_percent)
    values ('c2000000-0000-4000-8000-000000000001', auth.uid(), 92, 92, 8, 8)$$,
  'a card resized from its lower-right corner can reach every valid canvas edge'
);

select is(
  (select width_percent::integer from public.space_layouts where space_id = 'c2000000-0000-4000-8000-000000000001'),
  8,
  'the direct resize minimum width is persisted'
);

select is(
  (select height_percent::integer from public.space_layouts where space_id = 'c2000000-0000-4000-8000-000000000001'),
  8,
  'the direct resize minimum height is persisted'
);

select * from finish();
rollback;

begin;
select plan(4);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('availability-owner');
select tests.authenticate_as('availability-owner');

insert into public.venues (id, owner_id, name)
values ('f1000000-0000-4000-8000-000000000001', auth.uid(), '状态查询场地');
insert into public.spaces (id, owner_id, venue_id, name)
values ('f2000000-0000-4000-8000-000000000001', auth.uid(), 'f1000000-0000-4000-8000-000000000001', '状态查询空间');
insert into public.boxes (id, owner_id, space_id, name, visibility)
values ('f3000000-0000-4000-8000-000000000001', auth.uid(), 'f2000000-0000-4000-8000-000000000001', '状态查询箱子', 'public');
insert into public.items (id, box_id, name, quantity)
values ('f4000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000001', '状态查询露营灯', 3);

select public.take_out_item('f4000000-0000-4000-8000-000000000001', 1, '不应公开', '私密备注');

select is(
  (select stored_quantity from public.search_my_items('状态查询露营灯')),
  2,
  'owner search returns the current stored quantity'
);
select is(
  (select quantity from public.search_my_items('状态查询露营灯')),
  3,
  'owner search still returns the total quantity'
);

select tests.clear_authentication();
select is(
  (select (items -> 0 ->> 'stored_quantity')::integer
   from public.get_public_box((select public_id from public.boxes where id = 'f3000000-0000-4000-8000-000000000001'))),
  2,
  'the public box response includes availability without movement history'
);
select ok(
  (select not (items -> 0 ? 'handler_label') and not (items -> 0 ? 'note')
   from public.get_public_box((select public_id from public.boxes where id = 'f3000000-0000-4000-8000-000000000001'))),
  'the public box response does not expose handler labels or notes'
);

select * from finish();
rollback;

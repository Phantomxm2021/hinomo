begin;
select plan(35);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('movement-owner');
select tests.create_supabase_user('movement-other');

select has_column('public', 'items', 'stored_quantity', 'items track the quantity currently in their box');
select col_is_not_null('public', 'items', 'stored_quantity', 'stored quantity is always known');
select has_table('public', 'item_movements', 'item movement history exists');
select has_function('public', 'take_out_item', array['uuid', 'integer', 'text', 'text'], 'take out RPC exists');
select has_function('public', 'return_item', array['uuid', 'integer', 'text'], 'return RPC exists');
select has_function('public', 'move_item', array['uuid', 'uuid', 'text'], 'move RPC exists');
select function_privs_are('public', 'take_out_item', array['uuid', 'integer', 'text', 'text'], 'authenticated', array['EXECUTE'], 'authenticated users may take out items');
select function_privs_are('public', 'return_item', array['uuid', 'integer', 'text'], 'authenticated', array['EXECUTE'], 'authenticated users may return items');
select function_privs_are('public', 'move_item', array['uuid', 'uuid', 'text'], 'anon', array[]::text[], 'anonymous users cannot move items');
select ok(has_table_privilege('authenticated', 'public.item_movements', 'select'), 'authenticated users may read their movement history');
select ok(not has_table_privilege('authenticated', 'public.item_movements', 'insert'), 'authenticated users cannot forge movement history');

select tests.authenticate_as('movement-owner');

insert into public.venues (id, owner_id, name)
values ('d1000000-0000-4000-8000-000000000001', auth.uid(), '流转测试场地');

insert into public.spaces (id, owner_id, venue_id, name)
values ('d2000000-0000-4000-8000-000000000001', auth.uid(), 'd1000000-0000-4000-8000-000000000001', '储物间');

insert into public.boxes (id, owner_id, space_id, name)
values
  ('d3000000-0000-4000-8000-000000000001', auth.uid(), 'd2000000-0000-4000-8000-000000000001', '原箱子'),
  ('d3000000-0000-4000-8000-000000000002', auth.uid(), 'd2000000-0000-4000-8000-000000000001', '目标箱子');

insert into public.items (id, box_id, name, quantity)
values ('d4000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', '露营灯', 4);

select is(
  (select stored_quantity from public.items where id = 'd4000000-0000-4000-8000-000000000001'),
  4,
  'new items begin fully stored'
);

select is(
  (select stored_quantity from public.take_out_item('d4000000-0000-4000-8000-000000000001', 1, '小林', '周末露营')),
  3,
  'taking out an item returns its new stored quantity'
);
select is(
  (select stored_quantity from public.items where id = 'd4000000-0000-4000-8000-000000000001'),
  3,
  'taking out decrements the stored quantity'
);
select is(
  (select action::text from public.item_movements where item_id = 'd4000000-0000-4000-8000-000000000001' order by created_at desc limit 1),
  'take_out',
  'taking out appends a movement event'
);
select is(
  (select handler_label from public.item_movements where item_id = 'd4000000-0000-4000-8000-000000000001' order by created_at desc limit 1),
  '小林',
  'a take out event keeps the optional handler label'
);
select is(
  (select quantity from public.item_movements where item_id = 'd4000000-0000-4000-8000-000000000001' order by created_at desc limit 1),
  1,
  'a take out event records the moved quantity'
);
select throws_ok(
  $$select * from public.take_out_item('d4000000-0000-4000-8000-000000000001', 4, null, null)$$,
  '22023', 'take out quantity exceeds stored quantity', 'taking out more than is stored is rejected'
);

select is(
  (select stored_quantity from public.return_item('d4000000-0000-4000-8000-000000000001', 1, '已归还')),
  4,
  'returning an item restores its stored quantity'
);
select is(
  (select count(*)::integer from public.item_movements where item_id = 'd4000000-0000-4000-8000-000000000001' and action = 'return'),
  1,
  'returning appends a movement event'
);
select throws_ok(
  $$select * from public.return_item('d4000000-0000-4000-8000-000000000001', 1, null)$$,
  '22023', 'return quantity exceeds taken out quantity', 'returning more than is out is rejected'
);

select is(
  (select stored_quantity from public.take_out_item('d4000000-0000-4000-8000-000000000001', 2, null, null)),
  2,
  'a partial take out is supported'
);
update public.items
set quantity = 5
where id = 'd4000000-0000-4000-8000-000000000001';
select is(
  (select stored_quantity from public.items where id = 'd4000000-0000-4000-8000-000000000001'),
  3,
  'editing total quantity preserves the quantity currently out'
);
select throws_ok(
  $$update public.items set quantity = 1 where id = 'd4000000-0000-4000-8000-000000000001'$$,
  '22023', 'item quantity cannot be lower than the quantity currently taken out', 'total quantity cannot drop below the quantity currently out'
);
select throws_ok(
  $$select * from public.move_item('d4000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000002', null)$$,
  '22023', 'all item units must be returned before moving', 'partially taken out items cannot move boxes'
);

select public.return_item('d4000000-0000-4000-8000-000000000001', 2, null);
select is(
  (select box_id from public.move_item('d4000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000002', '重新整理')),
  'd3000000-0000-4000-8000-000000000002'::uuid,
  'a fully returned item can move to another owned box'
);
select ok(
  (select from_box_id = 'd3000000-0000-4000-8000-000000000001'::uuid
    and to_box_id = 'd3000000-0000-4000-8000-000000000002'::uuid
   from public.item_movements
   where item_id = 'd4000000-0000-4000-8000-000000000001'
     and action = 'move'),
  'a move event records both source and destination boxes'
);
select throws_ok(
  $$select * from public.move_item('d4000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000002', null)$$,
  '22023', 'item is already in the target box', 'moving to the current box is rejected'
);

select throws_ok(
  $$update public.items set stored_quantity = 0 where id = 'd4000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'clients cannot edit stored quantity directly'
);
select throws_ok(
  $$update public.items set box_id = 'd3000000-0000-4000-8000-000000000001' where id = 'd4000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'clients cannot move items without the movement RPC'
);
select throws_ok(
  $$insert into public.item_movements (item_id, actor_id, action, quantity, from_box_id)
    values ('d4000000-0000-4000-8000-000000000001', auth.uid(), 'take_out', 1, 'd3000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'clients cannot insert movement events directly'
);

select tests.authenticate_as('movement-other');
insert into public.venues (id, owner_id, name)
values ('e1000000-0000-4000-8000-000000000001', auth.uid(), '其他流转场地');
insert into public.spaces (id, owner_id, venue_id, name)
values ('e2000000-0000-4000-8000-000000000001', auth.uid(), 'e1000000-0000-4000-8000-000000000001', '其他储物间');
insert into public.boxes (id, owner_id, space_id, name)
values ('e3000000-0000-4000-8000-000000000001', auth.uid(), 'e2000000-0000-4000-8000-000000000001', '其他箱子');

select is(
  (select count(*)::integer from public.item_movements where item_id = 'd4000000-0000-4000-8000-000000000001'),
  0,
  'another owner cannot read movement history'
);
select throws_ok(
  $$select * from public.take_out_item('d4000000-0000-4000-8000-000000000001', 1, null, null)$$,
  '42501', 'item is not accessible', 'another owner cannot take out the item'
);

select tests.authenticate_as('movement-owner');
select throws_ok(
  $$select * from public.move_item('d4000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001', null)$$,
  '42501', 'target box is not accessible', 'an item cannot move into another owners box'
);

select tests.clear_authentication();
select throws_ok(
  $$select * from public.take_out_item('d4000000-0000-4000-8000-000000000001', 1, null, null)$$,
  '42501', null, 'anonymous users cannot execute item movement RPCs'
);

select * from finish();
rollback;

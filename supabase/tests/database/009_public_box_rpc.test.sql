begin;
select plan(8);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('public-rpc-owner');
select tests.authenticate_as('public-rpc-owner');

insert into public.venues (id, owner_id, name)
values ('90000000-0000-4000-8000-000000000001', auth.uid(), 'Public RPC venue');
insert into public.spaces (id, owner_id, venue_id, name)
values ('91000000-0000-4000-8000-000000000001', auth.uid(), '90000000-0000-4000-8000-000000000001', 'Public RPC space');

insert into public.boxes (id, owner_id, space_id, name, visibility)
values
  ('92000000-0000-4000-8000-000000000001', auth.uid(), '91000000-0000-4000-8000-000000000001', 'Public RPC box', 'public'),
  ('92000000-0000-4000-8000-000000000002', auth.uid(), '91000000-0000-4000-8000-000000000001', 'Private RPC box', 'private');

insert into public.items (id, box_id, name, quantity)
values ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'Public RPC item', 2);

select has_function('public', 'get_public_box', array['uuid'], 'public box RPC exists');
select function_returns('public', 'get_public_box', array['uuid'], 'setof record', 'public box RPC returns rows');
select function_privs_are('public', 'get_public_box', array['uuid'], 'anon', array['EXECUTE'], 'anonymous may execute public box RPC');
select function_privs_are('public', 'get_public_box', array['uuid'], 'authenticated', array['EXECUTE'], 'authenticated users may execute public box RPC');

select tests.clear_authentication();

select is(
  (select count(*)::integer from public.get_public_box((select public_id from public.boxes where id = '92000000-0000-4000-8000-000000000001'))),
  1,
  'anonymous visitors can read a public box'
);
select is(
  (select items -> 0 ->> 'name' from public.get_public_box((select public_id from public.boxes where id = '92000000-0000-4000-8000-000000000001'))),
  'Public RPC item',
  'the public response includes box items'
);
select is(
  (select count(*)::integer from public.get_public_box((select public_id from public.boxes where id = '92000000-0000-4000-8000-000000000002'))),
  0,
  'private boxes remain hidden'
);
select is(
  (select count(*)::integer from public.get_public_box('99000000-0000-4000-8000-000000000099')),
  0,
  'missing boxes remain indistinguishable from private boxes'
);

select * from finish();
rollback;

begin;
select plan(9);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('search-owner');
select tests.create_supabase_user('search-other');

select tests.authenticate_as('search-owner');

insert into public.spaces (id, owner_id, name)
values ('13000000-0000-0000-0000-000000000001', auth.uid(), 'Owner search space');

insert into public.boxes (id, public_id, box_code, owner_id, space_id, name, location, visibility)
values ('23000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', 'SUPPLIED-SEARCH-OWNER', auth.uid(), '13000000-0000-0000-0000-000000000001', 'Owner search box', 'Studio shelf', 'public');

insert into public.items (id, box_id, name, category, description, quantity, updated_at)
values
  ('43000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', 'Needle Newest', 'Tools', 'Matching search term', 7, '2026-07-30 10:00:00+00'),
  ('43000000-0000-0000-0000-000000000002', '23000000-0000-0000-0000-000000000001', 'Needle Alpha', 'Tools', null, 2, '2026-07-30 09:00:00+00'),
  ('43000000-0000-0000-0000-000000000003', '23000000-0000-0000-0000-000000000001', 'Needle Bravo', 'Tools', null, 3, '2026-07-30 09:00:00+00'),
  ('43000000-0000-0000-0000-000000000004', '23000000-0000-0000-0000-000000000001', 'Needle Older', 'Tools', null, 1, '2026-07-30 08:00:00+00');

select tests.authenticate_as('search-other');

insert into public.spaces (id, owner_id, name)
values ('14000000-0000-0000-0000-000000000001', auth.uid(), 'Other search space');

insert into public.boxes (id, public_id, box_code, owner_id, space_id, name, location, visibility)
values ('24000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000001', 'SUPPLIED-SEARCH-OTHER', auth.uid(), '14000000-0000-0000-0000-000000000001', 'Other search box', 'Garage shelf', 'public');

insert into public.items (id, box_id, name, category, quantity, updated_at)
values ('44000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000001', 'Needle Other', 'Tools', 5, '2026-07-30 11:00:00+00');

select tests.authenticate_as('search-owner');

select has_function('public', 'search_my_items', array['text'], 'search_my_items accepts text');
select is(
  (select row(item_id, item_name, quantity, box_id, box_public_id, box_name, space_name, location)::text
   from public.search_my_items('needle')
   where item_id = '43000000-0000-0000-0000-000000000001'),
  (select row(
    '43000000-0000-0000-0000-000000000001'::uuid,
    'Needle Newest'::text,
    7,
    '23000000-0000-0000-0000-000000000001'::uuid,
    public_id,
    'Owner search box'::text,
    'Owner search space'::text,
    'Studio shelf'::text
  )::text
   from public.boxes
   where id = '23000000-0000-0000-0000-000000000001'),
  'owner search returns all item, box, space, location, and quantity fields'
);
select ok(
  not exists (
    select 1
    from public.search_my_items('needle')
    where item_id = '44000000-0000-0000-0000-000000000001'
  ),
  'owner search excludes another owner public matching item'
);
select is((select count(*)::integer from public.search_my_items('')), 0, 'blank search returns no items');
select is((select count(*)::integer from public.search_my_items('   ')), 0, 'whitespace search returns no items');
select is((select count(*)::integer from public.search_my_items('no-match')), 0, 'nonmatching search returns no items');
select is(
  (select array_agg(item_name) from public.search_my_items('needle')),
  array['Needle Newest', 'Needle Alpha', 'Needle Bravo', 'Needle Older']::text[],
  'search orders by newest update then item name'
);

select tests.authenticate_as('search-other');
select is((select count(*)::integer from public.search_my_items('needle')), 1, 'search isolation switches to the other owner');
select is(
  (select item_id from public.search_my_items('needle')),
  '44000000-0000-0000-0000-000000000001'::uuid,
  'the other owner receives only their matching item'
);

select * from finish();
rollback;

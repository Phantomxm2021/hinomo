begin;
select plan(16);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('rls-owner');
select tests.create_supabase_user('rls-other');

select tests.authenticate_as('rls-owner');

insert into public.spaces (id, owner_id, name)
values ('11000000-0000-0000-0000-000000000001', auth.uid(), 'Owner space');

insert into public.boxes (id, public_id, box_code, owner_id, space_id, name, location, visibility)
values
  ('21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'SUPPLIED-PUBLIC', auth.uid(), '11000000-0000-0000-0000-000000000001', 'Owner public box', 'Living room', 'public'),
  ('21000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', 'SUPPLIED-PRIVATE', auth.uid(), '11000000-0000-0000-0000-000000000001', 'Owner private box', 'Closet', 'private');

insert into public.items (id, box_id, name)
values
  ('41000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'Owner public item'),
  ('41000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'Owner private item');

select tests.authenticate_as('rls-other');

insert into public.spaces (id, owner_id, name)
values ('12000000-0000-0000-0000-000000000001', auth.uid(), 'Other space');

insert into public.boxes (id, public_id, box_code, owner_id, space_id, name, visibility)
values ('22000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'SUPPLIED-OTHER', auth.uid(), '12000000-0000-0000-0000-000000000001', 'Other box', 'private');

select tests.clear_authentication();

select is(
  (select count(*)::integer from public.boxes),
  1,
  'anonymous users see only the public box'
);
select is(
  (select count(*)::integer from public.items),
  1,
  'anonymous users see only the item in the public box'
);

select tests.authenticate_as('rls-other');
select is_empty(
  $$update public.boxes
    set name = 'Other attempted update'
    where id = '21000000-0000-0000-0000-000000000001'
    returning id$$,
  'another authenticated user cannot update the owner public box'
);

select tests.authenticate_as('rls-other');
select is(
  (select count(*)::integer from public.boxes where id = '21000000-0000-0000-0000-000000000002'),
  0,
  'another authenticated user cannot read the owner private box'
);

select tests.authenticate_as('rls-owner');
select is(
  (select count(*)::integer from public.boxes where id in ('21000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000002')),
  2,
  'the owner sees public and private boxes'
);
select lives_ok(
  $$insert into public.boxes (id, owner_id, space_id, name, visibility)
    values ('21000000-0000-0000-0000-000000000003', auth.uid(), '11000000-0000-0000-0000-000000000001', 'Owner inserted box', 'private')$$,
  'the owner can insert a box in their space'
);
select lives_ok(
  $$update public.boxes set name = 'Owner updated box' where id = '21000000-0000-0000-0000-000000000003'$$,
  'the owner can update their own box'
);
select throws_ok(
  $$insert into public.boxes (id, owner_id, space_id, name)
    values ('21000000-0000-0000-0000-000000000004', auth.uid(), '12000000-0000-0000-0000-000000000001', 'Cross-space box')$$,
  '42501', null, 'inserting a box into another user space is rejected'
);
select throws_ok(
  $$update public.boxes set space_id = '12000000-0000-0000-0000-000000000001' where id = '21000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'moving a box into another user space is rejected'
);
select throws_ok(
  $$insert into public.items (id, box_id, name)
    values ('41000000-0000-0000-0000-000000000003', '22000000-0000-0000-0000-000000000001', 'Cross-owner item')$$,
  '42501', null, 'inserting an item into another user box is rejected'
);
select throws_ok(
  $$update public.items set box_id = '22000000-0000-0000-0000-000000000001' where id = '41000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'moving an item into another user box is rejected'
);
select throws_ok(
  $$insert into public.activity_logs (actor_id, action, entity_type, entity_id)
    values (auth.uid(), 'create', 'space', '11000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'ordinary clients cannot insert activity logs'
);
select throws_ok(
  $$insert into public.media_uploads (owner_id, box_id, media_kind, object_key, mime_type, size_bytes, expires_at)
    values (auth.uid(), '21000000-0000-0000-0000-000000000001', 'cover', 'rls/direct-media', 'image/jpeg', 1, now())$$,
  '42501', null, 'ordinary clients cannot insert media uploads'
);
select throws_ok(
  $$insert into public.media_cleanup_jobs (object_key)
    values ('rls/direct-cleanup')$$,
  '42501', null, 'ordinary clients cannot insert media cleanup jobs'
);
select is(
  (select count(*)::integer from public.activity_logs where actor_id = auth.uid()),
  7,
  'the owner can read activity logs created by their actions'
);

select tests.authenticate_as('rls-other');
select is(
  (select count(*)::integer from public.activity_logs where actor_id = tests.get_supabase_uid('rls-owner')),
  0,
  'another user cannot read the owner activity logs'
);

select * from finish();
rollback;

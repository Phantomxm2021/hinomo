begin;
select plan(6);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('space-audit-owner');
select tests.authenticate_as('space-audit-owner');

select lives_ok(
  $$insert into public.spaces (id, owner_id, name)
    values ('15000000-0000-0000-0000-000000000001', auth.uid(), 'Audited space')$$,
  'creating a space does not access a nonexistent box_id field'
);
select is(
  (select box_id
   from public.activity_logs
   where action = 'create'
     and entity_type = 'space'
     and entity_id = '15000000-0000-0000-0000-000000000001'),
  null::uuid,
  'a space create activity has no box reference'
);

select lives_ok(
  $$update public.spaces
    set description = 'Updated audited space'
    where id = '15000000-0000-0000-0000-000000000001'$$,
  'updating a space does not access a nonexistent box_id field'
);
select is(
  (select action::text
   from public.activity_logs
   where action = 'update'
     and entity_type = 'space'
     and entity_id = '15000000-0000-0000-0000-000000000001'),
  'update',
  'a space update activity is recorded'
);

select lives_ok(
  $$delete from public.spaces
    where id = '15000000-0000-0000-0000-000000000001'$$,
  'deleting a space does not access a nonexistent box_id field'
);
select is(
  (select box_id
   from public.activity_logs
   where action = 'delete'
     and entity_type = 'space'
     and entity_id = '15000000-0000-0000-0000-000000000001'),
  null::uuid,
  'a space delete activity has no box reference'
);

select * from finish();
rollback;

begin;
select plan(12);

select ok(has_table_privilege('authenticated', 'public.spaces', 'select'), 'authenticated can select spaces');
select ok(has_table_privilege('authenticated', 'public.spaces', 'insert'), 'authenticated can insert spaces');
select ok(has_table_privilege('authenticated', 'public.spaces', 'update'), 'authenticated can update spaces');
select ok(has_table_privilege('authenticated', 'public.spaces', 'delete'), 'authenticated can delete spaces');

select ok(has_table_privilege('authenticated', 'public.boxes', 'select'), 'authenticated can select boxes');
select ok(has_table_privilege('authenticated', 'public.boxes', 'delete'), 'authenticated can delete boxes');
select ok(has_table_privilege('authenticated', 'public.items', 'select'), 'authenticated can select items');
select ok(has_table_privilege('authenticated', 'public.items', 'delete'), 'authenticated can delete items');

select ok(has_table_privilege('anon', 'public.boxes', 'select'), 'anonymous users can select public boxes through RLS');
select ok(has_table_privilege('anon', 'public.items', 'select'), 'anonymous users can select public items through RLS');
select ok(has_table_privilege('authenticated', 'public.activity_logs', 'select'), 'authenticated can read authorized activity logs');
select ok(has_sequence_privilege('authenticated', 'public.box_code_seq', 'usage'), 'box inserts can allocate a generated box code');

select * from finish();
rollback;

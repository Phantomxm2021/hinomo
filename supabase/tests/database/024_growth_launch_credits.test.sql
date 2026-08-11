begin;
select plan(7);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('growth-credit-user');
select tests.clear_authentication();
set local role postgres;

select is((select original_credits from public.credit_grants where user_id = tests.get_supabase_uid('growth-credit-user')), 10, 'new user receives ten credits');
select is((select kind::text from public.credit_grants where user_id = tests.get_supabase_uid('growth-credit-user')), 'promotional', 'signup grant is promotional');
select ok((select expires_at between effective_at + interval '30 days' - interval '5 seconds' and effective_at + interval '30 days' + interval '5 seconds' from public.credit_grants where user_id = tests.get_supabase_uid('growth-credit-user')), 'grant expires in thirty days');
select is((select count(*)::integer from public.credit_transactions where user_id = tests.get_supabase_uid('growth-credit-user') and kind = 'grant'), 1, 'one grant ledger row exists');
select ok(not has_table_privilege('authenticated', 'public.credit_grants', 'insert'), 'client cannot self-grant credits');

select private.grant_growth_launch_credits(tests.get_supabase_uid('growth-credit-user'), pg_catalog.now());
select private.grant_growth_launch_credits(tests.get_supabase_uid('growth-credit-user'), pg_catalog.now());
select is((select count(*)::integer from public.credit_grants where user_id = tests.get_supabase_uid('growth-credit-user')), 1, 'repeating the helper keeps one grant');
select is((select count(*)::integer from public.credit_transactions where user_id = tests.get_supabase_uid('growth-credit-user') and kind = 'grant'), 1, 'repeating the helper keeps one grant ledger row');

select * from finish();
rollback;

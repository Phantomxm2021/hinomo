begin;
select plan(11);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('onboarding-user');
select tests.authenticate_as('onboarding-user');

select has_column(
  'public',
  'profiles',
  'onboarding_welcome_seen_at',
  'profiles records when the onboarding welcome was seen'
);
select ok(
  (
    select is_nullable = 'YES'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'onboarding_welcome_seen_at'
  ),
  'the onboarding welcome timestamp is nullable'
);
select has_function(
  'public',
  'mark_onboarding_welcome_seen',
  array[]::text[],
  'onboarding welcome RPC exists'
);
select ok(
  has_function_privilege('authenticated', 'public.mark_onboarding_welcome_seen()', 'execute'),
  'authenticated users can mark the onboarding welcome as seen'
);
select ok(
  not has_function_privilege('anon', 'public.mark_onboarding_welcome_seen()', 'execute'),
  'anonymous users cannot mark the onboarding welcome as seen'
);
select ok(
  not has_table_privilege('anon', 'public.profiles', 'select'),
  'anonymous users cannot read profiles'
);

select public.update_profile_locale('zh-CN');
select is(
  (select onboarding_welcome_seen_at from public.profiles where id = auth.uid()),
  null::timestamptz,
  'a profile starts with no onboarding welcome timestamp'
);

select lives_ok(
  $$select public.mark_onboarding_welcome_seen()$$,
  'the first onboarding welcome mark succeeds'
);
select ok(
  (select onboarding_welcome_seen_at is not null from public.profiles where id = auth.uid()),
  'the first onboarding welcome mark records a timestamp'
);

create temporary table onboarding_welcome_test_state (first_seen timestamptz) on commit drop;
insert into onboarding_welcome_test_state
select onboarding_welcome_seen_at from public.profiles where id = auth.uid();
select public.mark_onboarding_welcome_seen();
select is(
  (select onboarding_welcome_seen_at from public.profiles where id = auth.uid()),
  (select first_seen from onboarding_welcome_test_state),
  'repeated onboarding welcome marks preserve the first timestamp'
);

select tests.clear_authentication();
select throws_ok(
  $$select public.mark_onboarding_welcome_seen()$$,
  '42501',
  null,
  'anonymous execution is rejected'
);

select * from finish();
rollback;

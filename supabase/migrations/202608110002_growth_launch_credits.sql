-- Give each user created after this migration a single expiring launch-credit grant.

create function private.grant_growth_launch_credits(
  p_user_id uuid,
  p_effective_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare grant_id uuid;
begin
  insert into public.credit_grants (
    user_id, kind, original_credits, remaining_credits,
    effective_at, expires_at, source_reference
  ) values (
    p_user_id, 'promotional', 10, 10,
    p_effective_at, p_effective_at + interval '30 days',
    'signup:' || p_user_id || ':growth-launch-v1'
  )
  on conflict (kind, source_reference) do nothing
  returning id into grant_id;

  if grant_id is not null then
    insert into public.credit_transactions (
      user_id, grant_id, kind, credit_amount, idempotency_key, description
    ) values (
      p_user_id, grant_id, 'grant', 10,
      'grant:promotional:signup:' || p_user_id || ':growth-launch-v1',
      'Nomo launch credits'
    )
    on conflict (idempotency_key) do nothing;
  end if;
end;
$$;

create function private.grant_growth_launch_credits_on_signup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform private.grant_growth_launch_credits(new.id, pg_catalog.now());
  return new;
end;
$$;

revoke all on function private.grant_growth_launch_credits(uuid, timestamptz),
  private.grant_growth_launch_credits_on_signup()
  from public, anon, authenticated;

create trigger auth_user_grant_growth_launch_credits
after insert on auth.users
for each row execute function private.grant_growth_launch_credits_on_signup();

# Historical growth-credit backfill runbook

Use this runbook only for a specific account that was created before the growth-credit signup migration was deployed. The signup trigger remains the automatic path for new accounts; this is a one-user operational correction, not a blanket backfill migration.

## Safety rules

- Resolve the target user UUID outside Git, using the approved secure admin workflow. Do not commit an email address, user UUID, access token, service-role key, or customer data to this repository.
- Confirm the account was created before migration `202608110002_growth_launch_credits.sql` was applied. Do not use this procedure for a newly created account that should have received the signup grant.
- Execute the RPC from an authenticated `service_role` client/session. `public.grant_credits` rejects `anon` and `authenticated` callers and the database grants `EXECUTE` only to `service_role`.
- Replace `<USER_UUID_FROM_SECURE_LOOKUP>` at runtime. Never replace it with a real UUID in a committed document or launch record.
- Run the grant once for the target user. Repeating the same source is safe and returns the existing grant instead of creating another grant or ledger row.

## 1. Resolve and verify the target outside Git

In the approved secure operator console, resolve the account to a UUID and keep the result only in the operator's private session:

```sql
select id
from auth.users
where email = '<OPERATOR_SUPPLIED_EMAIL>';
```

Do not paste the email or returned UUID into this file, a commit, or the shared launch record. Confirm the account creation timestamp is before the growth-credit migration before continuing.

## 2. Preflight the service-role contract

Run this check from the same controlled database environment. The expected result is `service_role_can_execute = true` and both client-role values are `false`:

```sql
select
  has_function_privilege(
    'service_role',
    'public.grant_credits(uuid, public.credit_grant_kind, integer, timestamptz, timestamptz, text, text)',
    'EXECUTE'
  ) as service_role_can_execute,
  has_function_privilege(
    'authenticated',
    'public.grant_credits(uuid, public.credit_grant_kind, integer, timestamptz, timestamptz, text, text)',
    'EXECUTE'
  ) as authenticated_can_execute,
  has_function_privilege(
    'anon',
    'public.grant_credits(uuid, public.credit_grant_kind, integer, timestamptz, timestamptz, text, text)',
    'EXECUTE'
  ) as anon_can_execute;
```

Stop if the result does not match those expectations.

## 3. Grant the historical credits

Run the following as the service-role client/session after replacing the placeholder only in the private runtime input. The two `now()` expressions are evaluated in one transaction, so the grant is effective now and expires 30 days later.

```sql
begin;

with target as (
  select '<USER_UUID_FROM_SECURE_LOOKUP>'::uuid as user_id
)
select public.grant_credits(
  target.user_id,
  'promotional'::public.credit_grant_kind,
  10,
  now(),
  now() + interval '30 days',
  'backfill:' || target.user_id::text || ':growth-launch-v1',
  'Nomo launch credits backfill'
)
from target;

commit;
```

If the call fails, do not retry with a different source. Investigate the service-role session and target UUID first.

## 4. Verify idempotency and the ledger

Run this read-only verification with the same runtime UUID. Expected results are exactly one grant row, exactly one grant transaction, 10 original and remaining credits, and an expiry approximately 30 days after the effective time:

```sql
with target as (
  select '<USER_UUID_FROM_SECURE_LOOKUP>'::uuid as user_id
), expected as (
  select
    user_id,
    'backfill:' || user_id::text || ':growth-launch-v1' as source_reference,
    'grant:promotional:backfill:' || user_id::text || ':growth-launch-v1' as idempotency_key
  from target
)
select
  grants.id,
  grants.user_id,
  grants.kind,
  grants.original_credits,
  grants.remaining_credits,
  grants.effective_at,
  grants.expires_at,
  transactions.id as transaction_id,
  transactions.credit_amount,
  transactions.idempotency_key
from expected
join public.credit_grants grants
  on grants.user_id = expected.user_id
 and grants.kind = 'promotional'
 and grants.source_reference = expected.source_reference
join public.credit_transactions transactions
  on transactions.grant_id = grants.id
 and transactions.idempotency_key = expected.idempotency_key;
```

The verification must return one row. If the same grant command is run a second time, rerun this query and confirm it still returns one row; do not expect a second transaction. Record only the non-sensitive outcome (pass/fail and timestamp) in the launch record.

## Completion criteria

- [ ] Target UUID was resolved and retained only in the secure operator session.
- [ ] The account predates the signup migration.
- [ ] The RPC ran through `service_role` and granted 10 promotional credits.
- [ ] `effective_at` is the execution time and `expires_at` is 30 days later.
- [ ] The `backfill:<user_uuid>:growth-launch-v1` source and matching transaction are each unique.
- [ ] No user identifier, email, secret, or personal data was committed to Git.

-- Checkout uses the service-role client to reject purchases for accounts that
-- already own this entitlement. Mutations remain restricted to the audited RPCs.
grant select on table public.account_entitlements to service_role;

-- Reapply the narrowly scoped update permission for existing default venues.
-- Some deployments ran the default-venue migration before its rename policy fix.
drop policy if exists venues_update_own on public.venues;

create policy venues_update_own on public.venues
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

revoke update on table public.venues from authenticated;
grant update (name, description) on table public.venues to authenticated;

notify pgrst, 'reload schema';

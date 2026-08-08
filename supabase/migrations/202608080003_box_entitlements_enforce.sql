revoke insert on table public.boxes from public, anon, authenticated;

revoke insert (owner_id, space_id, name, category, location, description, visibility)
on table public.boxes from public, anon, authenticated;

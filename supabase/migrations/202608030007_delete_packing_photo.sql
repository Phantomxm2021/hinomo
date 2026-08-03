create function public.delete_packing_photo(p_photo_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller uuid := auth.uid();
  current_photo public.packing_photos%rowtype;
  current_session public.packing_sessions%rowtype;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  select photos.* into current_photo
  from public.packing_photos photos
  where photos.id = p_photo_id and photos.owner_id = caller
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'packing photo is not accessible';
  end if;

  select * into current_session
  from public.packing_sessions sessions
  where sessions.id = current_photo.session_id and sessions.owner_id = caller
  for update;

  if current_session.status not in (
    'capturing'::public.packing_session_status,
    'uploading'::public.packing_session_status
  ) then
    raise exception using errcode = '22023', message = 'packing session no longer accepts photo removal';
  end if;

  delete from public.packing_photos where id = current_photo.id;
end;
$$;

revoke all on function public.delete_packing_photo(uuid) from public, anon;
grant execute on function public.delete_packing_photo(uuid) to authenticated;

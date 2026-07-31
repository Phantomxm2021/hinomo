create or replace function public.get_public_box(p_public_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  public_id uuid,
  box_code text,
  space_id uuid,
  name text,
  category text,
  location text,
  description text,
  visibility public.box_visibility,
  cover_object_key text,
  updated_at timestamptz,
  space_name text,
  items jsonb
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    boxes.id,
    boxes.owner_id,
    boxes.public_id,
    boxes.box_code,
    boxes.space_id,
    boxes.name,
    boxes.category,
    boxes.location,
    boxes.description,
    boxes.visibility,
    boxes.cover_object_key,
    boxes.updated_at,
    spaces.name as space_name,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', items.id,
          'name', items.name,
          'category', items.category,
          'quantity', items.quantity,
          'description', items.description,
          'image_object_key', items.image_object_key
        ) order by items.created_at
      ) filter (where items.id is not null),
      '[]'::jsonb
    ) as items
  from public.boxes as boxes
  join public.spaces as spaces on spaces.id = boxes.space_id
  left join public.items as items on items.box_id = boxes.id
  where boxes.public_id = p_public_id
    and boxes.visibility = 'public'::public.box_visibility
  group by boxes.id, spaces.name;
$$;

revoke all on function public.get_public_box(uuid) from public;
grant execute on function public.get_public_box(uuid) to anon, authenticated;

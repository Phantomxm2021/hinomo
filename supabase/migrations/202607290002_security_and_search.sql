create extension if not exists pg_trgm with schema extensions;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := current_timestamp;
  return new;
end;
$$;

create trigger spaces_set_updated_at
before update on public.spaces
for each row execute function public.set_updated_at();

create trigger boxes_set_updated_at
before update on public.boxes
for each row execute function public.set_updated_at();

create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

alter table public.spaces enable row level security;
alter table public.boxes enable row level security;
alter table public.items enable row level security;
alter table public.activity_logs enable row level security;
alter table public.media_uploads enable row level security;
alter table public.media_cleanup_jobs enable row level security;

create policy spaces_select_own on public.spaces
for select to authenticated
using (owner_id = auth.uid());

create policy spaces_insert_own on public.spaces
for insert to authenticated
with check (owner_id = auth.uid());

create policy spaces_update_own on public.spaces
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy spaces_delete_own on public.spaces
for delete to authenticated
using (owner_id = auth.uid());

create policy boxes_select_public_or_own on public.boxes
for select to public
using (visibility = 'public'::public.box_visibility or owner_id = auth.uid());

create policy boxes_insert_own_space on public.boxes
for insert to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.spaces as spaces
    where spaces.id = space_id
      and spaces.owner_id = auth.uid()
  )
);

create policy boxes_update_own_space on public.boxes
for update to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.spaces as spaces
    where spaces.id = space_id
      and spaces.owner_id = auth.uid()
  )
);

create policy boxes_delete_own on public.boxes
for delete to authenticated
using (owner_id = auth.uid());

create policy items_select_public_or_own_box on public.items
for select to public
using (
  exists (
    select 1
    from public.boxes as boxes
    where boxes.id = box_id
      and (boxes.visibility = 'public'::public.box_visibility or boxes.owner_id = auth.uid())
  )
);

create policy items_insert_own_box on public.items
for insert to authenticated
with check (
  exists (
    select 1
    from public.boxes as boxes
    where boxes.id = box_id
      and boxes.owner_id = auth.uid()
  )
);

create policy items_update_own_box on public.items
for update to authenticated
using (
  exists (
    select 1
    from public.boxes as boxes
    where boxes.id = box_id
      and boxes.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.boxes as boxes
    where boxes.id = box_id
      and boxes.owner_id = auth.uid()
  )
);

create policy items_delete_own_box on public.items
for delete to authenticated
using (
  exists (
    select 1
    from public.boxes as boxes
    where boxes.id = box_id
      and boxes.owner_id = auth.uid()
  )
);

create policy activity_logs_select_actor_or_box_owner on public.activity_logs
for select to authenticated
using (
  actor_id = auth.uid()
  or exists (
    select 1
    from public.boxes as boxes
    where boxes.id = box_id
      and boxes.owner_id = auth.uid()
  )
);

create function public.write_activity_log()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  audit_action public.audit_action;
  audit_entity public.audit_entity;
  audit_entity_id uuid;
  audit_box_id uuid;
  audit_snapshot jsonb;
begin
  audit_action := case tg_op
    when 'INSERT' then 'create'::public.audit_action
    when 'UPDATE' then 'update'::public.audit_action
    when 'DELETE' then 'delete'::public.audit_action
  end;

  audit_entity := case tg_table_name
    when 'spaces' then 'space'::public.audit_entity
    when 'boxes' then 'box'::public.audit_entity
    when 'items' then 'item'::public.audit_entity
  end;

  if tg_op = 'DELETE' then
    audit_entity_id := old.id;
    audit_box_id := case tg_table_name
      when 'boxes' then old.id
      when 'items' then old.box_id
      else null
    end;
    audit_snapshot := pg_catalog.to_jsonb(old) - array['cover_object_key', 'image_object_key'];
  else
    audit_entity_id := new.id;
    audit_box_id := case tg_table_name
      when 'boxes' then new.id
      when 'items' then new.box_id
      else null
    end;
    audit_snapshot := pg_catalog.to_jsonb(new) - array['cover_object_key', 'image_object_key'];
  end if;

  insert into public.activity_logs (actor_id, box_id, action, entity_type, entity_id, snapshot)
  values (auth.uid(), audit_box_id, audit_action, audit_entity, audit_entity_id, audit_snapshot);

  return coalesce(new, old);
end;
$$;

create trigger spaces_write_activity_log
after insert or update or delete on public.spaces
for each row execute function public.write_activity_log();

create trigger boxes_write_activity_log
after insert or update or delete on public.boxes
for each row execute function public.write_activity_log();

create trigger items_write_activity_log
after insert or update or delete on public.items
for each row execute function public.write_activity_log();

create index activity_logs_box_id_created_at_idx
on public.activity_logs (box_id, created_at desc);

create index items_search_text_trgm_idx
on public.items
using gin ((pg_catalog.lower(coalesce(name, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, ''))) extensions.gin_trgm_ops);

create function public.search_my_items(p_query text)
returns table (
  item_id uuid,
  item_name text,
  quantity integer,
  box_id uuid,
  box_public_id uuid,
  box_name text,
  space_name text,
  location text
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select
    items.id as item_id,
    items.name as item_name,
    items.quantity,
    boxes.id as box_id,
    boxes.public_id as box_public_id,
    boxes.name as box_name,
    spaces.name as space_name,
    boxes.location
  from public.items as items
  join public.boxes as boxes on boxes.id = items.box_id
  join public.spaces as spaces on spaces.id = boxes.space_id
  where boxes.owner_id = auth.uid()
    and nullif(pg_catalog.btrim(p_query), '') is not null
    and pg_catalog.lower(coalesce(items.name, '') || ' ' || coalesce(items.category, '') || ' ' || coalesce(items.description, ''))
      ilike '%' || pg_catalog.lower(pg_catalog.btrim(p_query)) || '%'
  order by items.updated_at desc, items.name
  limit 100;
$$;

revoke all on function public.search_my_items(text) from public;
grant execute on function public.search_my_items(text) to authenticated;

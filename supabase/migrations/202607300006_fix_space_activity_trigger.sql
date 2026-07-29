create or replace function public.write_activity_log()
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
      when 'boxes' then null
      when 'items' then
        case
          when exists (
            select 1
            from public.boxes as boxes
            where boxes.id = (pg_catalog.to_jsonb(old)->>'box_id')::uuid
          ) then (pg_catalog.to_jsonb(old)->>'box_id')::uuid
          else null
        end
      else null
    end;
    audit_snapshot := pg_catalog.to_jsonb(old) - array['cover_object_key', 'image_object_key'];
  else
    audit_entity_id := new.id;
    audit_box_id := case tg_table_name
      when 'boxes' then new.id
      when 'items' then (pg_catalog.to_jsonb(new)->>'box_id')::uuid
      else null
    end;
    audit_snapshot := pg_catalog.to_jsonb(new) - array['cover_object_key', 'image_object_key'];
  end if;

  insert into public.activity_logs (actor_id, box_id, action, entity_type, entity_id, snapshot)
  values (auth.uid(), audit_box_id, audit_action, audit_entity, audit_entity_id, audit_snapshot);

  return coalesce(new, old);
end;
$$;

revoke all on function public.write_activity_log() from public;

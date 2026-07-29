-- RLS decides which rows are visible; these grants expose only the operations
-- required by the browser client. Media metadata remains RPC-only.
grant select, insert, update, delete on table public.spaces to authenticated;

grant select, delete on table public.boxes to authenticated;
grant select, delete on table public.items to authenticated;
grant select on table public.activity_logs to authenticated;

grant select on table public.boxes to anon;
grant select on table public.items to anon;

-- boxes_assign_identifiers runs as the caller and advances this sequence.
grant usage on sequence public.box_code_seq to authenticated;

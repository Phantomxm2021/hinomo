begin;
select plan(12);

select has_column('public', 'packing_atlases', 'upload_status', 'Atlas upload status exists');
select has_column('public', 'packing_atlases', 'confirmed_at', 'Atlas confirmation time exists');
select has_function('public', 'create_packing_atlas_upload',
  array['uuid', 'integer', 'integer', 'integer', 'integer', 'integer', 'bigint', 'text'],
  'client Atlas upload RPC exists');
select has_function('public', 'confirm_packing_atlas_upload', array['uuid'], 'Atlas confirmation RPC exists');
select has_function('public', 'delete_packing_photo', array['uuid'], 'capturing photo removal RPC exists');
select has_function('public', 'create_packing_service_media_url', array['text', 'text', 'text'],
  'service media signing RPC exists');
select ok(has_function_privilege('authenticated',
  'public.create_packing_atlas_upload(uuid, integer, integer, integer, integer, integer, bigint, text)', 'execute'),
  'authenticated users can prepare their Atlas upload');
select ok(not has_function_privilege('authenticated',
  'public.create_packing_service_media_url(text, text, text)', 'execute'),
  'clients cannot create worker media URLs');
select ok(has_function_privilege('authenticated',
  'public.delete_packing_photo(uuid)', 'execute'),
  'authenticated users can remove their own capturing photos');
select trigger_is('public', 'packing_sessions', 'packing_sessions_require_client_atlases',
  'private.validate_packing_atlases_before_queue()', 'queue transition requires persisted Atlases');
select trigger_is('public', 'packing_sessions', 'packing_sessions_wake_edge_function',
  'private.wake_packing_edge_function()', 'queued sessions wake the Edge Function');
select is((select count(*)::integer from cron.job where jobname = 'invoke-packing-edge-function'), 1,
  'Cron fallback invokes the packing Edge Function');

select * from finish();
rollback;

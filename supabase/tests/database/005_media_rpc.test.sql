begin;
select plan(31);

create extension if not exists "basejump-supabase_test_helpers" with schema tests;

select is(
  (select count(*)::integer
   from vault.secrets
   where name in ('r2_account_id', 'r2_bucket_name', 'r2_access_key_id', 'r2_secret_access_key')),
  0,
  'the disposable test Vault starts without the four fixed R2 secret names'
);

-- This transaction is only safe in an isolated, disposable database with an empty Vault.
select vault.create_secret('0123456789abcdef0123456789abcdef', 'r2_account_id', 'pgTAP R2 account');
select vault.create_secret('nomo-test-bucket', 'r2_bucket_name', 'pgTAP R2 bucket');
select vault.create_secret('R2TESTACCESSKEY', 'r2_access_key_id', 'pgTAP R2 access key');
select vault.create_secret('r2-test-secret-key', 'r2_secret_access_key', 'pgTAP R2 secret key');

select tests.create_supabase_user('media-rpc-owner');
select tests.create_supabase_user('media-rpc-other');
select tests.clear_authentication();
set local role postgres;

create temporary table media_rpc_state (
  owner_id uuid not null,
  other_id uuid not null,
  owner_space_id uuid not null,
  other_space_id uuid not null,
  public_box_id uuid not null,
  private_box_id uuid not null,
  other_box_id uuid not null,
  public_item_id uuid not null,
  private_item_id uuid not null,
  public_box_public_id uuid,
  private_box_public_id uuid,
  other_box_public_id uuid,
  cover_upload_id uuid,
  cover_key text,
  cover_upload_url text,
  item_upload_id uuid,
  item_key text,
  private_upload_id uuid,
  private_key text
) on commit drop;

grant select, update on media_rpc_state to authenticated;
grant select on media_rpc_state to anon;

insert into media_rpc_state (
  owner_id, other_id, owner_space_id, other_space_id, public_box_id,
  private_box_id, other_box_id, public_item_id, private_item_id
)
values (
  tests.get_supabase_uid('media-rpc-owner'),
  tests.get_supabase_uid('media-rpc-other'),
  '51000000-0000-0000-0000-000000000001',
  '52000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000002',
  '62000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000002'
);

insert into public.venues (id, owner_id, name)
select '50000000-0000-0000-0000-000000000001', owner_id, 'Media RPC owner venue'
from media_rpc_state
union all
select '50000000-0000-0000-0000-000000000002', other_id, 'Media RPC other venue'
from media_rpc_state;

insert into public.spaces (id, owner_id, venue_id, name)
select owner_space_id, owner_id, '50000000-0000-0000-0000-000000000001', 'Media RPC owner space'
from media_rpc_state
union all
select other_space_id, other_id, '50000000-0000-0000-0000-000000000002', 'Media RPC other space'
from media_rpc_state;

insert into public.boxes (id, owner_id, space_id, name, visibility)
select public_box_id, owner_id, owner_space_id, 'Public media box', 'public'
from media_rpc_state
union all
select private_box_id, owner_id, owner_space_id, 'Private media box', 'private'
from media_rpc_state
union all
select other_box_id, other_id, other_space_id, 'Other media box', 'private'
from media_rpc_state;

insert into public.items (id, box_id, name)
select public_item_id, public_box_id, 'Public media item'
from media_rpc_state
union all
select private_item_id, private_box_id, 'Private media item'
from media_rpc_state;

update media_rpc_state as state
set public_box_public_id = (select public_id from public.boxes where id = state.public_box_id),
    private_box_public_id = (select public_id from public.boxes where id = state.private_box_id),
    other_box_public_id = (select public_id from public.boxes where id = state.other_box_id);

select tests.authenticate_as('media-rpc-owner');
with created as (
  select *
  from media_rpc_state as state,
  lateral public.create_media_upload(state.public_box_id, null, 'cover', 'image/jpeg', 1234)
)
update media_rpc_state as state
set cover_upload_id = created.upload_id,
    cover_key = created.object_key,
    cover_upload_url = created.upload_url
from created;

select ok(
  (select cover_upload_id is not null
       and public_box_public_id is not null
       and private_box_public_id is not null
       and other_box_public_id is not null
       and cover_key ~ ('^users/' || owner_id || '/boxes/' || public_box_id || '/cover/[0-9a-f-]+\\.jpg$')
   from media_rpc_state),
  'owner upload uses captured generated ids and returns an owner-scoped JPEG object key'
);
select ok(
  (select cover_upload_id is not null
       and cover_key is not null
       and cover_upload_url like 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/nomo-test-bucket/%'
       and cover_upload_url like '%X-Amz-SignedHeaders=content-type%3Bhost%'
   from media_rpc_state),
  'one owner upload session returns its id, object key, and PUT presigned URL'
);

select tests.clear_authentication();
set local role postgres;
select is(
  (select status::text from public.media_uploads where id = (select cover_upload_id from media_rpc_state)),
  'pending',
  'new owner upload is pending'
);
select ok(
  (select expires_at > now() + interval '4 minutes' and expires_at <= now() + interval '5 minutes'
   from public.media_uploads where id = (select cover_upload_id from media_rpc_state)),
  'new owner upload expires in five minutes'
);

select tests.clear_authentication();
select throws_ok(
  $$select * from public.create_media_upload('61000000-0000-0000-0000-000000000001', null, 'cover', 'image/jpeg', 1)$$,
  '42501', null, 'anonymous users cannot create uploads'
);

select tests.authenticate_as('media-rpc-other');
select throws_ok(
  $$select * from public.create_media_upload('61000000-0000-0000-0000-000000000001', null, 'cover', 'image/jpeg', 1)$$,
  '42501', 'media target is not accessible', 'another user cannot create an upload for the owner box'
);
select lives_ok(
  $$select * from public.create_media_upload('62000000-0000-0000-0000-000000000001', null, 'cover', 'image/jpeg', 1)$$,
  'another user can create an upload for their own box'
);

select tests.authenticate_as('media-rpc-owner');
select throws_ok(
  $$select * from public.create_media_upload('61000000-0000-0000-0000-000000000001', null, 'cover', 'image/gif', 1)$$,
  '22023', 'invalid media metadata', 'unsupported MIME type is rejected'
);
select throws_ok(
  $$select * from public.create_media_upload('61000000-0000-0000-0000-000000000001', null, 'cover', 'image/jpeg', 5242881)$$,
  '22023', 'invalid media metadata', 'oversize upload is rejected'
);
select throws_ok(
  $$select * from public.create_media_upload('61000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'cover', 'image/jpeg', 1)$$,
  '22023', 'invalid media target', 'cover uploads cannot name an item'
);
select throws_ok(
  $$select * from public.create_media_upload('61000000-0000-0000-0000-000000000001', null, 'item', 'image/jpeg', 1)$$,
  '22023', 'invalid media target', 'item uploads require an item'
);
select throws_ok(
  $$select * from public.create_media_upload('61000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', 'item', 'image/jpeg', 1)$$,
  '22023', 'invalid media target', 'item uploads cannot cross box boundaries'
);

select throws_ok(
  $$insert into public.boxes(owner_id, space_id, name, cover_object_key, cover_mime_type, cover_size_bytes)
      values (auth.uid(), '51000000-0000-0000-0000-000000000001', 'Direct media insert', 'direct/cover', 'image/jpeg', 1)$$,
  '42501', null, 'authenticated clients cannot insert box media columns directly'
);
select throws_ok(
  $$insert into public.items(box_id, name, image_object_key, image_mime_type, image_size_bytes)
      values ('61000000-0000-0000-0000-000000000001', 'Direct item media insert', 'direct/item', 'image/jpeg', 1)$$,
  '42501', null, 'authenticated clients cannot insert item media columns directly'
);
select throws_ok(
  $$update public.boxes set cover_object_key = 'direct/cover', cover_mime_type = 'image/jpeg', cover_size_bytes = 1
      where id = '61000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'authenticated clients cannot update box media columns directly'
);
select throws_ok(
  $$update public.items set image_object_key = 'direct/item', image_mime_type = 'image/jpeg', image_size_bytes = 1
      where id = '71000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'authenticated clients cannot update item media columns directly'
);
select lives_ok(
  $$update public.boxes set name = 'Public media box renamed' where id = '61000000-0000-0000-0000-000000000001'$$,
  'authenticated clients can still update non-media box fields'
);
select lives_ok(
  $$update public.items set name = 'Public media item renamed' where id = '71000000-0000-0000-0000-000000000001'$$,
  'authenticated clients can still update non-media item fields'
);

select public.confirm_media_upload((select cover_upload_id from media_rpc_state));
select ok(
  (select cover_object_key = state.cover_key and cover_mime_type = 'image/jpeg' and cover_size_bytes = 1234
   from public.boxes cross join media_rpc_state as state where boxes.id = state.public_box_id),
  'confirming a cover updates its box media metadata'
);
select tests.clear_authentication();
set local role postgres;
select is(
  (select status::text from public.media_uploads where id = (select cover_upload_id from media_rpc_state)),
  'confirmed',
  'confirming a cover marks its upload confirmed'
);
select tests.authenticate_as('media-rpc-owner');

with created as (
  select * from media_rpc_state as state,
  lateral public.create_media_upload(state.public_box_id, state.public_item_id, 'item', 'image/webp', 4321)
)
update media_rpc_state as state
set item_upload_id = created.upload_id, item_key = created.object_key
from created;
select public.confirm_media_upload((select item_upload_id from media_rpc_state));
select ok(
  (select image_object_key = state.item_key and image_mime_type = 'image/webp' and image_size_bytes = 4321
   from public.items cross join media_rpc_state as state where items.id = state.public_item_id),
  'confirming an item updates its item media metadata'
);
select tests.clear_authentication();
set local role postgres;
select is(
  (select status::text from public.media_uploads where id = (select item_upload_id from media_rpc_state)),
  'confirmed',
  'confirming an item marks its upload confirmed'
);
select tests.authenticate_as('media-rpc-owner');

with created as (
  select * from media_rpc_state as state,
  lateral public.create_media_upload(state.private_box_id, null, 'cover', 'image/png', 99)
)
update media_rpc_state as state
set private_upload_id = created.upload_id, private_key = created.object_key
from created;
select tests.authenticate_as('media-rpc-other');
select throws_ok(
  $$select public.confirm_media_upload((select private_upload_id from media_rpc_state))$$,
  '42501', 'media upload is not accessible', 'only the upload owner can confirm it'
);
select tests.clear_authentication();
set local role postgres;
update public.media_uploads set expires_at = now() - interval '1 second'
where id = (select private_upload_id from media_rpc_state);
select tests.authenticate_as('media-rpc-owner');
select throws_ok(
  $$select public.confirm_media_upload((select private_upload_id from media_rpc_state))$$,
  '22023', 'media upload is no longer confirmable', 'expired upload cannot be confirmed'
);
select throws_ok(
  $$select public.confirm_media_upload((select cover_upload_id from media_rpc_state))$$,
  '22023', 'media upload is no longer confirmable', 'confirmed upload cannot be confirmed twice'
);

-- Clear auth before inspecting the anonymous public-download path; the RPC itself remains executable to anon.
select tests.clear_authentication();
select ok(
  (select download_url like 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/nomo-test-bucket/%'
       and expires_at > now() + interval '4 minutes'
   from public.create_media_download((select cover_key from media_rpc_state))),
  'anonymous users can create a download URL for public media'
);
select throws_ok(
  $$select * from public.create_media_download((select private_key from media_rpc_state))$$,
  '42501', 'media object is not accessible', 'anonymous users cannot download private media'
);
select tests.authenticate_as('media-rpc-other');
select throws_ok(
  $$select * from public.create_media_download((select private_key from media_rpc_state))$$,
  '42501', 'media object is not accessible', 'another user cannot download private media'
);
select tests.authenticate_as('media-rpc-owner');
-- The expired private upload deliberately remains pending; make a second private upload for the download authorization fixture.
with created as (
  select * from media_rpc_state as state,
  lateral public.create_media_upload(state.private_box_id, null, 'cover', 'image/png', 100)
)
update media_rpc_state as state
set private_upload_id = created.upload_id, private_key = created.object_key
from created;
select public.confirm_media_upload((select private_upload_id from media_rpc_state));
select ok(
  (select download_url like 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/nomo-test-bucket/%'
   from public.create_media_download((select private_key from media_rpc_state))),
  'owner can create a download URL for private media'
);
select throws_ok(
  $$select * from public.create_media_download('users/missing/object.webp')$$,
  '42501', 'media object is not accessible', 'missing object key is not downloadable'
);

select * from finish();
rollback;

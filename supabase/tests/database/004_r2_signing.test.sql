begin;
select plan(11);

select is(private.aws_uri_encode('users/a box/image.webp', false), 'users/a%20box/image.webp', 'object path encoding preserves slash and encodes spaces');
select is(private.aws_uri_encode('a/b', true), 'a%2Fb', 'slash is encoded when requested');
select is(private.aws_uri_encode('茶/叶.webp', false), '%E8%8C%B6/%E5%8F%B6.webp', 'UTF-8 bytes use uppercase percent encoding');

select is(
  private.r2_presign_with_credentials(
    'GET', '0123456789abcdef0123456789abcdef', 'R2EXAMPLEACCESSKEY', 'r2-example-secret-key',
    'nomo-dev', 'users/11111111-1111-1111-1111-111111111111/boxes/22222222-2222-2222-2222-222222222222/item/tea photo.webp',
    null, 300, '2026-07-29 12:00:00+00'::timestamptz
  ),
  'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/nomo-dev/users/11111111-1111-1111-1111-111111111111/boxes/22222222-2222-2222-2222-222222222222/item/tea%20photo.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=R2EXAMPLEACCESSKEY%2F20260729%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260729T120000Z&X-Amz-Expires=300&X-Amz-SignedHeaders=host&X-Amz-Signature=cb8e4e572067057eabd94595b550c06cecd7d8622a8530e32a738809d5f5d184',
  'fixed GET vector produces the exact independently calculated URL and signature'
);
select ok(
  pg_catalog.position(
    'X-Amz-SignedHeaders=content-type%3Bhost'
    in private.r2_presign_with_credentials('PUT', '0123456789abcdef0123456789abcdef', 'R2EXAMPLEACCESSKEY', 'r2-example-secret-key', 'nomo-dev', 'fixed/key.webp', 'image/webp', 300, '2026-07-29 12:00:00+00')
  ) > 0,
  'PUT signs content-type and host'
);
select isnt(
  private.r2_presign_with_credentials('PUT', '0123456789abcdef0123456789abcdef', 'R2EXAMPLEACCESSKEY', 'r2-example-secret-key', 'nomo-dev', 'fixed/key.webp', 'image/webp', 300, '2026-07-29 12:00:00+00'),
  private.r2_presign_with_credentials('PUT', '0123456789abcdef0123456789abcdef', 'R2EXAMPLEACCESSKEY', 'r2-example-secret-key', 'nomo-dev', 'fixed/key.webp', 'image/png', 300, '2026-07-29 12:00:00+00'),
  'changing the PUT MIME type changes the signature'
);
select throws_ok($$select private.r2_presign_with_credentials('POST', 'a', 'k', 's', 'b', 'key', null, 300, '2026-07-29 12:00:00+00')$$, '22023', 'R2 presign method must be GET, PUT, or DELETE', 'unsupported methods are rejected');
select throws_ok($$select private.r2_presign_with_credentials('GET', 'a', 'k', 's', 'b', 'key', null, 0, '2026-07-29 12:00:00+00')$$, '22023', 'R2 presign expiry must be between 1 and 3600 seconds', 'zero expiry is rejected');
select throws_ok($$select private.r2_presign_with_credentials('GET', 'a', 'k', 's', 'b', 'key', null, 3601, '2026-07-29 12:00:00+00')$$, '22023', 'R2 presign expiry must be between 1 and 3600 seconds', 'expiry above one hour is rejected');
select throws_ok($$select private.r2_presign_with_credentials('PUT', 'a', 'k', 's', 'b', 'key', null, 300, '2026-07-29 12:00:00+00')$$, '22023', 'PUT requires an exact single-line content type', 'PUT requires content type');
select throws_ok($$select private.r2_presign_with_credentials('GET', 'a', 'k', 's', 'b', 'key', 'image/webp', 300, '2026-07-29 12:00:00+00')$$, '22023', 'content type is only signed for PUT', 'GET rejects content type');

select * from finish();
rollback;

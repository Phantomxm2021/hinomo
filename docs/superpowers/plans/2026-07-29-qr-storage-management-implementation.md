# QR Code 智能收纳清单管理系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个移动优先的 React PWA，使用 Supabase 管理认证与业务数据，并通过数据库 RPC/Trigger 安全直传私有 Cloudflare R2，实现空间、箱子、二维码、物品、搜索与批量打印闭环。

**Architecture:** 仓库采用 npm workspaces：`apps/web` 承载 React PWA，`supabase` 承载可版本化数据库迁移和 pgTAP 测试。前端通过 Supabase SDK 访问受 RLS 保护的数据；R2 密钥只存在 Supabase Vault，RPC 生成短时 SigV4 URL，Trigger 与定时任务处理媒体清理。

**Tech Stack:** React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS, Supabase Auth/Postgres/RLS/RPC/Trigger, Cloudflare R2, Vitest, React Testing Library, pgTAP, Playwright, Cloudflare Pages

---

## 文件结构

```text
Nomo/
├── apps/web/
│   ├── public/                         # PWA 图标与静态资源
│   ├── src/app/                        # 路由、QueryClient、认证守卫、应用壳
│   ├── src/components/                 # 通用可访问 UI
│   ├── src/features/auth/              # 注册、登录、重置密码
│   ├── src/features/spaces/            # 空间列表与表单
│   ├── src/features/boxes/             # 箱子列表、详情、表单与公开页
│   ├── src/features/items/             # 物品 CRUD
│   ├── src/features/media/             # 压缩、签名上传与签名下载
│   ├── src/features/search/            # 全局物品搜索
│   ├── src/features/qr-print/           # QR、PNG 与 PDF
│   ├── src/features/scanner/            # 相机扫码
│   ├── src/lib/                         # Supabase 客户端、环境变量、错误映射
│   └── e2e/                             # Playwright 用户旅程
├── supabase/
│   ├── migrations/                     # 表、约束、RLS、RPC、Trigger、cron
│   ├── tests/database/                  # pgTAP 权限与函数测试
│   └── seed.sql                         # 本地确定性测试数据
├── docs/runbooks/                       # R2、Supabase、Cloudflare Pages 运维说明
├── package.json                         # workspace 与统一命令
└── .github/workflows/ci.yml             # CI
```

## Task 1: 初始化 workspace、React 应用与测试基线

**Files:**
- Create: `package.json`
- Modify: `.gitignore`
- Create: `apps/web/*`（由 Vite 生成）
- Modify: `apps/web/package.json`
- Create: `apps/web/src/app/App.test.tsx`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/vite.config.ts`
- Create: `supabase/config.toml`（由 Supabase CLI 生成）

- [ ] **Step 1: 创建 workspace 和 Vite React TypeScript 应用**

Run:

```bash
npm create vite@latest apps/web -- --template react-ts
npx supabase init
```

Expected: `apps/web/src/App.tsx` 与 `supabase/config.toml` 存在。

- [ ] **Step 2: 写入根 workspace 配置**

```json
{
  "name": "nomo",
  "private": true,
  "workspaces": ["apps/*"],
  "scripts": {
    "dev": "npm run dev --workspace @nomo/web",
    "build": "npm run build --workspace @nomo/web",
    "lint": "npm run lint --workspace @nomo/web",
    "typecheck": "npm run typecheck --workspace @nomo/web",
    "test": "npm run test --workspace @nomo/web",
    "test:e2e": "npm run test:e2e --workspace @nomo/web",
    "test:db": "supabase test db"
  }
}
```

- [ ] **Step 3: 安装运行与测试依赖**

Run:

```bash
npm install --workspace apps/web react-router-dom @supabase/supabase-js @tanstack/react-query react-hook-form @hookform/resolvers zod qrcode jspdf browser-image-compression @zxing/browser
npm install --workspace apps/web -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event vite-plugin-pwa @vite-pwa/assets-generator @playwright/test lighthouse tailwindcss @tailwindcss/vite eslint typescript
```

Expected: `apps/web/package.json` 包含上述依赖，根目录生成 `package-lock.json`。

将根 `.gitignore` 扩展为：

```gitignore
.superpowers/
node_modules/
dist/
playwright-report/
test-results/
.env
.env.*
!.env.example
```

- [ ] **Step 4: 先写应用烟雾测试**

```tsx
// apps/web/src/app/App.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('renders the product name', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Nomo' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: 运行测试确认失败**

Run: `npm test -- --run`

Expected: FAIL，提示找不到 `src/app/App` 或命名导出 `App`。

- [ ] **Step 6: 配置 Vitest 并实现最小 App**

```ts
// apps/web/src/test/setup.ts
import '@testing-library/jest-dom/vitest'
```

```ts
// apps/web/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

```tsx
// apps/web/src/app/App.tsx
export function App() {
  return <h1>Nomo</h1>
}
```

在 `apps/web/package.json` 中设置 `name` 为 `@nomo/web`，并加入：

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 7: 验证基线**

Run:

```bash
npm test -- --run
npm run typecheck
npm run build
```

Expected: 三条命令全部成功，烟雾测试 PASS。

- [ ] **Step 8: 提交**

```bash
git add package.json package-lock.json apps/web supabase/config.toml
git commit -m "chore: scaffold React PWA workspace"
```

## Task 2: 建立 Supabase 核心数据模型与约束

**Files:**
- Create: `supabase/migrations/202607290001_core_schema.sql`
- Create: `supabase/tests/database/001_core_schema.test.sql`

- [ ] **Step 1: 写失败的数据库结构测试**

```sql
-- supabase/tests/database/001_core_schema.test.sql
begin;
select plan(9);

select has_table('public', 'spaces', 'spaces exists');
select has_table('public', 'boxes', 'boxes exists');
select has_table('public', 'items', 'items exists');
select has_table('public', 'activity_logs', 'activity_logs exists');
select has_table('public', 'media_uploads', 'media_uploads exists');
select has_table('public', 'media_cleanup_jobs', 'media_cleanup_jobs exists');
select col_is_unique('public', 'boxes', 'public_id', 'public_id is unique');
select col_is_unique('public', 'boxes', 'box_code', 'box_code is unique');
select throws_ok(
  $$insert into public.items(box_id, name, quantity) values (gen_random_uuid(), 'x', 0)$$,
  '23514', null, 'quantity must be positive'
);

select * from finish();
rollback;
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx supabase start && npm run test:db`

Expected: FAIL，`spaces` 等表不存在。

- [ ] **Step 3: 创建枚举、序列和核心表**

```sql
-- supabase/migrations/202607290001_core_schema.sql
create extension if not exists pgcrypto with schema extensions;

create type public.box_visibility as enum ('public', 'private');
create type public.audit_action as enum ('create', 'update', 'delete');
create type public.audit_entity as enum ('space', 'box', 'item');
create type public.media_kind as enum ('cover', 'item');
create type public.media_upload_status as enum ('pending', 'confirmed', 'expired');
create type public.cleanup_status as enum ('pending', 'processing', 'completed', 'failed');
create sequence public.box_code_seq;

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boxes (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  box_code text not null unique default ('BX-' || lpad(nextval('public.box_code_seq')::text, 5, '0')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text check (category is null or char_length(category) <= 80),
  location text check (location is null or char_length(location) <= 200),
  description text check (description is null or char_length(description) <= 1000),
  visibility public.box_visibility not null default 'private',
  cover_object_key text,
  cover_mime_type text,
  cover_size_bytes bigint check (cover_size_bytes is null or cover_size_bytes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.boxes(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text check (category is null or char_length(category) <= 80),
  quantity integer not null default 1 check (quantity > 0),
  description text check (description is null or char_length(description) <= 1000),
  image_object_key text,
  image_mime_type text,
  image_size_bytes bigint check (image_size_bytes is null or image_size_bytes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  box_id uuid references public.boxes(id) on delete set null,
  action public.audit_action not null,
  entity_type public.audit_entity not null,
  entity_id uuid not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.media_uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  box_id uuid not null references public.boxes(id) on delete cascade,
  item_id uuid references public.items(id) on delete cascade,
  media_kind public.media_kind not null,
  object_key text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  status public.media_upload_status not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  check ((media_kind = 'cover' and item_id is null) or (media_kind = 'item' and item_id is not null))
);

create table public.media_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  object_key text not null unique,
  attempts integer not null default 0,
  status public.cleanup_status not null default 'pending',
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index boxes_owner_id_idx on public.boxes(owner_id);
create index boxes_space_id_idx on public.boxes(space_id);
create index items_box_id_idx on public.items(box_id);
create index media_uploads_expiry_idx on public.media_uploads(status, expires_at);
create index cleanup_jobs_due_idx on public.media_cleanup_jobs(status, next_attempt_at);
```

- [ ] **Step 4: 重置数据库并验证**

Run: `npx supabase db reset && npm run test:db`

Expected: 9 assertions PASS。

- [ ] **Step 5: 提交**

```bash
git add supabase/migrations/202607290001_core_schema.sql supabase/tests/database/001_core_schema.test.sql
git commit -m "feat: add core storage schema"
```

## Task 3: 实现 RLS、审计 Trigger 与全局搜索 RPC

**Files:**
- Create: `supabase/migrations/202607290002_security_and_search.sql`
- Create: `supabase/tests/database/002_rls.test.sql`
- Create: `supabase/tests/database/003_search.test.sql`

- [ ] **Step 1: 写公开、私有和箱主权限测试**

```sql
-- supabase/tests/database/002_rls.test.sql
begin;
select plan(4);
create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('owner');
select tests.create_supabase_user('other');

select tests.authenticate_as('owner');
insert into public.spaces(id, owner_id, name)
values ('10000000-0000-0000-0000-000000000001', auth.uid(), '家');
insert into public.boxes(id, owner_id, space_id, name, visibility)
values
('20000000-0000-0000-0000-000000000001', auth.uid(), '10000000-0000-0000-0000-000000000001', '公开箱', 'public'),
('20000000-0000-0000-0000-000000000002', auth.uid(), '10000000-0000-0000-0000-000000000001', '私有箱', 'private');

select tests.clear_authentication();
select results_eq('select name from public.boxes order by name', $$values ('公开箱'::text)$$, 'anon reads public only');

select tests.authenticate_as('other');
select is_empty($$update public.boxes set name = '越权' where id = '20000000-0000-0000-0000-000000000001' returning id$$, 'other cannot edit public box');
select is_empty($$select id from public.boxes where id = '20000000-0000-0000-0000-000000000002'$$, 'other cannot read private box');

select tests.authenticate_as('owner');
select results_eq($$select count(*)::int from public.boxes$$, $$values (2)$$, 'owner reads both boxes');
select * from finish();
rollback;
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:db`

Expected: FAIL，因为尚未启用 RLS 或创建 policy。

- [ ] **Step 3: 实现 RLS、更新时间和审计函数**

```sql
-- supabase/migrations/202607290002_security_and_search.sql
create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger spaces_updated_at before update on public.spaces for each row execute function public.set_updated_at();
create trigger boxes_updated_at before update on public.boxes for each row execute function public.set_updated_at();
create trigger items_updated_at before update on public.items for each row execute function public.set_updated_at();

alter table public.spaces enable row level security;
alter table public.boxes enable row level security;
alter table public.items enable row level security;
alter table public.activity_logs enable row level security;
alter table public.media_uploads enable row level security;
alter table public.media_cleanup_jobs enable row level security;

create policy spaces_owner_all on public.spaces for all to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy boxes_read on public.boxes for select to anon, authenticated
using (visibility = 'public' or owner_id = auth.uid());
create policy boxes_owner_insert on public.boxes for insert to authenticated
with check (
  owner_id = auth.uid()
  and exists (select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid())
);
create policy boxes_owner_update on public.boxes for update to authenticated
using (owner_id = auth.uid()) with check (
  owner_id = auth.uid()
  and exists (select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid())
);
create policy boxes_owner_delete on public.boxes for delete to authenticated using (owner_id = auth.uid());

create policy items_read on public.items for select to anon, authenticated
using (exists (
  select 1 from public.boxes b
  where b.id = box_id and (b.visibility = 'public' or b.owner_id = auth.uid())
));
create policy items_owner_insert on public.items for insert to authenticated
with check (exists (select 1 from public.boxes b where b.id = box_id and b.owner_id = auth.uid()));
create policy items_owner_update on public.items for update to authenticated
using (exists (select 1 from public.boxes b where b.id = box_id and b.owner_id = auth.uid()))
with check (exists (select 1 from public.boxes b where b.id = box_id and b.owner_id = auth.uid()));
create policy items_owner_delete on public.items for delete to authenticated
using (exists (select 1 from public.boxes b where b.id = box_id and b.owner_id = auth.uid()));

create policy logs_owner_read on public.activity_logs for select to authenticated
using (exists (select 1 from public.boxes b where b.id = box_id and b.owner_id = auth.uid()));

create function public.audit_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.activity_logs(actor_id, box_id, action, entity_type, entity_id, snapshot)
  values (
    auth.uid(),
    case when tg_table_name = 'boxes' then (row_data->>'id')::uuid else nullif(row_data->>'box_id', '')::uuid end,
    lower(tg_op)::public.audit_action,
    rtrim(tg_table_name, 's')::public.audit_entity,
    (row_data->>'id')::uuid,
    row_data - 'cover_object_key' - 'image_object_key'
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_boxes after insert or update or delete on public.boxes for each row execute function public.audit_change();
create trigger audit_items after insert or update or delete on public.items for each row execute function public.audit_change();
create trigger audit_spaces after insert or update or delete on public.spaces for each row execute function public.audit_change();
```

- [ ] **Step 4: 先写全局搜索 RPC 测试**

```sql
-- supabase/tests/database/003_search.test.sql
begin;
select plan(2);
select has_function('public', 'search_my_items', array['text'], 'search RPC exists');
select function_returns('public', 'search_my_items', array['text'], 'setof record', 'search returns rows');
select * from finish();
rollback;
```

- [ ] **Step 5: 实现只搜索本人数据的 RPC**

将以下内容追加到 `202607290002_security_and_search.sql`：

```sql
create function public.search_my_items(query text)
returns table (
  item_id uuid, item_name text, quantity integer, box_id uuid,
  box_public_id uuid, box_name text, space_name text, location text
)
language sql stable security invoker set search_path = public as $$
  select i.id, i.name, i.quantity, b.id, b.public_id, b.name, s.name, b.location
  from public.items i
  join public.boxes b on b.id = i.box_id
  join public.spaces s on s.id = b.space_id
  where b.owner_id = auth.uid()
    and length(btrim(query)) >= 1
    and concat_ws(' ', i.name, i.category, i.description) ilike '%' || btrim(query) || '%'
  order by i.updated_at desc, i.name
  limit 100;
$$;
grant execute on function public.search_my_items(text) to authenticated;
```

- [ ] **Step 6: 验证权限与搜索**

Run: `npx supabase db reset && npm run test:db`

Expected: 所有 pgTAP 测试 PASS。

- [ ] **Step 7: 提交**

```bash
git add supabase/migrations/202607290002_security_and_search.sql supabase/tests/database
git commit -m "feat: enforce ownership and add item search"
```

## Task 4: 实现 R2 SigV4、上传会话与签名下载 RPC

**Files:**
- Create: `supabase/migrations/202607290003_r2_media_rpc.sql`
- Create: `supabase/tests/database/004_r2_signing.test.sql`
- Create: `supabase/tests/database/005_media_rpc.test.sql`
- Create: `docs/runbooks/r2.md`

- [ ] **Step 1: 写确定性 SigV4 测试**

```sql
-- supabase/tests/database/004_r2_signing.test.sql
begin;
select plan(2);
select is(
  public.aws_uri_encode('users/a box/image.webp', false),
  'users/a%20box/image.webp',
  'object path encoding preserves slash'
);
select like(
  public.r2_presigned_url_for_test(
    'GET', 'bucket', 'account', 'AKID', 'SECRET', 'users/u/file.webp',
    '20260729T120000Z'::text, 300
  ),
  'https://account.r2.cloudflarestorage.com/bucket/users/u/file.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256&%',
  'signer creates an R2 S3 presigned URL'
);
select * from finish();
rollback;
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:db`

Expected: FAIL，签名辅助函数不存在。

- [ ] **Step 3: 实现 URI 编码和 SigV4 辅助函数**

在 `202607290003_r2_media_rpc.sql` 中实现：

```sql
create schema if not exists private;

create function public.aws_uri_encode(value text, encode_slash boolean default true)
returns text language plpgsql immutable strict as $$
declare bytes bytea := convert_to(value, 'UTF8'); result text := ''; i int; b int; c text;
begin
  for i in 0..length(bytes)-1 loop
    b := get_byte(bytes, i); c := chr(b);
    if (b between 65 and 90) or (b between 97 and 122) or (b between 48 and 57) or c in ('-', '_', '.', '~') then
      result := result || c;
    elsif c = '/' and not encode_slash then
      result := result || '/';
    else
      result := result || '%' || upper(lpad(to_hex(b), 2, '0'));
    end if;
  end loop;
  return result;
end;
$$;

create function public.hmac_sha256(key bytea, value text)
returns bytea language sql immutable strict as $$
  select extensions.hmac(convert_to(value, 'UTF8'), key, 'sha256');
$$;

create function public.r2_presigned_url_for_test(
  method text, bucket text, account_id text, access_key text, secret_key text,
  object_key text, amz_datetime text, expires_seconds integer
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  date_stamp text := left(amz_datetime, 8);
  host text := account_id || '.r2.cloudflarestorage.com';
  canonical_uri text := '/' || public.aws_uri_encode(bucket || '/' || object_key, false);
  scope text := date_stamp || '/auto/s3/aws4_request';
  credential text := access_key || '/' || scope;
  canonical_query text;
  canonical_request text;
  string_to_sign text;
  signing_key bytea;
  signature text;
begin
  canonical_query :=
    'X-Amz-Algorithm=AWS4-HMAC-SHA256' ||
    '&X-Amz-Credential=' || public.aws_uri_encode(credential) ||
    '&X-Amz-Date=' || amz_datetime ||
    '&X-Amz-Expires=' || expires_seconds::text ||
    '&X-Amz-SignedHeaders=host';
  canonical_request := upper(method) || E'\n' || canonical_uri || E'\n' || canonical_query ||
    E'\n' || 'host:' || host || E'\n\n' || 'host' || E'\nUNSIGNED-PAYLOAD';
  string_to_sign := 'AWS4-HMAC-SHA256' || E'\n' || amz_datetime || E'\n' || scope || E'\n' ||
    encode(extensions.digest(canonical_request, 'sha256'), 'hex');
  signing_key := public.hmac_sha256(
    public.hmac_sha256(
      public.hmac_sha256(
        public.hmac_sha256(convert_to('AWS4' || secret_key, 'UTF8'), date_stamp),
        'auto'
      ),
      's3'
    ),
    'aws4_request'
  );
  signature := encode(public.hmac_sha256(signing_key, string_to_sign), 'hex');
  return 'https://' || host || canonical_uri || '?' || canonical_query || '&X-Amz-Signature=' || signature;
end;
$$;
revoke all on function public.r2_presigned_url_for_test(text,text,text,text,text,text,text,integer) from public;
```

- [ ] **Step 4: 写上传会话越权测试**

```sql
-- supabase/tests/database/005_media_rpc.test.sql
begin;
select plan(3);
create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('owner');
select tests.create_supabase_user('other');
select tests.authenticate_as('owner');
insert into public.spaces(id, owner_id, name)
values ('10000000-0000-0000-0000-000000000001', auth.uid(), '家');
insert into public.boxes(id, owner_id, space_id, name, visibility)
values ('20000000-0000-0000-0000-000000000001', auth.uid(), '10000000-0000-0000-0000-000000000001', '媒体箱', 'private');
select lives_ok(
  $$select public.create_media_upload('20000000-0000-0000-0000-000000000001', null, 'cover', 'image/webp', 1024)$$,
  'owner can create cover upload'
);
select tests.authenticate_as('other');
select throws_ok(
  $$select public.create_media_upload('20000000-0000-0000-0000-000000000001', null, 'cover', 'image/webp', 1024)$$,
  '42501', null, 'other user cannot sign upload'
);
select tests.clear_authentication();
select throws_ok(
  $$select public.create_media_download('private-object-key')$$,
  '42501', null, 'anon cannot sign arbitrary private download'
);
select * from finish();
rollback;
```

- [ ] **Step 5: 实现 Vault 读取、上传和下载 RPC**

```sql
create function private.vault_secret(secret_name text) returns text
language sql stable security definer set search_path = vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1;
$$;

create function private.r2_presigned_url(method text, object_key text, expires_seconds integer default 300)
returns text language plpgsql security definer set search_path = public, private as $$
declare now_utc timestamptz := clock_timestamp();
begin
  return public.r2_presigned_url_for_test(
    method,
    private.vault_secret('r2_bucket_name'),
    private.vault_secret('r2_account_id'),
    private.vault_secret('r2_access_key_id'),
    private.vault_secret('r2_secret_access_key'),
    object_key,
    to_char(now_utc at time zone 'UTC', 'YYYYMMDD"T"HH24MISS"Z"'),
    expires_seconds
  );
end;
$$;

create function public.create_media_upload(
  p_box_id uuid, p_item_id uuid, p_media_kind public.media_kind,
  p_mime_type text, p_size_bytes bigint
) returns table(upload_id uuid, object_key text, upload_url text)
language plpgsql security definer set search_path = public, private as $$
declare
  caller uuid := auth.uid();
  new_upload_id uuid := gen_random_uuid();
  extension text;
  new_key text;
begin
  if caller is null then raise insufficient_privilege; end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') or p_size_bytes not between 1 and 5242880 then
    raise exception 'invalid media metadata' using errcode = '22023';
  end if;
  if not exists (select 1 from public.boxes b where b.id = p_box_id and b.owner_id = caller) then
    raise insufficient_privilege;
  end if;
  if (p_media_kind = 'cover' and p_item_id is not null)
     or (p_media_kind = 'item' and not exists (
       select 1 from public.items i where i.id = p_item_id and i.box_id = p_box_id
     )) then
    raise exception 'invalid media target' using errcode = '22023';
  end if;
  extension := case p_mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else 'webp' end;
  new_key := 'users/' || caller || '/boxes/' || p_box_id || '/' || p_media_kind || '/' || gen_random_uuid() || '.' || extension;
  insert into public.media_uploads(
    id, owner_id, box_id, item_id, media_kind, object_key, mime_type, size_bytes, expires_at
  ) values (
    new_upload_id, caller, p_box_id, p_item_id, p_media_kind, new_key, p_mime_type, p_size_bytes, now() + interval '5 minutes'
  );
  return query select new_upload_id, new_key, private.r2_presigned_url('PUT', new_key, 300);
end;
$$;

create function public.confirm_media_upload(p_upload_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare session public.media_uploads%rowtype;
begin
  select * into session from public.media_uploads
  where id = p_upload_id for update;
  if not found or session.owner_id is distinct from auth.uid() then raise insufficient_privilege; end if;
  if session.status <> 'pending' or session.expires_at <= now() then
    raise exception 'upload session expired' using errcode = '22023';
  end if;
  if session.media_kind = 'cover' then
    update public.boxes set
      cover_object_key = session.object_key,
      cover_mime_type = session.mime_type,
      cover_size_bytes = session.size_bytes
    where id = session.box_id and owner_id = auth.uid();
  else
    update public.items set
      image_object_key = session.object_key,
      image_mime_type = session.mime_type,
      image_size_bytes = session.size_bytes
    where id = session.item_id and exists (
      select 1 from public.boxes b where b.id = public.items.box_id and b.owner_id = auth.uid()
    );
  end if;
  if not found then raise insufficient_privilege; end if;
  update public.media_uploads set status = 'confirmed', confirmed_at = now() where id = session.id;
end;
$$;

create function public.create_media_download(p_object_key text)
returns table(download_url text, expires_at timestamptz)
language plpgsql security definer set search_path = public, private as $$
declare media_owner uuid; media_visibility public.box_visibility;
begin
  select owner_id, visibility into media_owner, media_visibility from (
    select b.owner_id, b.visibility from public.boxes b where b.cover_object_key = p_object_key
    union all
    select b.owner_id, b.visibility from public.items i join public.boxes b on b.id = i.box_id
      where i.image_object_key = p_object_key
  ) media limit 1;
  if not found or (media_visibility = 'private' and media_owner is distinct from auth.uid()) then
    raise insufficient_privilege;
  end if;
  return query select private.r2_presigned_url('GET', p_object_key, 300), now() + interval '5 minutes';
end;
$$;

revoke all on function public.create_media_upload(uuid,uuid,public.media_kind,text,bigint) from public;
revoke all on function public.confirm_media_upload(uuid) from public;
revoke all on function public.create_media_download(text) from public;
grant execute on function public.create_media_upload(uuid,uuid,public.media_kind,text,bigint) to authenticated;
grant execute on function public.confirm_media_upload(uuid) to authenticated;
grant execute on function public.create_media_download(text) to anon, authenticated;
```

Vault 中严格使用以下 secret 名称：`r2_account_id`、`r2_bucket_name`、`r2_access_key_id`、`r2_secret_access_key`。前端 RPC 参数必须使用 `p_box_id`、`p_item_id`、`p_media_kind`、`p_mime_type`、`p_size_bytes`、`p_upload_id` 和 `p_object_key`。

- [ ] **Step 6: 写 R2 配置 runbook**

```md
# Cloudflare R2 配置

1. 分别创建私有 Bucket：`nomo-dev`、`nomo-staging`、`nomo-production`。
2. 创建仅允许该 Bucket Object Read & Write 的 R2 API Token。
3. 在 Supabase Vault 创建 `r2_account_id`、`r2_bucket_name`、`r2_access_key_id`、`r2_secret_access_key`。
4. CORS 只允许应用 Origin，methods 为 GET、HEAD、PUT，allowedHeaders 包含 Content-Type。
5. 测试环境使用独立 Bucket 和独立 Token；禁止复用生产凭证。
```

- [ ] **Step 7: 验证签名与权限**

Run: `npx supabase db reset && npm run test:db`

Expected: URI 编码、签名形状和越权测试全部 PASS。

- [ ] **Step 8: 对测试 R2 做真实 PUT/GET 集成验证**

Run: `npm run test:r2 --workspace @nomo/web`

Expected: 测试文件可 PUT、GET，过期或篡改 URL 返回 403；测试结束删除对象。

- [ ] **Step 9: 提交**

```bash
git add supabase/migrations/202607290003_r2_media_rpc.sql supabase/tests/database docs/runbooks/r2.md apps/web
git commit -m "feat: add secure R2 media sessions"
```

## Task 5: 实现媒体清理 Trigger 与定时重试

**Files:**
- Create: `supabase/migrations/202607290004_media_cleanup.sql`
- Create: `supabase/tests/database/006_media_cleanup.test.sql`

- [ ] **Step 1: 写替换、删除和过期会话测试**

```sql
-- supabase/tests/database/006_media_cleanup.test.sql
begin;
select plan(3);
create extension if not exists "basejump-supabase_test_helpers" with schema tests;
select tests.create_supabase_user('owner');
select tests.authenticate_as('owner');
insert into public.spaces(id, owner_id, name)
values ('10000000-0000-0000-0000-000000000001', auth.uid(), '家');
insert into public.boxes(id, owner_id, space_id, name)
values ('20000000-0000-0000-0000-000000000001', auth.uid(), '10000000-0000-0000-0000-000000000001', '媒体箱');
insert into public.items(id, box_id, name, image_object_key)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '相机', 'users/u/boxes/b/item/old.webp');
insert into public.media_uploads(
  id, owner_id, box_id, media_kind, object_key, mime_type, size_bytes, expires_at
) values (
  '40000000-0000-0000-0000-000000000001', auth.uid(),
  '20000000-0000-0000-0000-000000000001', 'cover',
  'users/u/boxes/b/cover/orphan.webp', 'image/webp', 1024, now() - interval '1 minute'
);
update public.items set image_object_key = 'users/u/boxes/b/item/new.webp'
where id = '30000000-0000-0000-0000-000000000001';
select results_eq(
  $$select object_key from public.media_cleanup_jobs where object_key = 'users/u/boxes/b/item/old.webp'$$,
  $$values ('users/u/boxes/b/item/old.webp'::text)$$,
  'replaced image is queued'
);
select lives_ok($$select public.expire_media_uploads(now())$$, 'expired sessions are processed');
select results_eq(
  $$select status::text from public.media_uploads where id = '40000000-0000-0000-0000-000000000001'$$,
  $$values ('expired'::text)$$,
  'pending session becomes expired'
);
select * from finish();
rollback;
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:db`

Expected: FAIL，清理 Trigger 与过期函数不存在。

- [ ] **Step 3: 实现清理队列与 cron**

```sql
-- supabase/migrations/202607290004_media_cleanup.sql
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create function public.enqueue_removed_media() returns trigger
language plpgsql security definer set search_path = public as $$
declare old_key text; new_key text;
begin
  if tg_table_name = 'boxes' then
    old_key := old.cover_object_key;
    new_key := case when tg_op = 'DELETE' then null else new.cover_object_key end;
  elsif tg_table_name = 'items' then
    old_key := old.image_object_key;
    new_key := case when tg_op = 'DELETE' then null else new.image_object_key end;
  else
    old_key := old.object_key;
    new_key := null;
  end if;
  if old_key is not null and old_key is distinct from new_key then
    insert into public.media_cleanup_jobs(object_key) values (old_key) on conflict (object_key) do nothing;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger boxes_media_replaced after update of cover_object_key on public.boxes
for each row execute function public.enqueue_removed_media();
create trigger boxes_media_deleted after delete on public.boxes
for each row execute function public.enqueue_removed_media();
create trigger items_media_replaced after update of image_object_key on public.items
for each row execute function public.enqueue_removed_media();
create trigger items_media_deleted after delete on public.items
for each row execute function public.enqueue_removed_media();
create trigger pending_upload_cleanup after delete on public.media_uploads
for each row when (old.status = 'pending') execute function public.enqueue_removed_media();

create function public.expire_media_uploads(cutoff timestamptz default now()) returns integer
language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  with expired as (
    update public.media_uploads set status = 'expired'
    where status = 'pending' and expires_at <= cutoff
    returning object_key
  )
  insert into public.media_cleanup_jobs(object_key)
  select object_key from expired on conflict (object_key) do nothing;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

select cron.schedule('expire-media-uploads', '*/10 * * * *', $$select public.expire_media_uploads(now())$$);
```

追加以下处理函数。`private.r2_presigned_url('DELETE', object_key, 300)` 使用 Task 4 已实现的 Vault 生产签名 helper：

```sql
alter table public.media_cleanup_jobs add column request_id bigint unique;

create function public.process_media_cleanup_jobs(batch_size integer default 25) returns integer
language plpgsql security definer set search_path = public, extensions, net, private as $$
declare job record; submitted integer := 0; request bigint;
begin
  for job in
    select id, object_key from public.media_cleanup_jobs
    where status in ('pending', 'processing') and request_id is null and next_attempt_at <= now()
    order by created_at for update skip locked limit batch_size
  loop
    request := net.http_delete(url := private.r2_presigned_url('DELETE', job.object_key, 300));
    update public.media_cleanup_jobs
      set status = 'processing', request_id = request, updated_at = now()
      where id = job.id;
    submitted := submitted + 1;
  end loop;
  return submitted;
end;
$$;

create function public.collect_media_cleanup_results() returns integer
language plpgsql security definer set search_path = public, net as $$
declare job record; handled integer := 0; next_attempts integer;
begin
  for job in
    select j.id, j.attempts, r.status_code, r.error_msg
    from public.media_cleanup_jobs j
    join net._http_response r on r.id = j.request_id
    where j.status = 'processing'
    for update of j skip locked
  loop
    if job.status_code between 200 and 299 or job.status_code = 404 then
      update public.media_cleanup_jobs
        set status = 'completed', request_id = null, last_error = null, updated_at = now()
        where id = job.id;
    else
      next_attempts := job.attempts + 1;
      update public.media_cleanup_jobs set
        attempts = next_attempts,
        status = case when next_attempts >= 5 then 'failed'::public.cleanup_status else 'pending'::public.cleanup_status end,
        request_id = null,
        next_attempt_at = now() + make_interval(secs => least(3600, 30 * power(2, next_attempts)::integer)),
        last_error = left(coalesce(job.error_msg, 'HTTP ' || job.status_code::text), 500),
        updated_at = now()
      where id = job.id;
    end if;
    handled := handled + 1;
  end loop;
  return handled;
end;
$$;

select cron.schedule('submit-media-cleanup', '* * * * *', $$select public.process_media_cleanup_jobs(25)$$);
select cron.schedule('collect-media-cleanup', '*/5 * * * *', $$select public.collect_media_cleanup_results()$$);
```

- [ ] **Step 4: 验证清理行为**

Run: `npx supabase db reset && npm run test:db`

Expected: 替换媒体、过期上传和重试状态测试 PASS。

- [ ] **Step 5: 提交**

```bash
git add supabase/migrations/202607290004_media_cleanup.sql supabase/tests/database/006_media_cleanup.test.sql
git commit -m "feat: clean expired R2 media"
```

## Task 6: 建立前端环境、类型化 Supabase 客户端与应用路由

**Files:**
- Create: `apps/web/src/lib/env.ts`
- Create: `apps/web/src/lib/supabase.ts`
- Create: `apps/web/src/lib/database.types.ts`（CLI 生成）
- Create: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/app/providers.tsx`
- Create: `apps/web/src/app/RequireAuth.tsx`
- Create: `apps/web/src/app/RequireAuth.test.tsx`
- Create: `apps/web/.env.example`

- [ ] **Step 1: 写认证守卫失败测试**

```tsx
// apps/web/src/app/RequireAuth.test.tsx
it('redirects an anonymous user to login and preserves the target', async () => {
  renderAppAt('/app/boxes', { session: null })
  expect(await screen.findByRole('heading', { name: '登录' })).toBeInTheDocument()
  expect(screen.getByTestId('return-to')).toHaveTextContent('/app/boxes')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test --workspace @nomo/web -- RequireAuth --run`

Expected: FAIL，守卫与测试渲染工具不存在。

- [ ] **Step 3: 实现环境解析和客户端**

```ts
// apps/web/src/lib/env.ts
import { z } from 'zod'

export const env = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_PUBLIC_APP_ORIGIN: z.string().url(),
}).parse(import.meta.env)
```

```ts
// apps/web/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { env } from './env'
import type { Database } from './database.types'

export const supabase = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
```

```dotenv
# apps/web/.env.example
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=replace-with-local-anon-key
VITE_PUBLIC_APP_ORIGIN=http://localhost:5173
```

- [ ] **Step 4: 生成数据库类型并实现 Router/Provider/守卫**

Run: `npx supabase gen types typescript --local > apps/web/src/lib/database.types.ts`

Router 必须声明 `/login`、`/register`、`/forgot-password`、`/reset-password`、`/b/:publicId` 和 `/app/*`；`/app/*` 包裹 `RequireAuth`。Provider 顺序为 QueryClient → AuthProvider → RouterProvider。

- [ ] **Step 5: 验证**

Run:

```bash
npm test --workspace @nomo/web -- RequireAuth --run
npm run typecheck
```

Expected: 守卫测试 PASS，数据库查询具有生成类型。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src apps/web/.env.example
git commit -m "feat: add typed app routing"
```

## Task 7: 实现邮箱密码认证流程

**Files:**
- Create: `apps/web/src/features/auth/AuthProvider.tsx`
- Create: `apps/web/src/features/auth/auth.schemas.ts`
- Create: `apps/web/src/features/auth/LoginPage.tsx`
- Create: `apps/web/src/features/auth/RegisterPage.tsx`
- Create: `apps/web/src/features/auth/ForgotPasswordPage.tsx`
- Create: `apps/web/src/features/auth/ResetPasswordPage.tsx`
- Create: `apps/web/src/features/auth/LoginPage.test.tsx`

- [ ] **Step 1: 写登录成功和失败测试**

```tsx
it('signs in and returns to the requested page', async () => {
  const user = userEvent.setup()
  renderLogin({ returnTo: '/app/boxes' })
  await user.type(screen.getByLabelText('邮箱'), 'user@example.com')
  await user.type(screen.getByLabelText('密码'), 'correct-password')
  await user.click(screen.getByRole('button', { name: '登录' }))
  expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'correct-password' })
  expect(mockNavigate).toHaveBeenCalledWith('/app/boxes', { replace: true })
})

it('shows a Chinese error without leaking the raw auth error', async () => {
  mockSignInWithPassword.mockResolvedValue({ data: { session: null }, error: new Error('Invalid login credentials') })
  renderLogin()
  await submitValidCredentials()
  expect(await screen.findByRole('alert')).toHaveTextContent('邮箱或密码不正确')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test --workspace @nomo/web -- LoginPage --run`

Expected: FAIL，认证页面不存在。

- [ ] **Step 3: 实现 Zod schema 与四个页面**

```ts
// apps/web/src/features/auth/auth.schemas.ts
import { z } from 'zod'

export const credentialsSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(8, '密码至少 8 位'),
})
```

登录调用 `signInWithPassword`；注册调用 `signUp`；忘记密码调用 `resetPasswordForEmail` 并设置 `${origin}/reset-password`；重置页处理 recovery session 后调用 `updateUser({ password })`。所有页面共享错误映射和提交中禁用状态。

- [ ] **Step 4: 验证认证组件**

Run: `npm test --workspace @nomo/web -- auth --run && npm run typecheck`

Expected: 登录、注册和重置流程测试 PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/features/auth apps/web/src/app
git commit -m "feat: add email password authentication"
```

## Task 8: 实现响应式应用壳与空间管理

**Files:**
- Create: `apps/web/src/app/AppShell.tsx`
- Create: `apps/web/src/components/ConfirmDialog.tsx`
- Create: `apps/web/src/features/spaces/spaces.api.ts`
- Create: `apps/web/src/features/spaces/space.schema.ts`
- Create: `apps/web/src/features/spaces/SpacesPage.tsx`
- Create: `apps/web/src/features/spaces/SpacesPage.test.tsx`

- [ ] **Step 1: 写空间创建和非空删除测试**

```tsx
it('creates a space and refreshes the list', async () => {
  renderSpaces()
  await userEvent.type(screen.getByLabelText('空间名称'), '家')
  await userEvent.click(screen.getByRole('button', { name: '创建空间' }))
  expect(mockInsertSpace).toHaveBeenCalledWith({ name: '家', description: null })
  expect(await screen.findByText('家')).toBeInTheDocument()
})

it('explains why a non-empty space cannot be deleted', async () => {
  renderSpaces({ spaces: [{ id: 's1', name: '家', box_count: 2 }] })
  await userEvent.click(screen.getByRole('button', { name: '删除家' }))
  expect(screen.getByRole('alert')).toHaveTextContent('请先移动或删除其中的 2 个箱子')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test --workspace @nomo/web -- SpacesPage --run`

Expected: FAIL，空间功能不存在。

- [ ] **Step 3: 实现应用壳和空间 CRUD**

AppShell 在小屏显示“箱子、搜索、空间、我的”底部导航，在 `md` 及以上显示侧栏；主内容底部留出安全区。空间 schema：

```ts
export const spaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
})
```

TanStack Query key 统一为 `['spaces']`；mutation 成功后失效该 key。删除按钮只对 `box_count = 0` 启用，仍由数据库外键作为最终防线。

- [ ] **Step 4: 验证**

Run: `npm test --workspace @nomo/web -- SpacesPage --run && npm run typecheck`

Expected: 两个空间行为测试 PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/app apps/web/src/components apps/web/src/features/spaces
git commit -m "feat: manage storage spaces"
```

## Task 9: 实现箱子 CRUD、稳定二维码与 PNG 下载

**Files:**
- Create: `apps/web/src/features/boxes/boxes.api.ts`
- Create: `apps/web/src/features/boxes/box.schema.ts`
- Create: `apps/web/src/features/boxes/BoxesPage.tsx`
- Create: `apps/web/src/features/boxes/BoxFormPage.tsx`
- Create: `apps/web/src/features/qr-print/qr.ts`
- Create: `apps/web/src/features/qr-print/qr.test.ts`
- Create: `apps/web/src/features/boxes/BoxFormPage.test.tsx`

- [ ] **Step 1: 写稳定 URL 与表单测试**

```ts
it('builds a stable public QR URL', () => {
  expect(boxQrUrl('https://nomo.example', '123e4567-e89b-12d3-a456-426614174000'))
    .toBe('https://nomo.example/b/123e4567-e89b-12d3-a456-426614174000')
})
```

```tsx
it('creates a private box inside the chosen space by default', async () => {
  renderBoxForm()
  await fillBoxForm({ name: '冬季衣物', space: '家', location: '卧室衣柜上层' })
  await userEvent.click(screen.getByRole('button', { name: '创建箱子' }))
  expect(mockCreateBox).toHaveBeenCalledWith(expect.objectContaining({
    name: '冬季衣物', space_id: 'space-home', visibility: 'private'
  }))
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test --workspace @nomo/web -- qr BoxFormPage --run`

Expected: FAIL，QR helper 与箱子表单不存在。

- [ ] **Step 3: 实现箱子列表、表单和二维码**

```ts
// apps/web/src/features/qr-print/qr.ts
import QRCode from 'qrcode'

export const boxQrUrl = (origin: string, publicId: string) =>
  `${origin.replace(/\/$/, '')}/b/${publicId}`

export const boxQrPng = (url: string) => QRCode.toDataURL(url, {
  errorCorrectionLevel: 'M', margin: 2, width: 1024,
})
```

箱子表单字段为 `space_id`、`name`、`category`、`location`、`description`、`visibility`。创建成功后进入箱子详情并显示 `box_code`、QR 预览和 PNG 下载。重新生成只再次调用 `boxQrPng`，不能更新 `public_id`。

- [ ] **Step 4: 验证**

Run: `npm test --workspace @nomo/web -- qr BoxFormPage --run && npm run typecheck`

Expected: 稳定 URL、默认私有与表单测试 PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/features/boxes apps/web/src/features/qr-print
git commit -m "feat: manage boxes and generate QR codes"
```

## Task 10: 实现公开箱页面与物品 CRUD

**Files:**
- Create: `apps/web/src/features/boxes/PublicBoxPage.tsx`
- Create: `apps/web/src/features/boxes/BoxDetailPage.tsx`
- Create: `apps/web/src/features/items/items.api.ts`
- Create: `apps/web/src/features/items/item.schema.ts`
- Create: `apps/web/src/features/items/ItemForm.tsx`
- Create: `apps/web/src/features/boxes/PublicBoxPage.test.tsx`
- Create: `apps/web/src/features/items/ItemForm.test.tsx`

- [ ] **Step 1: 写匿名公开、私有和物品数量测试**

```tsx
it('renders a public box for an anonymous visitor without edit controls', async () => {
  renderPublicBox({ session: null, visibility: 'public' })
  expect(await screen.findByRole('heading', { name: '冬季衣物' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '新增物品' })).not.toBeInTheDocument()
  expect(screen.getByText('共 7 件 · 3 种物品')).toBeInTheDocument()
})

it('shows a neutral gate for a private box', async () => {
  renderPublicBox({ session: null, queryError: 'PGRST116' })
  expect(await screen.findByRole('heading', { name: '无权限或内容不存在' })).toBeInTheDocument()
})

it('rejects zero quantity before submit', async () => {
  renderItemForm()
  await userEvent.clear(screen.getByLabelText('数量'))
  await userEvent.type(screen.getByLabelText('数量'), '0')
  await userEvent.click(screen.getByRole('button', { name: '保存' }))
  expect(screen.getByText('数量必须大于 0')).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test --workspace @nomo/web -- PublicBoxPage ItemForm --run`

Expected: FAIL，页面和表单不存在。

- [ ] **Step 3: 实现箱子详情查询与物品 CRUD**

公开详情按 `public_id` 查询箱子、空间和物品。总数量使用 `items.reduce((sum, item) => sum + item.quantity, 0)`，种类数使用 `items.length`。只有会话用户 ID 等于箱子 `owner_id` 时渲染新增、修改和删除控件。

```ts
export const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(80).optional(),
  quantity: z.coerce.number().int('数量必须是整数').positive('数量必须大于 0'),
  description: z.string().trim().max(1000).optional(),
})
```

删除使用 `ConfirmDialog`，成功后失效 `['box', publicId]` 和 `['items', boxId]`。

- [ ] **Step 4: 验证**

Run: `npm test --workspace @nomo/web -- PublicBoxPage ItemForm --run && npm run typecheck`

Expected: 三个核心行为测试 PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/features/boxes apps/web/src/features/items
git commit -m "feat: add public box and item management"
```

## Task 11: 接入图片压缩、R2 上传会话与授权下载

**Files:**
- Create: `apps/web/src/features/media/media.api.ts`
- Create: `apps/web/src/features/media/useMediaUpload.ts`
- Create: `apps/web/src/features/media/AuthorizedImage.tsx`
- Create: `apps/web/src/features/media/useMediaUpload.test.tsx`
- Modify: `apps/web/src/features/boxes/BoxFormPage.tsx`
- Modify: `apps/web/src/features/items/ItemForm.tsx`

- [ ] **Step 1: 写三阶段上传测试**

```tsx
it('compresses, uploads, and confirms a media session in order', async () => {
  const { result } = renderHook(() => useMediaUpload())
  await act(() => result.current.upload({ file, boxId: 'b1', itemId: null, kind: 'cover' }))
  expect(mockCompress).toHaveBeenCalledBefore(mockCreateUpload)
  expect(mockCreateUpload).toHaveBeenCalledBefore(mockPutToR2)
  expect(mockPutToR2).toHaveBeenCalledBefore(mockConfirmUpload)
  expect(result.current.stage).toBe('complete')
})

it('does not confirm when R2 PUT fails', async () => {
  mockPutToR2.mockRejectedValue(new Error('network'))
  const { result } = renderHook(() => useMediaUpload())
  await expect(result.current.upload(input)).rejects.toThrow()
  expect(mockConfirmUpload).not.toHaveBeenCalled()
  expect(result.current.stage).toBe('error')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test --workspace @nomo/web -- useMediaUpload --run`

Expected: FAIL，媒体 hook 不存在。

- [ ] **Step 3: 实现媒体 API 与状态机**

`compress → create_media_upload RPC → fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': mimeType }, body }) → confirm_media_upload RPC`。阶段类型固定为：

```ts
export type UploadStage = 'idle' | 'compressing' | 'signing' | 'uploading' | 'confirming' | 'complete' | 'error'
```

`AuthorizedImage` 只接收 `objectKey`，通过 `create_media_download` RPC 获取短时 URL；Query staleTime 设为 4 分钟且不持久化。组件卸载或 URL 更新时释放本地 object URL，并将失败转换为图片占位状态。

- [ ] **Step 4: 接入箱子与物品表单**

选择文件时限制 `accept="image/jpeg,image/png,image/webp"`；显示压缩、上传和确认阶段；成功后刷新箱子数据。上传失败保留表单文字字段并显示“重试上传”。

- [ ] **Step 5: 验证**

Run: `npm test --workspace @nomo/web -- media --run && npm run typecheck`

Expected: 上传顺序、失败不确认和签名下载测试 PASS。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/features/media apps/web/src/features/boxes apps/web/src/features/items
git commit -m "feat: upload protected media to R2"
```

## Task 12: 实现全局搜索和单箱/批量 PDF

**Files:**
- Create: `apps/web/src/features/search/SearchPage.tsx`
- Create: `apps/web/src/features/search/SearchPage.test.tsx`
- Create: `apps/web/src/features/qr-print/pdf.ts`
- Create: `apps/web/src/features/qr-print/pdf.test.ts`
- Create: `apps/web/src/features/qr-print/PrintPage.tsx`
- Create: `apps/web/src/features/qr-print/PrintPage.test.tsx`

- [ ] **Step 1: 写搜索与 PDF 数据测试**

```tsx
it('shows where an item is stored', async () => {
  renderSearch({ results: [{ item_name: 'USB-C 充电器', quantity: 2, box_name: '电子设备箱', space_name: '办公室', location: '书房柜子' }] })
  await userEvent.type(screen.getByRole('searchbox'), '充电器')
  expect(await screen.findByText('USB-C 充电器 × 2')).toBeInTheDocument()
  expect(screen.getByText('办公室 · 电子设备箱 · 书房柜子')).toBeInTheDocument()
})
```

```ts
it('maps selected boxes to printable labels', () => {
  expect(buildLabels([box], 'https://nomo.example')).toEqual([{
    code: 'BX-00001', name: '冬季衣物', space: '家', location: '衣柜上层',
    qrUrl: `https://nomo.example/b/${box.public_id}`,
  }])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test --workspace @nomo/web -- SearchPage pdf PrintPage --run`

Expected: FAIL，搜索和打印功能不存在。

- [ ] **Step 3: 实现全局搜索**

输入去除首尾空白，少于 1 个字符不请求；使用 250ms debounce 调用 `search_my_items`；结果最多 100 条。Task 3 的 RPC 已返回 `box_public_id`。空状态区分“请输入关键词”和“没有找到物品”，点击结果跳转 `/b/${result.box_public_id}`。

- [ ] **Step 4: 实现 PDF**

`buildLabels` 生成纯数据，`renderLabelsPdf` 使用 jsPDF A4 页面、每页 2×4 标签；每个标签包含 QR、编号、名称、空间和位置。单箱详情调用相同函数传一个元素。PrintPage 至少选择一个箱子后才启用生成按钮，并以批次显示二维码渲染进度。

- [ ] **Step 5: 验证**

Run: `npm test --workspace @nomo/web -- SearchPage pdf PrintPage --run && npm run typecheck`

Expected: 搜索位置、标签数据、空选择和分页测试 PASS。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/features/search apps/web/src/features/qr-print supabase
git commit -m "feat: search items and print QR labels"
```

## Task 13: 完成 PWA、相机扫码与移动可访问性

**Files:**
- Modify: `apps/web/vite.config.ts`
- Create: `apps/web/src/features/scanner/ScannerPage.tsx`
- Create: `apps/web/src/features/scanner/ScannerPage.test.tsx`
- Create: `apps/web/public/pwa-192x192.png`
- Create: `apps/web/public/pwa-512x512.png`
- Create: `apps/web/public/maskable-512x512.png`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: 写扫码解析和权限拒绝测试**

```tsx
it('navigates only for a valid Nomo box URL', async () => {
  renderScanner()
  emitScan('https://nomo.example/b/123e4567-e89b-12d3-a456-426614174000')
  expect(mockNavigate).toHaveBeenCalledWith('/b/123e4567-e89b-12d3-a456-426614174000')
})

it('offers manual input when camera permission is denied', async () => {
  mockScannerStart.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
  renderScanner()
  expect(await screen.findByLabelText('手动输入二维码地址')).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test --workspace @nomo/web -- ScannerPage --run`

Expected: FAIL，扫描页面不存在。

- [ ] **Step 3: 实现扫描与 PWA 配置**

使用 `@zxing/browser` 启动后置摄像头，首次有效结果立即停止 scanner。只接受与 `VITE_PUBLIC_APP_ORIGIN` 同源且 pathname 匹配 `/b/{UUID}` 的地址。权限拒绝、无相机和非 HTTPS 分别显示中文提示及手动输入。

VitePWA 配置：

```ts
VitePWA({
  registerType: 'prompt',
  includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'maskable-512x512.png'],
  manifest: {
    name: 'Nomo 智能收纳', short_name: 'Nomo', display: 'standalone',
    theme_color: '#0f766e', background_color: '#ffffff',
    icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: { navigateFallback: '/index.html', runtimeCaching: [] },
})
```

- [ ] **Step 4: 验证移动布局和缓存边界**

Run:

```bash
npm test --workspace @nomo/web -- ScannerPage --run
npm run build
npx lighthouse http://localhost:4173 --only-categories=accessibility,pwa
```

Expected: 扫码测试 PASS；构建产物含 manifest/service worker；不出现 Supabase API 或 R2 签名 URL 的 runtime cache；可访问性分数至少 90。

- [ ] **Step 5: 提交**

```bash
git add apps/web
git commit -m "feat: add installable mobile scanning PWA"
```

## Task 14: 端到端验收、CI 与部署文档

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/core-flow.spec.ts`
- Create: `apps/web/e2e/privacy.spec.ts`
- Create: `.github/workflows/ci.yml`
- Create: `docs/runbooks/deployment.md`
- Modify: `README.md`

- [ ] **Step 1: 写核心闭环 E2E**

```ts
// apps/web/e2e/core-flow.spec.ts
test('owner creates, labels, scans, and maintains a box', async ({ page }) => {
  await registerAndLogin(page)
  await createSpace(page, '家')
  await createBox(page, { name: '冬季衣物', space: '家', visibility: 'public' })
  await expect(page.getByText(/BX-\d{5}/)).toBeVisible()
  await page.getByRole('button', { name: '新增物品' }).click()
  await fillItem(page, { name: '羽绒服', quantity: 2 })
  await expect(page.getByText('羽绒服 × 2')).toBeVisible()
  const publicUrl = await getDisplayedQrUrl(page)
  await page.context().clearCookies()
  await page.goto(publicUrl)
  await expect(page.getByRole('heading', { name: '冬季衣物' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新增物品' })).toHaveCount(0)
})
```

- [ ] **Step 2: 写隐私 E2E**

```ts
// apps/web/e2e/privacy.spec.ts
test('private box is hidden from anonymous and another account', async ({ browser }) => {
  const owner = await authenticatedPage(browser, 'owner')
  const privateUrl = await createPrivateBox(owner, '证件箱')
  const anonymous = await browser.newPage()
  await anonymous.goto(privateUrl)
  await expect(anonymous.getByRole('heading', { name: '无权限或内容不存在' })).toBeVisible()
  const other = await authenticatedPage(browser, 'other')
  await other.goto(privateUrl)
  await expect(other.getByRole('heading', { name: '无权限或内容不存在' })).toBeVisible()
})
```

- [ ] **Step 3: 运行 E2E 并修复发现的问题**

Run: `npm run test:e2e`

Expected: Chromium 的 desktop、iPhone 和 Pixel projects 全部 PASS；失败时只修复与失败验收项直接相关的实现。

- [ ] **Step 4: 创建 CI**

```yaml
# .github/workflows/ci.yml
name: ci
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --run
      - run: npm run build
  database:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: supabase test db
```

- [ ] **Step 5: 写部署 runbook 和 README**

写入以下部署文档骨架，并用各环境的真实值执行命令；文档中不记录 Secret：

```md
# 部署 Nomo

## Supabase
1. 从部署环境读取 `SUPABASE_PROJECT_REF`，关联目标项目：`supabase link --project-ref "$SUPABASE_PROJECT_REF"`。
2. 检查迁移：`supabase db diff --linked`。
3. 部署迁移：`supabase db push --linked`。
4. 在 Dashboard Vault 中写入四个 R2 secret；值从密码管理器粘贴，不进入 shell history。
5. Auth Site URL 设置为生产站点，Redirect URLs 加入 `/reset-password`。

## Cloudflare R2
Bucket 保持 private。CORS 允许生产 Origin，methods 为 GET、HEAD、PUT，headers 为 Content-Type。

## Cloudflare Pages
- Root directory: `/`
- Build command: `npm run build --workspace @nomo/web`
- Output directory: `apps/web/dist`
- Variables: `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_PUBLIC_APP_ORIGIN`
- SPA fallback 由 `apps/web/public/_redirects` 的 `/* /index.html 200` 提供。

## 发布验证
运行注册、创建公开/私有箱、匿名扫码、R2 上传下载和批量 PDF 冒烟测试。测试与生产使用独立 Supabase 项目、R2 Bucket 和 Token。轮换 R2 密钥时先增加新密钥、更新 Vault、验证上传下载，再撤销旧密钥。
```

README 提供 `npm install`、`npx supabase start`、复制 `.env.example`、`npm run dev`、全部测试命令，以及设计文档和 runbook 链接。

- [ ] **Step 6: 最终验证**

Run:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run test:db
npm run build
npm run test:e2e
git diff --check
```

Expected: 所有命令退出码为 0，Git diff 无空白错误。

- [ ] **Step 7: 提交**

```bash
git add .github apps/web/e2e apps/web/playwright.config.ts docs/runbooks README.md
git commit -m "test: verify QR storage MVP end to end"
```

## 实施顺序与检查点

1. Task 1–3 完成后：核心 Supabase 数据与权限可以独立验收。
2. Task 4–5 完成后：R2 上传、下载和清理链路可以独立验收。
3. Task 6–10 完成后：不含媒体的核心产品闭环可以浏览器验收。
4. Task 11–13 完成后：媒体、打印、扫码和 PWA 可以移动设备验收。
5. Task 14 完成后：通过 CI、E2E 和部署 runbook 进入发布准备状态。

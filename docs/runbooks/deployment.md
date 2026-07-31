# 部署 Nomo

部署操作使用独立的测试/生产 Supabase 项目和 R2 Bucket。任何密钥只从密码管理器写入平台控制台，不写入仓库、文档或 shell history。

## Supabase

数据库变更只由项目管理员在 Supabase Dashboard 的 SQL Editor 中手动执行。本项目的应用、自动化测试和 Codex 都不会连接、创建、重置或修改真实数据库，也不使用 Supabase CLI 推送迁移。

1. 审核 `supabase/migrations/` 中尚未执行的 SQL，确认目标项目与环境正确。
2. 按文件名时间顺序复制完整 SQL 到 Dashboard SQL Editor，并逐个执行；每个文件成功后再执行下一个。
3. 本次场地与公开访问功能依次执行：
   - `202608010001_public_box_rpc.sql`
   - `202608010002_venues.sql`
   - `202608010003_default_venue.sql`
4. 执行后运行下面的只读验证查询。预期：公开 RPC 存在；`venues` 有数据；没有 `venue_id` 为空的空间；最后一条查询返回零行，即每位用户恰好有一个内置默认场地。

```sql
select n.nspname as schema_name, p.proname, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_public_box';

select count(*) as venue_count from public.venues;
select count(*) as spaces_without_venue from public.spaces where venue_id is null;
select owner_id, count(*) filter (where is_default) as default_count
from public.venues
group by owner_id
having count(*) filter (where is_default) <> 1;
```

5. 在 Dashboard Vault 写入所需的四项 R2 配置。值只从密码管理器粘贴，不记录到文档、代码、日志或查询结果中。
6. Auth Site URL 设置为生产站点；Redirect URLs 加入生产站点的 `/reset-password`。
7. 确认 `pg_cron` 与 `pg_net` 可用，并检查媒体清理任务已注册。

## Cloudflare R2

- Bucket 必须保持 private。
- CORS 仅允许生产站点 Origin，methods 为 `GET`、`HEAD`、`PUT`，headers 为 `Content-Type`。
- R2 Token 只授予目标 Bucket 的对象读写权限。
- 轮换密钥时：增加新密钥 → 更新 Supabase Vault → 验证上传下载 → 撤销旧密钥。

## Cloudflare Pages

- Root directory：`/`
- Build command：`npm run build --workspace @nomo/web`
- Output directory：`apps/web/dist`
- Variables：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_PUBLIC_APP_ORIGIN`
- SPA fallback：`apps/web/public/_redirects` 提供 `/* /index.html 200`

## 发布验证

在独立测试环境逐项验证：注册/登录、创建空间、创建公开和私有箱、匿名扫码、跨账号私有访问拒绝、R2 上传与授权下载、删除后的 R2 清理、搜索、单箱与批量 PDF、密码重置和 PWA 安装。

本地/CI 浏览器 E2E 使用模拟 Supabase HTTP 响应，不替代上述真实环境冒烟测试。生产发布前记录验证时间、环境、执行人和结果。

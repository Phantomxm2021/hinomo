# 部署 Nomo

部署操作使用独立的测试/生产 Supabase 项目和 R2 Bucket。任何密钥只从密码管理器写入平台控制台，不写入仓库、文档或 shell history。

## Supabase

1. 从部署环境读取 `SUPABASE_PROJECT_REF`，关联目标项目：`supabase link --project-ref "$SUPABASE_PROJECT_REF"`。
2. 检查迁移：`supabase db diff --linked`。
3. 由项目管理员审核 `supabase/migrations/` 后执行：`supabase db push --linked`。
4. 在 Dashboard Vault 写入 `r2_account_id`、`r2_bucket_name`、`r2_access_key_id`、`r2_secret_access_key`。值从密码管理器粘贴，不进入 shell history。
5. Auth Site URL 设置为生产站点；Redirect URLs 加入生产站点的 `/reset-password`。
6. 确认 `pg_cron` 与 `pg_net` 可用，并检查媒体清理任务已注册。

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

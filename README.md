# Nomo 智能收纳

响应式 React PWA，通过二维码管理空间、箱子和物品。身份认证、Postgres、RLS、RPC 与审计使用 Supabase；用户图片存放在私有 Cloudflare R2，并通过短效签名 URL 上传和查看。

## 本地开发

```bash
npm install
cp apps/web/.env.example apps/web/.env
npm run dev
```

环境变量：

- `VITE_SUPABASE_URL`：Supabase 项目 URL
- `VITE_SUPABASE_ANON_KEY`：Supabase anon key（可公开的客户端 key，不是 service role key）
- `VITE_PUBLIC_APP_ORIGIN`：站点公开 Origin，用于二维码同源校验和链接生成

数据库迁移位于 `supabase/migrations/`。本项目约定迁移由管理员审核后手动执行；应用和测试不会自动连接、创建或重置数据库。

AI 装箱由浏览器在结束装箱前生成并上传固定网格 Atlas，随后由 `supabase/functions/packing-worker` 异步调用 Qwen、定位原图并通过 `magick-wasm` 生成单项裁剪。Postgres Trigger/`pg_net` 负责即时唤醒 Edge Function，Supabase Cron 负责漏通知恢复；Cloudflare 只继续提供现有私有 R2 存储，不运行 Packing 计算服务。开发和发布步骤见部署 Runbook，服务端密钥不得使用 `VITE_` 前缀。

## 验证

```bash
npm run lint
npm run typecheck
npm run typecheck:worker
npm test -- --run
npm run test:worker
npm run build
npm run build:worker
npm run test:e2e
```

浏览器 E2E 会拦截 Supabase HTTP 请求并使用内存状态，不访问真实数据库或 R2。SQL 测试位于 `supabase/tests/database/`，需要管理员在获准的隔离环境中单独执行 `npm run test:db`。

## 文档

- [实施计划](docs/superpowers/plans/2026-07-29-qr-storage-management-implementation.md)
- [AI 装箱照片 Atlas 设计与实施方案](docs/superpowers/specs/2026-08-03-ai-packing-photo-atlas-design.md)
- [部署 Runbook](docs/runbooks/deployment.md)
- [Docker 部署 Runbook](docs/runbooks/docker.md)

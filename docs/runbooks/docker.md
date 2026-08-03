# Docker 部署 Nomo

Nomo 前端是 Vite 构建的静态 PWA。Docker 镜像在构建阶段生成静态文件，并使用非 root Nginx 在容器内的 `8080` 端口提供服务。

Supabase 与 Cloudflare R2 不运行在此 Compose 文件中：它们仍使用独立生产项目、Vault 和私有 Bucket。详情见 [部署 Runbook](deployment.md) 与 [R2 Runbook](r2.md)。

## 1. 配置构建变量

在服务器上的仓库根目录创建 `.env`：

```bash
cp .env.docker.example .env
```

填写前端的三个构建时值：

- `VITE_SUPABASE_URL`：生产 Supabase Project URL。
- `VITE_SUPABASE_ANON_KEY`：生产 anon key；不得使用 service role key。
- `VITE_PUBLIC_APP_ORIGIN`：用户实际访问的 HTTPS Origin，例如 `https://nomo.example.com`。

这些是 Vite 的**构建时**变量，修改后必须重新构建镜像。

启用 AI 装箱 Worker 时，还要从部署平台的秘密管理器注入 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`R2_ACCOUNT_ID`、`R2_BUCKET_NAME`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`QWEN_API_KEY` 和 `QWEN_OPENAI_BASE_URL`。Worker 通过官方 `openai` Node.js SDK 访问兼容端点。这些服务端秘密不得进入前端变量、镜像层或版本控制；本地 `.env` 只用于受控服务器且权限应限制为仅部署账号可读。

## 2. 构建并启动

```bash
docker compose build --pull
docker compose up -d
docker compose ps
```

AI 装箱 Worker 使用可选 Compose profile，数据库迁移完成且秘密已注入后再启动：

```bash
docker compose --profile packing up -d --build
docker compose logs --tail=100 nomo-packing-worker
```

首次验证：

```bash
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/app/boxes
docker compose logs --tail=100 nomo-web
```

`/app/boxes` 必须返回 `index.html`，由 Nginx 的 SPA fallback 交给 React Router。

## 3. 生产 HTTPS

将域名的 HTTPS 终止放在容器前方，例如 Caddy、Nginx、Traefik、Cloudflare 或云负载均衡。反向代理把 `https://nomo.example.com` 转发到 `http://127.0.0.1:8080`。应用容器不需要、也不应持有 TLS 私钥。

在切换域名后同步更新：

1. `VITE_PUBLIC_APP_ORIGIN`，然后重新 `docker compose build` 和 `up -d`。
2. Supabase Auth 的 Site URL 与 `/reset-password` Redirect URL。
3. Cloudflare R2 CORS 的唯一 Allowed Origin。

## 4. 发布与回滚

```bash
git pull
docker compose build --pull
docker compose up -d --remove-orphans
```

先给镜像打发布标签；回滚时把 `image` 改为上一个已验证标签，然后执行：

```bash
docker compose up -d
```

发布后验证登录、密码重置、私有箱权限、媒体上传/下载、扫描、搜索、打印 PDF 和 PWA 更新。

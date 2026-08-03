# 部署 Nomo

部署操作使用独立的测试/生产 Supabase 项目和 R2 Bucket。任何密钥只从密码管理器写入平台控制台，不写入仓库、文档或 shell history。

## Supabase

数据库变更只由项目管理员在 Supabase Dashboard 的 SQL Editor 中手动执行。本项目的应用、自动化测试和 Codex 都不会连接、创建、重置或修改真实数据库，也不使用 Supabase CLI 推送迁移。

1. 审核 `supabase/migrations/` 中尚未执行的 SQL，确认目标项目与环境正确。
2. 按文件名时间顺序复制完整 SQL 到 Dashboard SQL Editor，并逐个执行；每个文件成功后再执行下一个。
3. 按时间顺序执行当前尚未部署的迁移。本轮场地、公开访问与物品流转功能的顺序为：
   - `202608010001_public_box_rpc.sql`
   - `202608010002_venues.sql`
   - `202608010003_default_venue.sql`
   - `202608010004_allow_default_venue_rename.sql`
   - `202608010005_repair_venue_update_policy.sql`
   - `202608010006_allow_direct_space_layout_resize.sql`
   - `202608020001_item_movements.sql`
   - `202608020002_item_availability_queries.sql`
   - `202608030001_ai_packing_sessions.sql`

   不要调换顺序：物品可用性查询依赖 `stored_quantity`，AI 装箱迁移又依赖正式物品字段、R2 签名函数和媒体清理表。

4. 执行后运行下面的只读验证查询。预期：公开 RPC 存在；`venues` 有数据；没有 `venue_id` 为空的空间；默认场地检查返回零行；所有旧物品都已有合法的在箱数量；三个流转 RPC 与流转表存在。

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

select count(*) as invalid_stored_quantity
from public.items
where stored_quantity is null
   or stored_quantity < 0
   or stored_quantity > quantity;

select n.nspname as schema_name, p.proname,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('take_out_item', 'return_item', 'move_item')
order by p.proname;

select to_regclass('public.item_movements') as item_movements_table;
select to_regclass('public.packing_sessions') as packing_sessions_table;
select to_regclass('public.packing_item_promotions') as packing_item_promotions_table;
```

5. 在 Dashboard Vault 写入所需的四项 R2 配置。值只从密码管理器粘贴，不记录到文档、代码、日志或查询结果中。
6. Auth Site URL 设置为生产站点；Redirect URLs 加入生产站点的 `/reset-password`。
7. 确认 `pg_cron` 与 `pg_net` 可用，并检查媒体清理任务已注册。

## AI 装箱 Worker 发布顺序

1. 先在隔离 Supabase 环境执行 `202608030001_ai_packing_sessions.sql` 和 `014_ai_packing_sessions.test.sql`。
2. 为 Worker 创建仅限目标 R2 Bucket 读写的 Token，并注入 service role 与 DashScope 密钥。
3. 固定 `QWEN_VL_MODEL=qwen3-vl-plus-2025-12-19`，构建并启动 `nomo-packing-worker`。
4. 使用 3 张无敏感内容的测试照片验证：连续上传 → 完成会话 → Atlas → AI 清单 → 原图高亮 → 转正式物品。
5. 删除测试会话，确认原图、规范图、Atlas 和未晋升裁剪图进入清理队列，晋升后的正式物品图片仍可访问。
6. 达到权威设计文档第 20 节门槛前，只在内部或受控灰度环境启用入口。

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

## 物品流转发布顺序

物品流转采用数据库优先发布：

1. 确认目标环境可恢复到发布前时间点，并记录当前迁移版本。
2. 依次执行 `202608020001_item_movements.sql` 和 `202608020002_item_availability_queries.sql`。
3. 完成上面的只读数据库验证。
4. 在测试环境执行 owner 冒烟路径：取出一件 → 放回一件 → 整项移动 → 查看流转记录。
5. 验证匿名打开公开箱子只能看到在位状态，不能看到经手人、备注、流转记录，也不能执行操作。
6. 发布前端构建。
7. 再次验证扫码入口、搜索状态、源箱子与目标箱子的数量更新。

前端能够把旧查询中缺失的 `stored_quantity` 视为“全部在位”，但取出、放回和移动依赖新 RPC。因此可以先部署数据库，不能先把带有流转入口的前端发布到旧数据库。

## 物品流转验收

发布前在仓库根目录运行：

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm run test:db
```

`npm run test:db` 需要已经启动的本地 Supabase/Postgres 测试环境。无法提供本地数据库运行时不能视为数据库测试通过，必须在 CI 或独立测试环境补跑 `012_item_movements.test.sql` 与 `013_item_availability_queries.test.sql`。

产品验收至少覆盖：

- 原有物品迁移后显示“在位”，数量与迁移前一致。
- 取出、放回数量不能越界；失败只显示全局反馈，不改变页面布局。
- 存在未放回数量时不能移动；全部在位时能移动至当前账号的其他箱子。
- 移动后物品从源箱子消失并出现在目标箱子，图片仍可访问。
- 流转记录包含操作、数量、时间、原箱子、目标箱子以及可选经手人／用途和备注。
- 搜索与公开箱子显示正确在位状态。
- 其他账号和匿名访问不能读取私人流转记录或调用流转 RPC。

## 物品流转回滚

两份迁移是向后兼容的增量变更。出现前端问题时，优先回滚前端版本并暂时保留数据库字段、RPC 和历史数据；旧前端不会写入 `stored_quantity`，数据库触发器会继续保持数量一致。

不要在生产环境直接删除 `item_movements`、`stored_quantity` 或枚举类型。确实需要数据库回退时：

1. 先停止新流转写入并创建可恢复快照。
2. 导出 `item_movements`，确认是否存在尚未放回的数量。
3. 只有所有物品都满足 `stored_quantity = quantity`，或业务已明确处理未归还物品时，才制定单独的回退 SQL。
4. 在独立测试项目验证旧版查询、媒体关系与 RLS 后，再由项目管理员执行。

这种回退属于数据处置，不作为常规发布步骤，也不应通过应用或自动化脚本直接执行。

## 发布验证

在独立测试环境逐项验证：注册/登录、创建空间、创建公开和私有箱、匿名扫码、跨账号私有访问拒绝、R2 上传与授权下载、删除后的 R2 清理、搜索、物品取出／放回／移动及历史、单箱与批量 PDF、密码重置和 PWA 安装。

本地/CI 浏览器 E2E 使用模拟 Supabase HTTP 响应，不替代上述真实环境冒烟测试。生产发布前记录验证时间、环境、执行人和结果。

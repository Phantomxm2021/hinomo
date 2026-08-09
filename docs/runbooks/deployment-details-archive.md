# 部署详细参考与历史说明

> 这份文件保留专项配置、历史迁移说明和回滚细节。**不要从这里开始部署**；当前版本请先看 [`deployment.md`](./deployment.md)。如果主流程与本附录存在冲突，以主流程和当前代码中的 migration 依赖为准。

---

## 原始详细部署记录

+# 部署 Nomo
+
+部署操作使用独立的测试/生产 Supabase 项目和 R2 Bucket。任何密钥只从密码管理器写入平台控制台，不写入仓库、文档或 shell history。
+
+## Supabase
+
+数据库变更只由项目管理员在 Supabase Dashboard 的 SQL Editor 中手动执行。本项目的应用、自动化测试和 Codex 都不会连接、创建、重置或修改真实数据库，也不使用 Supabase CLI 推送迁移。
+
+1. 审核 `supabase/migrations/` 中尚未执行的 SQL，确认目标项目与环境正确。
+2. 按文件名时间顺序复制完整 SQL 到 Dashboard SQL Editor，并逐个执行；每个文件成功后再执行下一个。
+
+**箱子权益迁移例外（必须遵守）：** 通用的文件名顺序不适用于 `202608080002`～`202608080005` 这组需要兼容窗口的迁移。不要重命名或重编号迁移，也不要因为 003 的文件名较早就提前执行；箱子权益必须按本手册专用章节的 `002 → 004 → 005 → Edge Functions → 前端 → 等待旧缓存退出 → 003` 顺序发布。其他迁移仍按其各自依赖和文件名顺序执行。
+
+3. 按时间顺序执行当前尚未部署的迁移。本轮场地、公开访问与物品流转功能的顺序为：
+   - `202608010001_public_box_rpc.sql`
+   - `202608010002_venues.sql`
+   - `202608010003_default_venue.sql`
+   - `202608010004_allow_default_venue_rename.sql`
+   - `202608010005_repair_venue_update_policy.sql`
+   - `202608010006_allow_direct_space_layout_resize.sql`
+   - `202608020001_item_movements.sql`
+   - `202608020002_item_availability_queries.sql`
+   - `202608030001_ai_packing_sessions.sql`
+   - `202608030002_supabase_packing_runtime.sql`
+   - `202608030003_simplify_packing_promotion.sql`
+   - `202608030004_allow_packing_photo_fallback.sql`
+   - `202608030005_explain_packing_promotion_rejection.sql`
+   - `202608030006_ai_credits_stripe.sql`
+
+   不要调换顺序：物品可用性查询依赖 `stored_quantity`，AI 装箱迁移又依赖正式物品字段、R2 签名函数和媒体清理表。
+
+4. 执行后运行下面的只读验证查询。预期：公开 RPC 存在；`venues` 有数据；没有 `venue_id` 为空的空间；默认场地检查返回零行；所有旧物品都已有合法的在箱数量；三个流转 RPC 与流转表存在。
+
+```sql
+select n.nspname as schema_name, p.proname, pg_get_function_identity_arguments(p.oid) as arguments
+from pg_proc p
+join pg_namespace n on n.oid = p.pronamespace
+where n.nspname = 'public' and p.proname = 'get_public_box';
+
+select count(*) as venue_count from public.venues;
+select count(*) as spaces_without_venue from public.spaces where venue_id is null;
+select owner_id, count(*) filter (where is_default) as default_count
+from public.venues
+group by owner_id
+having count(*) filter (where is_default) <> 1;
+
+select count(*) as invalid_stored_quantity
+from public.items
+where stored_quantity is null
+   or stored_quantity < 0
+   or stored_quantity > quantity;
+
+select n.nspname as schema_name, p.proname,
+       pg_get_function_identity_arguments(p.oid) as arguments
+from pg_proc p
+join pg_namespace n on n.oid = p.pronamespace
+where n.nspname = 'public'
+  and p.proname in ('take_out_item', 'return_item', 'move_item')
+order by p.proname;
+
+select to_regclass('public.item_movements') as item_movements_table;
+select to_regclass('public.packing_sessions') as packing_sessions_table;
+select to_regclass('public.packing_item_promotions') as packing_item_promotions_table;
+```
+
+5. 在 Dashboard Vault 写入所需的四项 R2 配置。值只从密码管理器粘贴，不记录到文档、代码、日志或查询结果中。
+6. Auth Site URL 设置为生产站点；Redirect URLs 加入生产站点的 `/reset-password`。
+7. 确认 `pg_cron` 与 `pg_net` 可用，并检查媒体清理任务已注册。
+
+## AI 装箱 Supabase Runtime 发布顺序
+
+1. 先在隔离 Supabase 环境依次执行 `202608030001_ai_packing_sessions.sql`、`202608030002_supabase_packing_runtime.sql`。
+2. 再依次运行 `014_ai_packing_sessions.test.sql`、`015_supabase_packing_runtime.test.sql`。后一个测试覆盖客户端 Atlas 上传、service-role 媒体签名、`pg_net` 唤醒与 Cron 兜底。
+3. 生成至少 32 字节随机 `PACKING_FUNCTION_SECRET`。将相同值分别写入 Supabase Function Secret 和 Vault 的 `packing_function_secret`，不要出现在命令参数、文档或日志中。
+4. 在 Vault 新增 `packing_function_url`，值为当前项目的完整函数 URL：`https://<project-ref>.supabase.co/functions/v1/packing-worker`。
+5. 在 Function Secrets 注入 `QWEN_API_KEY`，并设置 `QWEN_OPENAI_BASE_URL`、`QWEN_VL_MODEL=qwen3-vl-plus-2025-12-19`。`SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 由托管运行时提供。
+6. 检查项目原有 Vault 中四项 R2 凭据仍有效；Edge Function 不持有这些长期凭据，只通过 RPC 获取短效 URL。
+7. 类型检查并发布：
+
+```bash
+npm run typecheck:worker
+npm run test:worker
+npm run build:worker
+supabase functions deploy packing-worker --no-verify-jwt
+```
+
+8. 确认 `packing_sessions_wake_edge_function` Trigger 和 `invoke-packing-edge-function` Cron 已存在；访问函数 `/health` 验证返回 `runtime: supabase-edge-function`。
+9. 使用 3 张无敏感内容的测试照片验证：连续上传 → 浏览器 Atlas → 完成会话 → Trigger 唤醒 → AI 清单 → 原图高亮 → 转正式物品。
+10. 再使用至少一个 50 张会话验证移动浏览器内存、Atlas 耗时以及 Edge Function CPU/内存日志。
+11. 删除测试会话，确认原图、Atlas 和未晋升裁剪图进入清理队列，晋升后的正式物品图片仍可访问。
+12. 达到权威设计文档第 20 节门槛前，只在内部或受控灰度环境启用入口。
+
+## AI Credits 与 Stripe 发布顺序
+
+1. 先阅读并确认 [AI Credits 与 Stripe 权威设计](../ai-credits-stripe.md)，在隔离 Supabase 项目执行 `202608030006_ai_credits_stripe.sql`。
+2. 执行 `014_ai_packing_sessions.test.sql`、`015_supabase_packing_runtime.test.sql` 和 `016_ai_credits.test.sql`，确认余额不足时不会排队或透支。
+3. 在 Stripe test mode 创建以下一次性 Price；代码只接受环境变量对应的 allowlist，不接受客户端传入任意 Price ID。这里必须复制以 `price_` 开头的 **Price ID**，不能使用以 `prod_` 开头的 Product ID：
+   - 20 credits，`HKD 12.00` 一次性 Price → `STRIPE_CREDIT_20_PRICE_ID`；
+   - 100 credits，`HKD 42.00` 一次性 Price → `STRIPE_CREDIT_100_PRICE_ID`；
+   - 500 credits，`HKD 148.00` 一次性 Price → `STRIPE_CREDIT_500_PRICE_ID`。
+4. 确认所有 Price 都是 one-time，不创建 recurring Price，不配置 Customer Portal。
+5. 在 Supabase Function Secrets 写入：
+   - `STRIPE_SECRET_KEY`；
+   - `STRIPE_WEBHOOK_SECRET`；
+   - 三个以 `price_` 开头的 Stripe Price ID；不要填产品详情页上的 `prod_` Product ID；
+   - `PUBLIC_APP_ORIGIN`，值必须是生产站点的精确 Origin，不能包含任意 return URL。
+   - `PUBLIC_APP_ALLOWED_ORIGINS`，逗号分隔的额外 CORS Origin；测试环境设为 `http://localhost:5173,http://127.0.0.1:5173`，正式环境不需本地调试时应留空。
+6. 类型检查并发布：
+
+```bash
+npm run typecheck:billing
+supabase functions deploy billing-checkout --no-verify-jwt
+supabase functions deploy stripe-webhook --no-verify-jwt
+```
+
+7. 在 Stripe Webhook Endpoint 指向 `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`，订阅：
+   - `checkout.session.completed`；
+   - `checkout.session.async_payment_succeeded`；
+   - `checkout.session.async_payment_failed`；
+   - `charge.refunded`；同一端点同时处理 AI Credits 与无限箱子权益的付款完成、延迟付款完成、延迟付款失败和退款事件。全额退款会幂等收回对应 credit 包中尚未使用的额度，已经消费的额度不生成负余额。
+8. 使用 Stripe 测试卡依次验证：一次性购买 20 credits → Webhook 发放 → 1 张照片预留 1 credit → 发布结算 → 全额退款收回剩余额度。
+9. 验证 Webhook 重放不会重复发放；并发完成两个会话不能透支；没有任何识别结果的终态失败会释放 reservation。
+10. 确认前端空余额入口显示 Apple 风格 credit Sheet，credit 页只进入一次性 Checkout，移动端安全区、焦点恢复和 Escape 行为正常后再灰度开启。
+
+## 无限箱子权益与 Stripe 发布顺序
+
+无限箱子权益必须按兼容顺序发布。`202608080002_box_entitlements.sql` 暂时保留旧前端直接创建箱子的能力，`202608080004_box_entitlements_service_read.sql` 为 Checkout 的有效权益检查授予 service role 只读权限，`202608080005_account_entitlement_revocation_tombstones.sql` 保证退款事件早于付款完成事件时不会稍后重新发放权益。`202608080003_box_entitlements_enforce.sql` 最后才撤销旧创建权限；在旧静态资源和缓存版本退出前，不得提前执行该收口迁移。
+
+1. 在 Stripe **Test Mode** 先创建 `HKD 38.00` 的 one-time Product/Price，不创建 recurring Price。复制 Test Mode 中以 `price_` 开头的 **Price ID**，不要使用以 `prod_` 开头的 Product ID，也不要使用 Live Mode Price ID。
+2. 在测试 Supabase 项目的 Function Secrets 配置同一 Stripe Test Mode 的值：
+   - `STRIPE_BOXES_UNLIMITED_PRICE_ID`：上一步创建的 `HKD 38.00` one-time Price；
+   - `PUBLIC_APP_ORIGIN`：当前测试前端站点的精确 Origin，不带路径，不接受客户端提供的 return URL；
+   - `STRIPE_WEBHOOK_SECRET`：Test Mode Webhook Endpoint 的签名 Secret；
+   - `STRIPE_SECRET_KEY`：对应 Test Mode 的 `sk_test_...` 服务端 Secret Key。
+3. 确认托管 Edge Function 运行时可用 `SUPABASE_SERVICE_ROLE_KEY`。上述 Stripe 配置、Price ID 和 service role key 都只能放在服务端配置中：不得写入 `apps/web/.env`，不得创建 `VITE_STRIPE_BOXES_UNLIMITED_PRICE_ID`、`VITE_STRIPE_SECRET_KEY`、`VITE_STRIPE_WEBHOOK_SECRET` 或 `VITE_SUPABASE_SERVICE_ROLE_KEY`，也不得以其他 `VITE_` 名称暴露这些值。
+4. 在测试 Supabase 项目执行加法迁移 `supabase/migrations/202608080002_box_entitlements.sql`，创建权益表以及摘要、原子创建、发放和撤销 RPC；此时不要执行 003。
+5. 接着执行 `supabase/migrations/202608080004_box_entitlements_service_read.sql`，让 `billing-checkout` 的 service role 能够只读检查 active 权益，同时保持客户端无权读取权益表、service role 无权直接写表。
+6. 再执行 `supabase/migrations/202608080005_account_entitlement_revocation_tombstones.sql`，为退款先到、付款完成后到的乱序事件建立终止记录。此时只运行 `018_box_entitlements.test.sql`，确认摘要、原子创建、发放、退款先到、重复事件、撤销和重新激活契约通过后再继续；不要提前运行 `007_api_privileges.test.sql`，因为它对箱子直接 `INSERT` 已被撤销的断言要到 003 执行后才成立。
+7. 类型检查并部署 `billing-checkout` 与 `stripe-webhook` Edge Functions：
+
+```bash
+npm run typecheck:billing
+supabase functions deploy billing-checkout --no-verify-jwt
+supabase functions deploy stripe-webhook --no-verify-jwt
+```
+
+8. 确认 Test Mode Webhook Endpoint 指向测试项目的 `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`，且订阅 `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`checkout.session.async_payment_failed` 与 `charge.refunded`；该端点由 AI Credits 与无限箱子权益共用。
+9. 发布包含 `create_box` RPC、箱子额度摘要、付费墙和支付确认流程的前端版本。
+10. 等待旧前端静态资源和缓存版本退出。至少确认当前 CDN/浏览器缓存窗口已经过去、监控中不再出现旧版本的箱子直接 `INSERT` 请求，并使用全新会话验证创建请求已统一调用 `create_box` RPC。记录确认时间和执行人。
+11. 最后执行权限收口迁移 `supabase/migrations/202608080003_box_entitlements_enforce.sql`，并重新运行 `007_api_privileges.test.sql`，确认 authenticated 客户端不能直接 `INSERT public.boxes`，但 `create_box`、读取、更新和删除仍可用。此步骤完成前，免费箱子上限不视为已正式强制生效。
+
+### Stripe test mode 验收清单
+
+- [ ] 免费账号创建并同时保有 3 个箱子后，再点击“创建箱子”会打开 HK$38 付费墙；已有三个箱子均可正常使用。
+- [ ] 从 Checkout 取消返回后，账号箱子数、权益状态和 AI Credits 余额均不变化，并且可以再次发起购买。
+- [ ] 使用 Stripe 测试卡完成付款后，`checkout.session.completed` 发放一条 active 的 `boxes_unlimited_lifetime` 权益；前端确认到账后允许创建第 4 个箱子。
+- [ ] 人为延迟 Webhook 时，success return 只显示“正在确认”，不会提前声称已解锁，也不会展示可重复购买按钮；Webhook 到达后自动恢复创建流程。
+- [ ] 模拟延迟付款失败时，`checkout.session.async_payment_failed` 以 `async_payment_failed` 结果记录为已完成事件，不发放箱子权益或 AI Credits；支持人员使用返回 URL 的 `session_id`（如有）和 Stripe Event 中的 Checkout Session ID 定位订单。
+- [ ] 重放同一个 Stripe event 或 Checkout Session 不会重复发放权益；事件幂等完成且账号最多只有一条同类 active 权益。
+- [ ] 对无限箱子订单执行全额退款后，权益变为 revoked，免费上限重新生效；退款前已有的超额箱子仍可查看、编辑、删除和管理物品，不被删除或锁定。
+- [ ] 退款后通过新的 Checkout Session 重新购买，会新增可审计的 entitlement 记录并恢复一条 active 权益，历史 revoked 记录保留。
+- [ ] 记录购买前 AI Credits 余额；完成无限箱子购买、Webhook 重放、全额退款和重新购买后余额都保持不变。另行购买 Credits 的既有发放与退款流程仍按原规则工作。
+
+验收完成后记录 Stripe mode、测试账号、Checkout Session/Event ID、各步骤时间和结果；不要记录卡号、支付方式详情、Secret 或 service role key。
+
+### Live Mode 上线切换
+
+只有上面的 Stripe Test Mode 验收全部通过后，才配置生产环境。Test Mode 与 Live Mode 的 Product、Price、Secret Key、Webhook Endpoint 和 Webhook Secret 相互独立，不能跨模式复用。
+
+1. 切换到 Stripe **Live Mode**，另行创建 `HKD 38.00` 的 one-time Product/Price，不创建 recurring Price。记录 Live Mode 中以 `price_` 开头的 Price ID，并由另一位发布人员复核金额、币种和 one-time 类型。
+2. 在生产 Supabase Function Secrets 写入同一 Live Mode 的配置：
+   - `STRIPE_BOXES_UNLIMITED_PRICE_ID`：Live Mode 的 `HKD 38.00` one-time Price ID；
+   - `STRIPE_SECRET_KEY`：对应 Live Mode 的 `sk_live_...` 服务端 Secret Key；
+   - `PUBLIC_APP_ORIGIN`：生产前端站点的精确 Origin；
+   - `STRIPE_WEBHOOK_SECRET`：下一步生产 Live Mode Webhook Endpoint 独有的签名 Secret。
+3. 在 Stripe Live Mode 新建指向生产 Supabase 项目 `stripe-webhook` 的 Endpoint，订阅 `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`checkout.session.async_payment_failed` 与 `charge.refunded`；该端点由 AI Credits 与无限箱子权益共用。将该 Endpoint 的 `whsec_...` 写入生产 `STRIPE_WEBHOOK_SECRET`，不得复制 Test Mode 的 Webhook Secret。
+4. 在生产项目按同一兼容顺序发布：002 → 004 → 005 → Edge Functions → 前端 → 等待旧缓存退出 → 003。发布前再次确认 Price ID、Secret Key、Webhook Secret 属于 Live Mode 且彼此匹配；发现任何 Test Mode 值时立即停止上线。
+5. 使用受控生产账号进行不暴露支付资料的最小冒烟验证，确认 Checkout 显示 HKD 38.00、返回 Origin 正确、Webhook 发放单条 active 权益且 AI Credits 不变化；按运营流程处置或退款该验证订单。
+
+## 可观测性边界、Webhook 监控与回滚
+
+### 产品漏斗埋点边界
+
+当前仓库没有接入 PostHog、Mixpanel、Segment 或其他 analytics provider，也没有发出以下产品事件：`box_limit_paywall_viewed`、`box_unlimited_checkout_started`、`box_unlimited_purchase_confirmed`、`box_unlimited_purchase_confirmation_delayed`、`box_created_after_unlock`。发布记录、仪表盘和对外材料不得声称这些漏斗事件已采集或转化率可用；本期只能用 Stripe Webhook 收件箱、Stripe Dashboard 和人工验收记录做支付运营观测。以后接入 analytics provider 需单独设计、隐私评估和发布。
+
+### Stripe Webhook 查询与告警阈值
+
+以下查询只允许由受控 Supabase SQL Editor／service role 执行；`stripe_webhook_events` 不向客户端开放。查询结果只记录 `evt_...`、事件类型、错误码和时间，不复制卡号、支付方式或家庭内容。
+
+```sql
+-- 失败事件：付款发放、退款撤销和 Credits 处理都可能受影响
+select stripe_event_id, event_type, last_error_code, created_at, processed_at
+from public.stripe_webhook_events
+where status = 'failed'
+  and created_at >= pg_catalog.now() - interval '24 hours'
+order by created_at desc;
+
+-- 超过 10 分钟仍未完成的事件：可能卡在 processing 或函数没有回写
+select stripe_event_id, event_type, created_at,
+       floor(extract(epoch from (pg_catalog.now() - created_at)) / 60)::integer as age_minutes
+from public.stripe_webhook_events
+where status = 'processing'
+  and created_at < pg_catalog.now() - interval '10 minutes'
+order by created_at asc;
+
+-- 已完成但需要人工跟进的业务结果
+select stripe_event_id, event_type, last_error_code, created_at, processed_at
+from public.stripe_webhook_events
+where status = 'completed'
+  and last_error_code in (
+    'duplicate_paid_entitlement',
+    'partial_refund_manual_review',
+    'refunded_paid_entitlement',
+    'async_payment_failed'
+  )
+  and processed_at >= pg_catalog.now() - interval '24 hours'
+order by processed_at desc;
+```
+
+生产阈值：任意付款或退款事件进入 `failed` 即创建高优先级工单；超过 10 分钟的 `processing` 任意一条立即告警；`duplicate_paid_entitlement`、`partial_refund_manual_review`、`refunded_paid_entitlement` 或 `async_payment_failed` 任意一条都必须在 1 小时内人工确认。15 分钟内出现 5 条以上任意 Webhook 失败时升级为发布事故，暂停继续灰度；同一事件修复后才允许重放。查询中的 `evt_...` 用于在 Stripe Dashboard 找到对应 Checkout Session／Charge 和 metadata。
+
+### 重复付款与退款人工处置
+
+1. 先从查询记录取得 `stripe_event_id`，在 Stripe Dashboard 打开 Event 并核对 Checkout Session、Charge、账号 metadata 和付款状态；不要只凭用户截图或金额判断。
+2. `duplicate_paid_entitlement`：确定一笔是 canonical active 权益后保留该来源对应的权益；在 Stripe 对另一笔已付款的 Checkout Session 执行退款。不要撤销 canonical 来源，也不要直接写 `account_entitlements`。若确实需要撤销某个来源，只能由 service role 调用：
+
+   ```sql
+   select public.revoke_account_entitlement(
+     'stripe', 'checkout:cs_...'
+   ) as revoked_count;
+   ```
+
+   对重复来源调用该 RPC 可能只写入退款 tombstone，不应影响 canonical active 权益；随后确认已有箱子仍可查看、编辑、删除和管理物品。
+3. `async_payment_failed`：该事件只记录失败结果，不授予箱子权益或 Credits。支持人员使用返回 URL 的 `session_id`（若存在）或 Stripe Event 查找 Checkout Session，确认没有成功付款；若用户需要重新购买，使用新的 Checkout Session，不重放失败事件。
+4. `partial_refund_manual_review`：部分退款不会自动撤销箱子权益。核对退款金额、Session/Event ID 和用户意图；若决定全额退款，先在 Stripe 完成全额退款并等待／重放 Webhook。只有经授权的全额撤销才调用上面的 `revoke_account_entitlement` RPC，记录 `revoked_count`、Session ID 和 Event ID。
+5. `refunded_paid_entitlement` 或全额退款事件失败／超时：核对该 Checkout Session 确已全额退款，然后通过同一 RPC 确保来源被撤销或写入 tombstone；修复后重放原 Event。撤销只影响未来超出免费上限的新增权限，绝不删除、锁定或降级已有箱子。
+6. 所有人工处理必须保留 Stripe Event/Session ID、操作人、退款结果和 RPC 结果。禁止直接 `update`／`delete` 权益表、删除 Webhook 历史或删除任何已有箱子。
+
+### 003 收口后的回滚（只前进迁移）
+
+迁移回滚采用 forward-only 原则：不要删除或反向执行 002、004、005、003，也不要丢弃 `account_entitlements`、退款 tombstone、Stripe Webhook 历史或已有箱子。
+
+如果 003 已执行而前端必须回退，不能直接部署仍依赖旧版直接 `INSERT` 的客户端并让其失败。先暂停流量，提交并审核一份临时 forward migration，恢复兼容窗口中 authenticated 所需的列级创建权限（仅恢复原 002 的授权范围）：
+
+```sql
+grant insert (owner_id, space_id, name, category, location, description, visibility)
+on table public.boxes to authenticated;
+```
+
+该授权只用于短时救援窗口，期间记录绕过 `create_box` 的风险和所有新建箱子；不得恢复无关角色权限。修复前端并确认新缓存已退出后，再提交另一份 forward migration 重新撤销上述列级权限，运行 `007_api_privileges.test.sql`，并确认所有权益、tombstone、Webhook 历史和箱子数据仍然存在。任何回滚方案都不得通过删除数据或 `DROP` 表／函数完成。
+
+## 家庭共享场地发布、健康检查与向前回滚
+
+家庭共享必须按以下固定顺序发布，不得跳过或重排。每个迁移完成后确认 PostgREST schema reload 成功，再进入下一步：
+
+```text
+202608090001 → 002 → 003 → 004 → 005
+→ npm run test:db
+→ production Web frontend (`VITE_ENABLE_VENUE_INVITES=false`)
+→ staging/preview invite smoke test (`VITE_ENABLE_VENUE_INVITES=true`)
+→ production Web frontend redeploy (`VITE_ENABLE_VENUE_INVITES=true`)
+```
+
+其中 001 是成员与邀请权限，002 是共享内容与所有者箱子额度，003 是共享工作流，004 是共享 packing 权限，005 是活动流。先让新后端完整可用，再发布 Web 前端。`VITE_ENABLE_VENUE_INVITES` 是构建时 kill switch：值不严格等于 `true` 时，成员页不会请求、创建、显示或撤销邀请；接受已有邀请的 token 路由保持可用。内部邀请冒烟必须在同一提交的 staging/preview 构建中把该变量设为 `true`，通过后才把生产变量改为 `true` 并重新构建、发布；仅修改变量而不重新部署不会改变已发布 bundle。健康检查和运营查询只能由受控 SQL Editor 执行，查询结果不得复制邀请 token、access token、service role key、家庭内容或图片 URL。
+
+```sql
+-- 成员数不能超过所有者加四位成员。
+select venue_id, count(*) + 1 as member_count
+from public.venue_members
+group by venue_id
+having count(*) + 1 > 5;
+
+-- 有效邀请不得超过剩余席位。成员和邀请先分别聚合，避免多成员、多邀请
+-- 的 join 相乘而把两边计数都放大。
+with member_counts as (
+  select venue_id, count(*) as member_count
+  from public.venue_members
+  group by venue_id
+), active_invites as (
+  select venue_id, count(*) as active_invite_count
+  from public.venue_invites
+  where accepted_at is null
+    and revoked_at is null
+    and expires_at > pg_catalog.now()
+  group by venue_id
+)
+select venues.id as venue_id,
+       coalesce(active_invites.active_invite_count, 0) as active_invites,
+       5 - 1 - coalesce(member_counts.member_count, 0) as remaining_seats
+from public.venues as venues
+left join member_counts on member_counts.venue_id = venues.id
+left join active_invites on active_invites.venue_id = venues.id
+where coalesce(active_invites.active_invite_count, 0) > 5 - 1 - coalesce(member_counts.member_count, 0);
+
+-- 关键内容事件必须有 actor；未知 actor 仅允许历史保留场景另行人工说明。
+select id, venue_id, event_code, created_at
+from public.activity_logs
+where event_code in ('item_created', 'item_moved', 'item_quantity_changed', 'item_deleted', 'box_moved')
+  and actor_id is null
+order by created_at desc;
+
+-- 一个场地只能有一个所有者，且所有者不可同时成为 venue_members 行。
+select venues.id, venues.owner_id, members.user_id
+from public.venues as venues
+join public.venue_members as members
+  on members.venue_id = venues.id and members.user_id = venues.owner_id;
+
+-- 最近私有 membership audit 变更。
+select venue_id, actor_id, subject_user_id, event_code, created_at
+from private.venue_membership_audit
+order by created_at desc
+limit 100;
+
+-- 最近服务端拒绝/错误聚合（以部署日志的结构化 code 字段为准）。
+select error_code, count(*) as count, max(created_at) as most_recent
+from private.request_error_logs
+where created_at >= pg_catalog.now() - interval '24 hours'
+  and error_code in ('venue_access_denied', 'venue_member_limit_reached', 'venue_invite_used')
+group by error_code
+order by count desc, most_recent desc;
+```
+
+最后一条假设部署环境将结构化 access-denied/error 日志写入 `private.request_error_logs`；当前仓库没有产品 analytics provider。没有该受控日志表时，改在受控日志平台按相同 error code 聚合，发布记录不得声称已采集产品漏斗或转化数据。
+
+### Test Mode 验收
+
+- 邀请过期、撤销和复用均显示稳定错误；最后一个席位只能保有一条有效邀请，两个账号同时接受同一邀请时只加入一人。
+- 成员可以创建第 3 个共享箱子；第 4 个由所有者额度拒绝，成员只看到联系所有者的说明而没有购买入口。
+- 成员发起 packing 时使用成员本人的 AI Credits；所有者的无限箱子权益或余额不会转移给成员。
+- 撤权后的旧标签/二维码下一次服务端请求即拒绝；跨场地读取不泄露空间、箱子、物品或活动；猜测 R2 object key 不能得到对象。
+- 使用本地 Supabase 执行 `npm run test:venue-sharing-concurrency`。期望输出仅为 `last-seat-reservation: second invite rejected` 和 `last-seat-race: 1 joined, 1 venue_invite_used`；不要把 token 写入 CI 日志。
+
+### 向前回滚
+
+家庭共享回滚先把生产 `VITE_ENABLE_VENUE_INVITES` 改为 `false`，重新构建并发布前端，以关闭邀请列表、创建和撤销入口。若旧 bundle 仍在流量中且必须立即阻断新邀请，提交一份经评审的 **forward migration**：
+
+```sql
+revoke execute on function public.create_venue_invite(uuid) from authenticated;
+notify pgrst, 'reload schema';
+```
+
+恢复时使用另一份经评审的 forward migration：
+
+```sql
+grant execute on function public.create_venue_invite(uuid) to authenticated;
+notify pgrst, 'reload schema';
+```
+
+保留接受已有 token 的路由以及 `venue_members`、`venue_invites`、活动、packing 和审计表及全部数据；不得 `DROP` 表/函数、删除成员历史或反向执行 001–005。修复后重新部署兼容前端、执行 `npm run test:db`、在 flag 为 `true` 的 staging/preview 完成内部邀请冒烟和本节 Test Mode 清单，再重新开启生产入口。
+
+## Cloudflare R2
+
+- Bucket 必须保持 private。
+- CORS 仅允许生产站点 Origin，methods 为 `GET`、`HEAD`、`PUT`，headers 为 `Content-Type`。
+- R2 Token 只授予目标 Bucket 的对象读写权限。
+- 轮换密钥时：增加新密钥 → 更新 Supabase Vault → 验证上传下载 → 撤销旧密钥。
+
+## Cloudflare Pages
+
+- Root directory：`/`
+- Build command：`npm run build --workspace @nomo/web`
+- Output directory：`apps/web/dist`
+- Variables：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_PUBLIC_APP_ORIGIN`、`VITE_ENABLE_VENUE_INVITES`（生产首次发布和回滚时为 `false`；冒烟通过后的生产构建为 `true`）
+- SPA fallback：根目录 `wrangler.jsonc` 的 `assets.not_found_handling = "single-page-application"`
+
+## 物品流转发布顺序
+
+物品流转采用数据库优先发布：
+
+1. 确认目标环境可恢复到发布前时间点，并记录当前迁移版本。
+2. 依次执行 `202608020001_item_movements.sql` 和 `202608020002_item_availability_queries.sql`。
+3. 完成上面的只读数据库验证。
+4. 在测试环境执行 owner 冒烟路径：取出一件 → 放回一件 → 整项移动 → 查看流转记录。
+5. 验证匿名打开公开箱子只能看到在位状态，不能看到经手人、备注、流转记录，也不能执行操作。
+6. 发布前端构建。
+7. 再次验证扫码入口、搜索状态、源箱子与目标箱子的数量更新。
+
+前端能够把旧查询中缺失的 `stored_quantity` 视为“全部在位”，但取出、放回和移动依赖新 RPC。因此可以先部署数据库，不能先把带有流转入口的前端发布到旧数据库。
+
+## 物品流转验收
+
+发布前在仓库根目录运行：
+
+```bash
+npm run typecheck
+npm run typecheck:billing
+npm run lint
+npm test -- --run
+npm run build
+npm run test:db
+```
+
+`npm run test:db` 需要已经启动的本地 Supabase/Postgres 测试环境。无法提供本地数据库运行时不能视为数据库测试通过，必须在 CI 或独立测试环境补跑 `012_item_movements.test.sql` 与 `013_item_availability_queries.test.sql`。
+
+产品验收至少覆盖：
+
+- 原有物品迁移后显示“在位”，数量与迁移前一致。
+- 取出、放回数量不能越界；失败只显示全局反馈，不改变页面布局。
+- 存在未放回数量时不能移动；全部在位时能移动至当前账号的其他箱子。
+- 移动后物品从源箱子消失并出现在目标箱子，图片仍可访问。
+- 流转记录包含操作、数量、时间、原箱子、目标箱子以及可选经手人／用途和备注。
+- 搜索与公开箱子显示正确在位状态。
+- 其他账号和匿名访问不能读取私人流转记录或调用流转 RPC。
+
+## 物品流转回滚
+
+两份迁移是向后兼容的增量变更。出现前端问题时，优先回滚前端版本并暂时保留数据库字段、RPC 和历史数据；旧前端不会写入 `stored_quantity`，数据库触发器会继续保持数量一致。
+
+不要在生产环境直接删除 `item_movements`、`stored_quantity` 或枚举类型。确实需要数据库回退时：
+
+1. 先停止新流转写入并创建可恢复快照。
+2. 导出 `item_movements`，确认是否存在尚未放回的数量。
+3. 只有所有物品都满足 `stored_quantity = quantity`，或业务已明确处理未归还物品时，才制定单独的回退 SQL。
+4. 在独立测试项目验证旧版查询、媒体关系与 RLS 后，再由项目管理员执行。
+
+这种回退属于数据处置，不作为常规发布步骤，也不应通过应用或自动化脚本直接执行。
+
+## 发布验证
+
+在独立测试环境逐项验证：注册/登录、创建空间、创建公开和私有箱、匿名扫码、跨账号私有访问拒绝、R2 上传与授权下载、删除后的 R2 清理、搜索、物品取出／放回／移动及历史、单箱与批量 PDF、密码重置和 PWA 安装。
+
+本地/CI 浏览器 E2E 使用模拟 Supabase HTTP 响应，不替代上述真实环境冒烟测试。生产发布前记录验证时间、环境、执行人和结果。

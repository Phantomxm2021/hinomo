# 新手引导弹窗与全局多语言实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Dashboard 内嵌的新手卡片改为跨设备只自动出现一次的响应式弹窗，并把整个 Web 系统统一迁移到 `zh-CN / en-US` 全局语言状态。

**Architecture:** 用 `profiles.onboarding_welcome_seen_at` 和幂等 RPC 保存新手弹窗展示状态，用现有业务数据继续计算空间、箱子、物品进度；弹窗复用现有 `ResponsiveEditorDialog`，桌面居中、移动端底部抽屉。用放在 Router/AuthProvider 外层的 `I18nProvider` 管理 `localStorage` 主语言状态，类型化消息字典提供 fallback，登录后用户主动切换时再同步 profile locale 供 AI 会话使用。

**Tech Stack:** React 19、TypeScript、React Router 7、TanStack Query、Supabase/Postgres、Tailwind CSS、Vitest、Testing Library。

---

## 文件地图

新手引导相关文件：

- Create `supabase/migrations/202608080001_onboarding_welcome.sql`：profile 字段和幂等展示 RPC。
- Modify `apps/web/src/lib/database.types.ts`：同步 profiles Row/Insert/Update 和 RPC 类型。
- Modify `apps/web/src/features/profile/profile.api.ts`：增加 `markOnboardingWelcomeSeen`。
- Modify `apps/web/src/features/profile/profile.api.test.ts`：覆盖展示状态 RPC 调用。
- Create `apps/web/src/features/dashboard/onboarding-progress.ts`：从业务数量推导进度和下一步，避免卡片和弹窗重复逻辑。
- Create `apps/web/src/features/dashboard/OnboardingWelcomeDialog.tsx`：首次欢迎和手动重开的弹窗内容。
- Create `apps/web/src/features/dashboard/OnboardingWelcomeDialog.test.tsx`：覆盖布局、操作、焦点和进度。
- Modify `apps/web/src/features/dashboard/DashboardPage.tsx`：删除列表内卡片，增加 profile 状态、自动触发和“新手指南”入口。
- Modify `apps/web/src/features/dashboard/DashboardPage.test.tsx`：更新原有引导断言并增加首次/手动/已完成场景。
- Modify `apps/web/src/index.css`：只补充引导入口和弹窗需要的响应式视觉类。
- Create `supabase/tests/database/017_onboarding_welcome.test.sql`：覆盖字段默认值、RLS 和幂等 RPC。

多语言相关文件：

- Create `apps/web/src/i18n/locale.ts`：`Locale` 类型、storage key、解析和 fallback。
- Create `apps/web/src/i18n/messages.ts`：类型化消息结构和中英文字典导出。
- Create `apps/web/src/i18n/I18nProvider.tsx`：全局语言状态、DOM lang 和持久化。
- Create `apps/web/src/i18n/LocaleProfileSync.tsx`：在认证上下文内把主动切换的界面语言同步给 profile，失败时发出非阻塞反馈。
- Create `apps/web/src/i18n/i18n.test.tsx`：初始化、切换、刷新持久化、fallback 和 DOM lang 测试。
- Create `apps/web/src/components/LanguageSwitcher.tsx` 和测试：所有页面复用的语言选择控件。
- Modify `apps/web/src/app/providers.tsx`：将 `I18nProvider` 放在 AuthProvider 和 Router 外层。
- Modify `apps/web/src/features/marketing/LandingPage.tsx`：删除页面私有语言状态，改用 `useI18n`。
- Modify `apps/web/src/app/AuthLayout.tsx`、认证页和测试：加入共享语言入口并迁移认证文案。
- Modify `apps/web/src/features/legal/LegalDocumentPage.tsx`、测试：政策页面接入全局 locale，同时保留 Markdown 内容双语文件。
- Modify `apps/web/src/app/AppShell.tsx`、`UserAccountMenu.tsx`、`MyPage.tsx`、`GeneralSettingsPage.tsx` 和对应测试：迁移导航、账户菜单和语言设置。
- Modify all files under `apps/web/src/features/{dashboard,spaces,boxes,search,scanner,qr-print,profile,credits,packing,item-movements,items,venues}` that render user-facing strings：迁移页面文案、状态、错误和无障碍标签。
- Modify `apps/web/src/features/auth/auth-errors.ts`：将 Supabase 错误映射改为 locale-aware key。
- Modify AI/profile locale tests and affected backend type tests：确认界面主动切换仍同步 profile locale。

---

## Task 1: 新手引导数据库状态

**Files:**

- Create `supabase/migrations/202608080001_onboarding_welcome.sql`
- Modify `apps/web/src/lib/database.types.ts`
- Modify `apps/web/src/features/profile/profile.api.ts`
- Test `apps/web/src/features/profile/profile.api.test.ts`
- Create `supabase/tests/database/017_onboarding_welcome.test.sql`

- [ ] **Step 1: 写数据库失败测试**

在 SQL 测试中断言新字段可读、普通用户不能读取他人 profile，首次 RPC 写入时间，第二次调用保持第一次时间不变：

```sql
select onboarding_welcome_seen_at
from public.profiles
where id = auth.uid();

select public.mark_onboarding_welcome_seen() is not null;

select public.mark_onboarding_welcome_seen() = (
  select onboarding_welcome_seen_at from public.profiles where id = auth.uid()
);
```

- [ ] **Step 2: 运行 SQL 测试确认失败**

运行 `npm run test:db`。预期数据库测试套件中的 `017_onboarding_welcome.test.sql` 因字段和函数不存在失败。

- [ ] **Step 3: 实现迁移和客户端 API**

迁移使用以下幂等 SQL：

```sql
alter table public.profiles
  add column if not exists onboarding_welcome_seen_at timestamptz;

create or replace function public.mark_onboarding_welcome_seen()
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  seen_at timestamptz;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  insert into public.profiles (id, onboarding_welcome_seen_at)
  values (caller, pg_catalog.now())
  on conflict (id) do update
    set onboarding_welcome_seen_at = coalesce(public.profiles.onboarding_welcome_seen_at, excluded.onboarding_welcome_seen_at),
        updated_at = pg_catalog.now();
  select onboarding_welcome_seen_at into seen_at from public.profiles where id = caller;
  return seen_at;
end;
$$;

revoke all on function public.mark_onboarding_welcome_seen() from public, anon, authenticated;
grant execute on function public.mark_onboarding_welcome_seen() to authenticated;
```

在 `profile.api.ts` 增加：

```ts
export async function markOnboardingWelcomeSeen() {
  const { data, error } = await supabase.rpc('mark_onboarding_welcome_seen')
  if (error) throw error
  return data
}
```

同步把 `onboarding_welcome_seen_at: string | null` 和 RPC 返回类型加入 `database.types.ts`。

- [ ] **Step 4: 运行客户端和数据库测试**

运行 `npm test -- --run src/features/profile/profile.api.test.ts` 与 `npm run test:db`，确认数据库测试套件中的 `017_onboarding_welcome.test.sql` 全部通过。

- [ ] **Step 5: 提交状态层**

```bash
git add supabase/migrations/202608080001_onboarding_welcome.sql supabase/tests/database/017_onboarding_welcome.test.sql apps/web/src/lib/database.types.ts apps/web/src/features/profile/profile.api.ts apps/web/src/features/profile/profile.api.test.ts
git commit -m "feat: persist onboarding welcome state"
```

## Task 2: 提取进度模型并实现响应式引导弹窗

**Files:**

- Create `apps/web/src/features/dashboard/onboarding-progress.ts`
- Create `apps/web/src/features/dashboard/OnboardingWelcomeDialog.tsx`
- Create `apps/web/src/features/dashboard/OnboardingWelcomeDialog.test.tsx`
- Modify `apps/web/src/index.css`

- [ ] **Step 1: 写进度模型和弹窗失败测试**

测试固定三种业务状态：

```ts
expect(getOnboardingProgress({ hasSpace: false, hasBox: false, hasItem: false })).toMatchObject({
  currentStep: 'space', completedCount: 0, actionHref: '/app/spaces?create=1',
})
expect(getOnboardingProgress({ hasSpace: true, hasBox: false, hasItem: false }).actionHref).toBe('/app/boxes?create=1')
expect(getOnboardingProgress({ hasSpace: true, hasBox: true, hasItem: false, firstBoxPublicId: 'box-1' }).actionHref).toBe('/b/box-1')
expect(getOnboardingProgress({ hasSpace: true, hasBox: true, hasItem: true }).isComplete).toBe(true)
```

渲染弹窗时断言 `role="dialog"`、三步进度、主 CTA、关闭按钮和移动抽屉 class；点击 CTA 必须先触发 `onClose` 再调用 `onStart`。

- [ ] **Step 2: 运行测试确认失败**

运行 `npm test -- --run src/features/dashboard/OnboardingWelcomeDialog.test.tsx`，预期因模块尚不存在失败。

- [ ] **Step 3: 实现进度模型和弹窗**

`onboarding-progress.ts` 定义稳定类型：

```ts
export type OnboardingStep = 'space' | 'box' | 'item'
export type OnboardingProgressInput = {
  hasSpace: boolean
  hasBox: boolean
  hasItem: boolean
  firstBoxPublicId?: string
}
export function getOnboardingProgress(input: OnboardingProgressInput) {
  const completedCount = Number(input.hasSpace) + Number(input.hasBox) + Number(input.hasItem)
  const currentStep: OnboardingStep = !input.hasSpace ? 'space' : !input.hasBox ? 'box' : 'item'
  return {
    currentStep,
    completedCount,
    isComplete: input.hasItem,
    actionHref: currentStep === 'space' ? '/app/spaces?create=1' : currentStep === 'box' ? '/app/boxes?create=1' : input.firstBoxPublicId ? `/b/${input.firstBoxPublicId}` : '/app/boxes',
  }
}
```

`OnboardingWelcomeDialog` 使用 `ResponsiveEditorDialog`，`busy` 只在标记展示状态的请求期间为 true；内容区用同一份 steps 渲染桌面列表和移动简版，主按钮调用 `onStart(actionHref)`，关闭按钮调用 `onClose`。通过 `maxWidthClassName` 和 CSS 媒体类保持桌面居中、移动底部抽屉。

- [ ] **Step 4: 运行测试确认通过**

运行 `npm test -- --run src/features/dashboard/OnboardingWelcomeDialog.test.tsx`，预期全部通过。

- [ ] **Step 5: 提交弹窗单元**

```bash
git add apps/web/src/features/dashboard/onboarding-progress.ts apps/web/src/features/dashboard/OnboardingWelcomeDialog.tsx apps/web/src/features/dashboard/OnboardingWelcomeDialog.test.tsx apps/web/src/index.css
git commit -m "feat: add responsive onboarding dialog"
```

## Task 3: 将 Dashboard 从内嵌卡片切换为首次弹窗

**Files:**

- Modify `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify `apps/web/src/features/dashboard/DashboardPage.test.tsx`
- Modify `apps/web/src/features/dashboard/OnboardingProgressCard.tsx` or delete it once no imports remain

- [ ] **Step 1: 写 Dashboard 失败测试**

把现有“区域”断言改为：Dashboard 不存在名为“从一个空间开始”的列表 region；无物品的新账户存在“新手指南”按钮，首次 profile 查询完成后显示 dialog；调用主 CTA 会进入 `/app/spaces?create=1`；有物品账户不渲染自动 dialog。

- [ ] **Step 2: 运行 Dashboard 测试确认失败**

运行 `npm test -- --run src/features/dashboard/DashboardPage.test.tsx`，预期新断言失败，保留原有业务页面断言作为回归基线。

- [ ] **Step 3: 接入 profile 查询和自动展示**

在 Dashboard 增加 `getProfile(user.id)` 查询，使用 TanStack Query key `['profile', user.id]`，只有 venues/spaces/boxes/profile 都完成且 `itemTotal === 0` 时计算自动展示。自动展示的顺序为：`setDialogOpen(true)`，调用 `markOnboardingWelcomeSeen()`，失败时调用 `setSeenError` 但不阻塞业务内容。

“新手指南”按钮使用 `useRef<HTMLButtonElement>` 作为 `returnFocusRef`，手动点击只在未完成基础激活时出现；弹窗 `onStart` 通过 `navigate(actionHref)` 关闭后跳转。

删除 Dashboard 对 `OnboardingProgressCard` 的 JSX 引用和不再需要的组件文件，保留 `onboarding-progress.ts` 供弹窗使用。

- [ ] **Step 4: 运行 Dashboard 回归测试**

运行 `npm test -- --run src/features/dashboard/DashboardPage.test.tsx src/features/dashboard/OnboardingWelcomeDialog.test.tsx`，预期通过，并验证列表布局没有引导卡片。

- [ ] **Step 5: 提交 Dashboard 集成**

```bash
git add apps/web/src/features/dashboard/DashboardPage.tsx apps/web/src/features/dashboard/DashboardPage.test.tsx apps/web/src/features/dashboard/onboarding-progress.ts
git rm apps/web/src/features/dashboard/OnboardingProgressCard.tsx
git commit -m "feat: show onboarding only in first-visit dialog"
```

## Task 4: 建立全局 i18n 核心和字典契约

**Files:**

- Create `apps/web/src/i18n/locale.ts`
- Create `apps/web/src/i18n/messages.ts`
- Create `apps/web/src/i18n/I18nProvider.tsx`
- Create `apps/web/src/i18n/i18n.test.tsx`
- Modify `apps/web/src/app/providers.tsx`

- [ ] **Step 1: 写 i18n 失败测试**

测试 provider 默认中文、切换后 `document.documentElement.lang` 更新、localStorage 保存，以及缺失 key 回退中文：

```tsx
render(<I18nProvider><Probe /></I18nProvider>)
expect(screen.getByText('中文文案')).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: 'English' }))
expect(screen.getByText('English copy')).toBeInTheDocument()
expect(document.documentElement.lang).toBe('en-US')
expect(localStorage.getItem('nomo-locale')).toBe('en-US')
```

- [ ] **Step 2: 运行测试确认失败**

运行 `npm test -- --run src/i18n/i18n.test.tsx`，预期因 provider 和 hook 不存在失败。

- [ ] **Step 3: 实现 locale 和 provider**

核心类型和 API 固定为：

```ts
export type Locale = 'zh-CN' | 'en-US'
export const DEFAULT_LOCALE: Locale = 'zh-CN'
export const LOCALE_STORAGE_KEY = 'nomo-locale'
export function parseLocale(value: string | null): Locale { return value === 'en-US' ? 'en-US' : DEFAULT_LOCALE }
```

`I18nProvider` 暴露 `{ locale, setLocale, t }`，`setLocale` 写入 localStorage、更新 `document.documentElement.lang` 并触发订阅；`t` 接受点号路径和可选插值，当前语言不存在时从中文字典取值，仍不存在才返回 key 并在开发环境 `console.warn`。provider 在 `AppProviders` 中包住 `AuthProvider` 和 `RouterProvider`。

- [ ] **Step 4: 填充第一批字典**

先加入 AppShell、认证页、落地页、语言控件、法律页、新手弹窗所需的完整 key，并让两种字典拥有同一类型结构；不允许在组件中再写对应的中英文分支。

- [ ] **Step 5: 运行核心测试并提交**

运行 `npm test -- --run src/i18n/i18n.test.tsx`、`npm run typecheck`，确认通过后提交：

```bash
git add apps/web/src/i18n apps/web/src/app/providers.tsx
git commit -m "feat: add global locale provider"
```

## Task 5: 创建共享语言切换器并接入公共/认证页面

**Files:**

- Create `apps/web/src/components/LanguageSwitcher.tsx`
- Create `apps/web/src/components/LanguageSwitcher.test.tsx`
- Modify `apps/web/src/features/marketing/LandingPage.tsx`
- Modify `apps/web/src/app/AuthLayout.tsx`
- Modify `apps/web/src/features/auth/LoginPage.tsx`
- Modify `apps/web/src/features/auth/RegisterPage.tsx`
- Modify `apps/web/src/features/auth/ForgotPasswordPage.tsx`
- Modify `apps/web/src/features/auth/ResetPasswordPage.tsx`
- Modify `apps/web/src/features/legal/LegalDocumentPage.tsx`
- Modify corresponding tests and `apps/web/src/index.css`

- [ ] **Step 1: 写语言切换器和公共页面失败测试**

断言切换器渲染两个 option/button、设置 locale 只调用回调一次；落地页、认证页和政策页在 English 下不再出现中文标题，页面 `lang` 为 `en-US`。

- [ ] **Step 2: 运行测试确认失败**

运行 `npm test -- --run src/components/LanguageSwitcher.test.tsx src/app/RootEntry.test.tsx src/app/AuthLayout.test.tsx src/features/legal/LegalDocumentPage.test.tsx`，记录迁移前失败断言。

- [ ] **Step 3: 实现共享切换器和文案迁移**

`LanguageSwitcher` 只接收 `{ locale, onChange, compact? }`，使用稳定的 `aria-label="选择语言"` / English 版本翻译 key，不读取 AuthContext。LandingPage 删除 `Language` 本地状态和 `nomo-landing-language` key，改为 `useI18n`；法律页用全局 locale，不再单独管理 `?lang`，保留 URL 参数作为首次进入时的兼容输入并在切换时同步 localStorage。

AuthLayout 在桌面和移动都放置切换器；认证表单、placeholder、校验错误和链接文案均改为 `t`。法律 Markdown 仍按 locale 选择 raw 内容，页面标题和控件文案改用 `t`。

- [ ] **Step 4: 运行公共和认证回归测试**

运行 `npm test -- --run src/components/LanguageSwitcher.test.tsx src/app/RootEntry.test.tsx src/app/AuthLayout.test.tsx src/features/auth/LoginPage.test.tsx src/features/auth/RegisterPage.test.tsx src/features/auth/ForgotPasswordPage.test.tsx src/features/auth/ResetPasswordPage.test.tsx src/features/legal/LegalDocumentPage.test.tsx`。

- [ ] **Step 5: 提交公共页面迁移**

```bash
git add apps/web/src/components/LanguageSwitcher.tsx apps/web/src/components/LanguageSwitcher.test.tsx apps/web/src/features/marketing/LandingPage.tsx apps/web/src/app/AuthLayout.tsx apps/web/src/features/auth apps/web/src/features/legal apps/web/src/index.css
git commit -m "feat: localize public and auth experiences"
```

## Task 6: AppShell、账户设置和 profile locale 同步

**Files:**

- Modify `apps/web/src/app/AppShell.tsx`
- Modify `apps/web/src/features/profile/UserAccountMenu.tsx`
- Modify `apps/web/src/features/profile/MyPage.tsx`
- Modify `apps/web/src/features/profile/GeneralSettingsPage.tsx`
- Modify `apps/web/src/features/profile/profile.api.ts`
- Modify `apps/web/src/i18n/LocaleProfileSync.tsx`
- Modify affected profile tests

- [ ] **Step 1: 写失败测试**

在 AppShell 测试中切换 English 后断言桌面导航和移动导航均显示英文；在 GeneralSettingsPage 中断言切换调用 `updateLocale('en-US')`、localStorage 同步、profile RPC 失败只显示非阻塞错误；UserAccountMenu 和 MyPage 的菜单、退出确认、Credits 文案跟随 locale。

- [ ] **Step 2: 运行测试确认失败**

运行 `npm test -- --run src/app/AppShell.test.tsx src/features/profile/UserAccountMenu.test.tsx src/features/profile/MyPage.test.tsx src/features/profile/GeneralSettingsPage.test.tsx src/features/profile/profile.api.test.ts`。

- [ ] **Step 3: 实现切换和同步**

`LanguageSwitcher` 的 `onChange` 只执行 `setLocale(nextLocale)`。新增 `LocaleProfileSync` 放在 `AuthProvider` 内部，监听 locale 和当前用户：跳过首次无用户渲染，用户存在时调用 `updateLocale(locale)`；失败时通过 `useMobileFeedback` 显示 `t('settings.languageSaveFailed')`，不把界面恢复为旧语言。所有导航 label、账户菜单、设置页和 ConfirmDialog 使用字典 key。

- [ ] **Step 4: 运行 profile 回归测试**

运行同一组测试加 `npm run typecheck`，预期全通过。

- [ ] **Step 5: 提交 AppShell 迁移**

```bash
git add apps/web/src/app/AppShell.tsx apps/web/src/features/profile apps/web/src/components/LanguageSwitcher.tsx
git commit -m "feat: localize app navigation and account settings"
```

## Task 7: Dashboard、空间、箱子、搜索和业务枚举迁移

**Files:**

- Modify all user-facing JSX in `apps/web/src/features/dashboard`, `spaces`, `boxes`, and `search`.
- Modify `apps/web/src/features/dashboard/onboarding-progress.ts` and `OnboardingWelcomeDialog.tsx` to consume `t`.
- Modify tests in the same feature folders.

- [ ] **Step 1: 建立失败覆盖清单**

在每个 feature 的核心测试中增加 English render 断言，覆盖页面标题、导航链接、空状态、表单按钮、加载文案、筛选器和引导弹窗；用 `getByRole` / `getByLabelText` 取翻译后的可访问文本，避免测试依赖内部 class。

- [ ] **Step 2: 运行测试确认遗漏**

运行 `npm test -- --run src/features/dashboard src/features/spaces src/features/boxes src/features/search`，记录所有硬编码中文导致的失败。

- [ ] **Step 3: 迁移页面和业务枚举**

将固定文案替换为 `const { t } = useI18n()`；把状态值、可见性、排序和分类等稳定枚举映射为 `t('enum.visibility.private')` 等 key，数据库仍保存原英文 key。用户内容字段直接渲染，不经过翻译函数。引导弹窗的三步标题、说明、按钮和 aria 标签全部从字典读取。

- [ ] **Step 4: 运行核心业务回归测试**

运行 `npm test -- --run src/features/dashboard src/features/spaces src/features/boxes src/features/search`、`npm run typecheck`、`npm run lint`。

- [ ] **Step 5: 提交核心业务迁移**

```bash
git add apps/web/src/features/dashboard apps/web/src/features/spaces apps/web/src/features/boxes apps/web/src/features/search
git commit -m "feat: localize storage and search workflows"
```

## Task 8: 扫码、打印、装箱、物品、场地、额度和错误体系迁移

**Files:**

- Modify user-facing components under `scanner`, `qr-print`, `packing`, `items`, `item-movements`, `venues`, and `credits`.
- Modify `apps/web/src/features/auth/auth-errors.ts` and all tests asserting error text.
- Modify `apps/web/src/components/PageState.tsx`, `ResponsiveOperationError.tsx`, `MobileAlert.tsx`, `MobileActionSheet.tsx`, and tests where shared defaults are user-facing.

- [ ] **Step 1: 写失败测试**

为每个路由增加一组 English smoke assertions，覆盖扫描权限/空状态、打印操作、AI 装箱阶段、物品编辑、场地编辑、credits 购买状态和认证错误；检查所有 `aria-label` 与 toast 也同步变化。

- [ ] **Step 2: 运行测试确认失败**

运行 `npm test -- --run src/features/scanner src/features/qr-print src/features/packing src/features/items src/features/item-movements src/features/venues src/features/credits src/components/PageState.test.tsx src/components/MobileAlert.test.tsx`。

- [ ] **Step 3: 迁移文案和错误 key**

`getAuthErrorMessage(error, locale)` 返回翻译 key 对应的当前语言文本；通用组件不再接收默认中文字符串，而是从 `useI18n` 读取。AI 业务结果的名称、类别、说明保持后端输出，不由 UI 翻译；阶段名、操作按钮和网络错误由 UI 字典翻译。

- [ ] **Step 4: 运行完整前端测试**

运行 `npm test -- --run src/features src/components`、`npm run typecheck`、`npm run lint`，修复剩余硬编码用户文案后再继续。

- [ ] **Step 5: 提交剩余页面迁移**

```bash
git add apps/web/src/features apps/web/src/components
git commit -m "feat: complete application localization"
```

## Task 9: 双语覆盖检查、构建和端到端验收

**Files:**

- Create `apps/web/src/i18n/messages.test.ts`：递归比较中英文 key 集合和值非空。
- Modify `apps/web/src/visual-system.test.ts`：增加两种语言下的全局 typography/overflow 断言，不改变已有业务断言。
- Modify `apps/web/e2e/core-flow.spec.ts`：加入切换 English、首次弹窗关闭、手动重开和移动视口检查。
- Modify `docs/onboarding-plan.md`：记录新手卡片下线、弹窗和全局语言状态。

- [ ] **Step 1: 写字典完整性测试**

递归收集中英文消息 key，断言集合相等、每个叶子值为非空字符串，并断言 `parseLocale` 对未知值回退 `zh-CN`。

- [ ] **Step 2: 运行字典和全局测试确认失败**

运行 `npm test -- --run src/i18n/messages.test.ts src/visual-system.test.ts`，先修复遗漏 key 和空值。

- [ ] **Step 3: 实现 E2E 验收场景**

E2E 使用已登录 mock 用户：首次 `/app` 等待 dialog，点击关闭后刷新不再自动弹出，点击“新手指南”再次打开；在 390px 视口断言底部抽屉无横向溢出；切换 English 后导航、标题和弹窗文案均为英文。

- [ ] **Step 4: 运行完整验证**

运行：

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

同时执行 `git diff --check`，确认 Vite 仅报告已有的大 chunk warning，不新增编译错误。

- [ ] **Step 5: 更新文档并提交验收**

```bash
git add apps/web/src/i18n apps/web/src/visual-system.test.ts apps/web/e2e/core-flow.spec.ts docs/onboarding-plan.md
git commit -m "test: verify onboarding and global localization"
```

## 执行注意事项

- 每个任务只提交对应文件，不要把工作区中已有的 credits、AI worker、Box toolbar 或部署文档改动带入提交。
- Supabase 迁移和 SQL 测试如果需要真实项目状态，只做本地或测试环境验证，不对生产环境执行 `supabase db push`。
- 任何新增用户界面文案必须同时添加两种语言，不能先提交中文再补英文。
- 先完成 Task 1–3 再开始 Task 4–8；Task 4 建立的字典 key 命名是后续页面迁移的契约。

# 桌面端语言入口与设置弹窗 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除桌面侧栏重复语言入口，并把设置路由在桌面端改为居中弹窗，同时保持移动端页面式设置与现有语言切换功能。

**Architecture:** `AppShell` 不再渲染 `LanguageSwitcher`；语言选择器只由 `GeneralSettingsPage` 持有。设置路由继续使用现有 URL，但根据 `useMediaQuery('(min-width: 1024px)')` 在桌面渲染 `ResponsiveEditorDialog`，在移动渲染原页面内容；设置列表和通用设置分别抽取可复用 panel，避免桌面/移动复制文案和交互逻辑。

**Tech Stack:** React 19、React Router、Tailwind CSS、Vitest、Testing Library、现有 `ResponsiveEditorDialog` 和全局 `I18nProvider`。

---

### Task 1: 移除桌面侧栏语言选择器

**Files:**

- Modify: `apps/web/src/app/AppShell.tsx`
- Modify: `apps/web/src/app/AppShell.test.tsx`
- Modify: `apps/web/src/components/LanguageSwitcher.test.tsx` only if its standalone contract needs no changes

- [ ] **Step 1: 写失败测试**

在 `AppShell.test.tsx` 增加回归断言，确认桌面侧栏没有语言 combobox，但账户菜单仍有“设置”入口：

```tsx
test('keeps language selection inside settings instead of the desktop sidebar', async () => {
  renderShell()

  const sidebar = screen.getByRole('complementary')
  expect(within(sidebar).queryByRole('combobox', { name: '语言' })).not.toBeInTheDocument()

  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: '打开账户菜单' }))
  expect(screen.getByRole('menuitem', { name: /设置/ })).toHaveAttribute('href', '/app/me/settings')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run apps/web/src/app/AppShell.test.tsx`

Expected: FAIL because the existing desktop sidebar still renders the `语言` combobox.

- [ ] **Step 3: 最小实现**

从 `AppShell.tsx` 移除 `LanguageSwitcher` import、`locale/setLocale` 解构和品牌区的 `<LanguageSwitcher ... />`，保留 `t`、导航和 `UserAccountMenu`。不要修改 `GeneralSettingsPage` 中已有的语言选择器。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run apps/web/src/app/AppShell.test.tsx apps/web/src/components/LanguageSwitcher.test.tsx`

Expected: PASS，桌面侧栏无 combobox，独立 LanguageSwitcher 测试仍通过。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/app/AppShell.tsx apps/web/src/app/AppShell.test.tsx
git commit -m "fix: keep language selection in settings"
```

### Task 2: 增加响应式设置路由容器

**Files:**

- Create: `apps/web/src/lib/use-media-query.ts`
- Create: `apps/web/src/lib/use-media-query.test.ts`
- Modify: `apps/web/src/components/ResponsiveEditorDialog.tsx`
- Modify: `apps/web/src/components/ResponsiveEditorDialog.test.tsx`

- [ ] **Step 1: 写失败测试**

新增 `use-media-query` 测试，覆盖初始 `matchMedia().matches` 和媒体变化；在 `ResponsiveEditorDialog.test.tsx` 增加焦点回退测试：没有传 `returnFocusRef` 时，关闭弹窗应把焦点还给打开前的活动元素。

```tsx
test('restores the element that was focused before opening when no ref is supplied', async () => {
  const trigger = document.createElement('button')
  document.body.append(trigger)
  trigger.focus()
  const { rerender } = render(<ResponsiveEditorDialog open title="编辑" busy={false} onClose={vi.fn()}><button>内容</button></ResponsiveEditorDialog>)
  rerender(<ResponsiveEditorDialog open={false} title="编辑" busy={false} onClose={vi.fn()}><button>内容</button></ResponsiveEditorDialog>)
  await waitFor(() => expect(document.activeElement).toBe(trigger))
  trigger.remove()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run apps/web/src/lib/use-media-query.test.ts apps/web/src/components/ResponsiveEditorDialog.test.tsx`

Expected: FAIL because the current dialog only restores focus when `returnFocusRef` is supplied and the new media-query hook/test do not exist yet.

- [ ] **Step 3: 实现媒体查询与焦点回退**

在 `use-media-query.ts` 提供：

```ts
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [query])
  return matches
}
```

在 `ResponsiveEditorDialog` 打开时记录 `document.activeElement`，关闭时优先恢复 `returnFocusRef.current`，否则恢复记录的元素；保持 `aria-modal`、Escape、body overflow 和既有调用方行为不变。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run apps/web/src/lib/use-media-query.test.ts apps/web/src/components/ResponsiveEditorDialog.test.tsx`

Expected: PASS，原有焦点陷阱和新增焦点回退都通过。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/lib/use-media-query.ts apps/web/src/lib/use-media-query.test.ts apps/web/src/components/ResponsiveEditorDialog.tsx apps/web/src/components/ResponsiveEditorDialog.test.tsx
git commit -m "feat: support responsive settings dialog behavior"
```

### Task 3: 抽取设置内容并桌面弹窗化

**Files:**

- Create: `apps/web/src/features/profile/SettingsPanel.tsx`
- Create: `apps/web/src/features/profile/GeneralSettingsPanel.tsx`
- Modify: `apps/web/src/features/profile/SettingsPage.tsx`
- Modify: `apps/web/src/features/profile/GeneralSettingsPage.tsx`
- Modify: `apps/web/src/features/profile/SettingsPage.test.tsx`
- Modify: `apps/web/src/features/profile/GeneralSettingsPage.test.tsx`

- [ ] **Step 1: 写失败测试**

在设置页测试中 mock `window.matchMedia` 为桌面并断言真实 dialog、标题、列表和关闭行为；在通用设置测试中断言桌面 dialog 内只有一个语言选择器；在移动测试中断言保持页面式导航：

```tsx
test('renders settings as a desktop dialog and keeps language selection only in general settings', async () => {
  mockMatchMedia(true)
  const user = userEvent.setup()
  renderSettings('/app/me/settings')

  const dialog = screen.getByRole('dialog', { name: '设置' })
  expect(dialog).toHaveClass('lg:rounded-shell')
  expect(within(dialog).getByRole('link', { name: /通用.*语言与地区/ })).toHaveAttribute('href', '/app/me/settings/general')
  expect(within(dialog).queryByRole('combobox', { name: '语言' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '关闭设置' }))
  expect(screen.queryByRole('dialog', { name: '设置' })).not.toBeInTheDocument()
})

test('renders the general language selector once inside the desktop dialog', () => {
  mockMatchMedia(true)
  renderGeneralSettings()
  const dialog = screen.getByRole('dialog', { name: '通用' })
  expect(within(dialog).getAllByRole('combobox', { name: '语言' })).toHaveLength(1)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run apps/web/src/features/profile/SettingsPage.test.tsx apps/web/src/features/profile/GeneralSettingsPage.test.tsx`

Expected: FAIL because both routes currently render normal page sections and desktop `SettingsPage` has no `role="dialog"`.

- [ ] **Step 3: 抽取可复用 panel**

将现有设置列表内容移动到 `SettingsPanel.tsx`，提供 `presentation: 'page' | 'dialog'`，页面模式保留移动返回导航，dialog 模式只渲染内容列表；将通用语言区域移动到 `GeneralSettingsPanel.tsx`，保留 `useAuth`、`useI18n`、locale 保存反馈和唯一 `LanguageSwitcher`。

- [ ] **Step 4: 接入桌面/移动分支**

两个路由页面使用 `useMediaQuery('(min-width: 1024px)')`：

```tsx
const isDesktop = useMediaQuery('(min-width: 1024px)')
if (isDesktop) {
  return <ResponsiveEditorDialog open title={t('settings.title')} busy={false} onClose={() => navigate(-1)} maxWidthClassName="max-w-2xl"><SettingsPanel presentation="dialog" /></ResponsiveEditorDialog>
}
return <SettingsPanel presentation="page" />
```

`GeneralSettingsPage` 使用 `t('settings.general')` 作为 dialog 标题，移动端仍显示页面 header 和返回按钮。桌面弹窗关闭使用 `navigate(-1)`，浏览器返回和深链接继续有效；设置列表/通用页均不在 AppShell 或账户菜单重复渲染语言选择器。

- [ ] **Step 5: 运行设置回归测试**

Run: `npm test -- --run apps/web/src/features/profile/SettingsPage.test.tsx apps/web/src/features/profile/GeneralSettingsPage.test.tsx apps/web/src/app/AppShell.test.tsx apps/web/src/components/ResponsiveEditorDialog.test.tsx`

Expected: PASS，桌面设置和通用设置为 dialog，移动仍为 page，且只有通用设置内一个语言选择器。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/features/profile/SettingsPanel.tsx apps/web/src/features/profile/GeneralSettingsPanel.tsx apps/web/src/features/profile/SettingsPage.tsx apps/web/src/features/profile/GeneralSettingsPage.tsx apps/web/src/features/profile/SettingsPage.test.tsx apps/web/src/features/profile/GeneralSettingsPage.test.tsx
git commit -m "feat: render desktop settings as dialog"
```

### Task 4: 全量验证与验收

**Files:**

- Modify: only tests if a regression assertion needs updating; do not change unrelated product copy.

- [ ] **Step 1: 运行全量验证**

Run:

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: all Vitest files pass; typecheck, lint, build and diff check exit 0. Existing Vite environment/chunk warnings may remain.

- [ ] **Step 2: 复核桌面/移动验收点**

确认：AppShell 侧栏没有语言 combobox；`/app/me/settings` 和 `/app/me/settings/general` 在桌面有居中 dialog；移动端保持页面导航；GeneralSettings 内只有一个 `LanguageSwitcher`；关闭后浏览器返回和焦点恢复可用。

- [ ] **Step 3: 提交最终验收**

```bash
git status --short
git log -4 --oneline
```

Expected: only the pre-existing untracked `supabase/functions/billing-checkout/index_test.ts` remains outside this change; feature worktree is clean.

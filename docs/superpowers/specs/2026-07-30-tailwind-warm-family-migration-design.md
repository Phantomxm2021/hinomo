# Nomo Tailwind「温暖家庭」迁移设计

日期：2026-07-30

状态：已确认方案，待书面审阅

关联设计：`docs/superpowers/specs/2026-07-30-warm-family-ui-redesign-design.md`

## 1. 目标

用 Tailwind CSS v4 将当前黑紫主题和单体 `index.css` 逐步替换为已确认的「温暖家庭」视觉系统，同时保留现有 React 组件、Supabase 数据流、公开/私有权限、Cloudflare R2 媒体链路、扫码和 PDF 生成逻辑。

迁移结束后，页面呈现只使用一套视觉来源：Tailwind 主题令牌与由令牌组成的静态工具类。旧主题、自动深色模式、紫色渐变和已废弃的页面选择器全部删除，不保留长期双轨样式。

## 2. 当前基础与问题

项目已经安装并在 Vite 中注册 Tailwind v4：

- `tailwindcss`
- `@tailwindcss/vite`
- `tailwindcss()` Vite 插件

当前尚未在样式入口导入 Tailwind。页面主要依赖超过千行的 `index.css`，其中仍包含：

- `prefers-color-scheme: dark` 自动黑紫主题；
- 紫色 `--accent`、认证页渐变和 PDF 标签颜色；
- 旧快捷卡片等失效选择器；
- 与设计稿不一致的 767px 壳层断点和 980px 内容宽度；
- 页面级和组件级样式相互覆盖。

因此本次不采用“新页面用 Tailwind、旧页面永久保留 CSS”的混合方案。

## 3. 技术方案

### 3.1 Tailwind 入口与主题

`apps/web/src/index.css` 保留为唯一入口，首行引入：

```css
@import "tailwindcss";
```

使用 Tailwind v4 `@theme` 定义语义化令牌：

```css
@theme {
  --color-canvas: #f8f2e8;
  --color-surface: #fffdf8;
  --color-sidebar: #f0e3d3;
  --color-ink: #30271e;
  --color-muted: #756a5e;
  --color-brand: #df6538;
  --color-brand-strong: #c95229;
  --color-success: #71896f;
  --color-danger: #b42318;
  --color-line: #e3d5c5;
  --color-placeholder: #ead7c2;

  --radius-control: 0.875rem;
  --radius-card: 1.25rem;
  --radius-shell: 1.5rem;

  --shadow-float: 0 18px 44px rgb(86 58 36 / 16%);
  --shadow-soft: 0 8px 24px rgb(86 58 36 / 8%);

  --breakpoint-lg: 64rem;
}
```

颜色名描述用途而非具体色相。组件使用 `bg-canvas`、`text-ink`、`bg-brand`、`border-line` 等类，禁止在 JSX 中散落紫色或临时十六进制值。

### 3.2 明暗主题策略

本轮只实现设计稿确认的暖色浅色主题。删除自动深色媒体查询，避免操作系统深色偏好把产品切回黑紫界面。未来需要深色模式时，必须另行定义完整的语义令牌映射并经过设计确认。

### 3.3 样式职责

Tailwind 工具类负责：

- 布局、网格、间距与响应式；
- 色彩、边框、圆角与阴影；
- 字体层级；
- hover、focus-visible、disabled 和 selected 状态；
- 页面和普通组件的视觉呈现。

`index.css` 最终只保留：

- Tailwind 导入和 `@theme`；
- `@layer base` 中的最小 reset、系统字体和全局背景；
- iOS/Android 安全区辅助；
- `prefers-reduced-motion`；
- PDF/打印媒体规则；
- 无法用单个工具类表达、且确有复用价值的极少量自定义 utility。

不使用大段 `@apply` 重建另一套组件 CSS。重复的视觉组合通过 React 组件边界解决，例如 `BoxCard`、`ItemRow`、`PageState`，而不是通过全局复合选择器解决。

### 3.4 类名约束

- 使用完整静态类名，避免 `bg-${color}` 等运行时拼接，防止生产构建漏扫。
- 柔和色块使用显式映射对象，映射值是完整 Tailwind 类字符串。
- 任意值只用于安全区、精确网格或设计稿确有要求的尺寸；有语义的值进入 `@theme`。
- 图标继续使用现有 `AppIcon`，颜色和尺寸由 Tailwind 类或 `size` 属性控制。

## 4. 响应式布局

采用移动优先：

- 320–767px：移动单列，箱子在足够宽时双列；
- 768–1023px：平板布局，继续使用移动底部导航；
- 1024px 及以上：240px 固定侧栏和桌面内容区；
- 主内容最大宽度统一为 1280px；
- 固定导航与粘性操作继续避让 `env(safe-area-inset-bottom)`；
- 320px 宽度不得出现水平滚动。

桌面扫描按钮只出现在首页搜索框右侧。移动端扫描入口只使用底部导航中央的抬高按钮。

## 5. 组件迁移边界

### 5.1 第一阶段：视觉基础与已完成页面

优先迁移：

- `AppShell` 与导航；
- `GlobalFindBar`；
- `DashboardPage`；
- `SpacesPage`；
- `ConfirmDialog` 和空间编辑器浮层。

该阶段立即消除用户当前看到的黑紫主题，并将断点修正到 1024px。已完成的查询、表单、焦点管理、删除保护和路由逻辑保持不变。

### 5.2 第二阶段：箱子与详情

- 箱子筛选和图片网格；
- 箱子详情 `BoxHero`；
- 紧凑物品行；
- 数量步进器；
- 移动端粘性新增/保存操作。

迁移展示层时不改 R2 上传重试语义、匿名公开查看和所有者操作判断。

### 5.3 第三阶段：搜索、打印与认证

- URL 驱动的物品/箱子分组搜索；
- 桌面标签选择与真实二维码预览；
- 移动单标签下载；
- 暖色认证布局；
- 扫描器、创建/编辑箱子等剩余页面的视觉统一。

### 5.4 第四阶段：状态与旧 CSS 清理

- 统一 `PageState`、真实重试按钮和离线提示；
- 表单 `aria-invalid` / `aria-describedby`；
- 删除旧页面选择器、自动深色主题和兼容别名；
- 确认 `index.css` 不再包含 `.quick-actions` 等废弃规则。

## 6. Tailwind 之外的颜色同步

以下内容不由 Tailwind 工具类渲染，必须同步迁移：

- `vite.config.ts` PWA `theme_color` → `#df6538`；
- PWA `background_color` → `#f8f2e8`；
- `features/qr-print/pdf.ts` Canvas 标签边框、文字和编号颜色；
- 必要的 `meta[name="theme-color"]`。

这些改动只改变呈现颜色，不改变 PWA、二维码 URL、分页或 PDF 下载行为。

## 7. 可访问性与状态

- 所有可交互目标最小 44×44px；
- 图标按钮必须有可访问名称和视觉提示；
- `focus-visible` 使用清晰的陶土橙外环，不以取消 outline 代替；
- 公开/私有、错误、成功和选中状态使用图标或文字，不只靠颜色；
- 浮层继续保留 portal、inert、滚动锁、焦点进入/循环/恢复；
- 固定操作不遮挡正文和系统安全区；
- 支持 `prefers-reduced-motion`。

## 8. 测试与迁移门禁

每一阶段必须：

1. 先更新行为或视觉契约测试并观察失败；
2. 迁移页面，不改变业务 API；
3. 运行定向测试、全量 Vitest、typecheck、lint 和 build；
4. 删除本阶段对应的旧 CSS，禁止只覆盖不清理；
5. 用 Chrome 检查 1440×900、390×844 和 360×800；
6. 检查 768px 与 1024px 断点；
7. 提交独立、可回滚的阶段性 commit。

最终验收包含三设备 Playwright。当前因新标题和空间弹窗交互而失效的旧 E2E 选择器，需要在迁移结束时更新；测试不得继续依赖旧模板文案或常驻表单。

## 9. 非目标

- 不引入新的组件库或图标依赖；
- 不改 Supabase schema、RPC、trigger 或权限策略；
- 不改 R2 签名、上传、确认或授权读取协议；
- 不新增深色模式、主题编辑器或用户自定义配色；
- 不为追求复用创建庞大的 Tailwind 封装层。

## 10. 完成标准

- 当前黑紫界面和自动深色主题完全消失；
- 所有现有页面使用同一暖色 Tailwind 令牌；
- 桌面、平板和移动布局与设计规范一致；
- `index.css` 只保留约定的全局职责；
- PWA 与 PDF 不再使用旧紫色；
- 权限、R2、扫码和 PDF 功能无回归；
- 设计矩阵中配色、样式、布局、功能均无 Critical/Important 差异；
- Vitest、lint、typecheck、build、三设备 E2E 和 Chrome 视觉检查全部通过。

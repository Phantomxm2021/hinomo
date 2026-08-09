import { expect, test } from '@playwright/test'
import { createBox, createMockState, createSpace, installMockBackend, register } from './mock-backend'

async function expectNoHorizontalOverflow(page: Parameters<typeof installMockBackend>[0]) {
  await expect.poll(() => page.evaluate(() => {
    const root = document.documentElement
    const overflowing = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.right > root.clientWidth + 0.5 || rect.left < -0.5
      })
      .slice(0, 8)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`)
    return {
      url: location.pathname,
      hasOverflow: root.scrollWidth > root.clientWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      overflowing,
    }
  })).toMatchObject({
    hasOverflow: false,
    clientWidth: expect.any(Number),
    scrollWidth: expect.any(Number),
    overflowing: [],
  })
}

async function expectDesktopNavigation(page: Parameters<typeof installMockBackend>[0]) {
  await expect(page.getByRole('complementary')).toBeVisible()
  await expect(page.getByRole('navigation', { name: '移动端主导航' })).toBeHidden()
  await expect(page.getByRole('link', { name: '扫码查看' })).toBeVisible()
}

async function expectMobileNavigation(page: Parameters<typeof installMockBackend>[0]) {
  await expect(page.getByRole('complementary')).toBeHidden()
  const navigation = page.getByRole('navigation', { name: '移动端主导航' })
  await expect(navigation).toBeVisible()
  await expect(navigation.getByRole('link')).toHaveCount(5)
  await expect(navigation.getByRole('link', { name: '扫码' })).toBeVisible()
  await expect(page.getByRole('link', { name: '扫码查看' })).toBeHidden()
}

async function expectBoxDetailTitle(page: Parameters<typeof installMockBackend>[0], name: string, mobile: boolean) {
  const mobileNavigation = page.getByRole('navigation', { name: '箱子详情导航' })
  if (mobile) {
    await expect(mobileNavigation.getByText(`${name} · 箱子详情`, { exact: true })).toBeVisible()
    return
  }
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}

async function expectRouteFrame(
  page: Parameters<typeof installMockBackend>[0],
  expectShell: boolean,
  desktop: boolean,
) {
  await expectNoHorizontalOverflow(page)
  await expect(page.getByRole('link', { name: '我的收纳空间' })).toHaveCount(0)

  const shell = page.locator('[data-app-shell]')
  if (!expectShell) {
    await expect(shell).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: '移动端主导航' })).toHaveCount(0)
    await expect(page.getByRole('complementary')).toHaveCount(0)
    return
  }

  await expect(shell).toHaveCount(1)
  if (desktop) {
    const sidebar = shell.getByRole('complementary')
    await expect(sidebar).toBeVisible()
    await expect(sidebar.getByRole('navigation', { name: '主导航' })).toBeVisible()
    await expect(shell.getByRole('navigation', { name: '移动端主导航' })).toBeHidden()
    await expect(shell.getByRole('banner')).toBeHidden()
    await expect(sidebar.getByRole('link', { name: 'Nomo' })).toHaveAttribute('href', '/app')
    return
  }

  await expect(shell.getByRole('complementary')).toBeHidden()
  const banner = shell.getByRole('banner')
  if (await banner.count()) await expect(banner.getByRole('link', { name: 'Nomo' })).toHaveAttribute('href', '/app')
  const navigation = shell.getByRole('navigation', { name: '移动端主导航' })
  await expect(navigation).toBeVisible()
  await expect.poll(async () => {
    const mainPadding = await shell.getByRole('main').evaluate((main) => Number.parseFloat(getComputedStyle(main).paddingBottom))
    const navigationHeight = await navigation.evaluate((nav) => nav.getBoundingClientRect().height)
    return mainPadding >= navigationHeight
  }).toBe(true)
}

async function openNewItem(page: Parameters<typeof installMockBackend>[0]) {
  const desktopAction = page.getByRole('button', { name: '新增物品', exact: true })
  const desktopLayout = await page.evaluate(() => window.matchMedia('(min-width: 1024px)').matches)
  if (desktopLayout) {
    await expect(desktopAction).toBeVisible()
    await desktopAction.click()
    return
  }
  await page.getByRole('button', { name: '打开箱子操作菜单' }).click()
  await page.getByRole('dialog', { name: '箱子操作' }).getByRole('button', { name: '新增物品' }).click()
}

async function expectItemFormActionClearance(page: Parameters<typeof installMockBackend>[0], safeAreaBottom: number) {
  await openNewItem(page)
  await expect(page.getByRole('heading', { name: '新增物品' })).toBeVisible()
  const dialog = page.getByRole('dialog', { name: '新增物品' })
  const scrollContainer = dialog
  const actionBar = page.getByRole('button', { name: '保存' }).locator('..')
  await page.evaluate((inset) => {
    document.documentElement.style.setProperty('--safe-area-bottom', `${inset}px`)
  }, safeAreaBottom)
  try {
    await scrollContainer.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
    await expect.poll(async () => {
      const geometry = await actionBar.evaluate((element) => ({
        bottom: element.getBoundingClientRect().bottom,
        viewportHeight: window.innerHeight,
      }))
      return Math.abs(geometry.viewportHeight - geometry.bottom - Math.max(16, safeAreaBottom)) <= 1
    }).toBe(true)
    await expect.poll(async () => {
      const actionTop = await actionBar.evaluate((element) => element.getBoundingClientRect().top)
      const lastFieldBottom = await page.getByLabel('描述（可选）').evaluate((element) => element.getBoundingClientRect().bottom)
      return lastFieldBottom <= actionTop
    }).toBe(true)
  } finally {
    await page.evaluate(() => document.documentElement.style.removeProperty('--safe-area-bottom'))
  }
}

async function expectShellSafeArea(page: Parameters<typeof installMockBackend>[0], safeAreaBottom: number) {
  await page.evaluate((inset) => {
    document.documentElement.style.setProperty('--safe-area-bottom', `${inset}px`)
  }, safeAreaBottom)
  try {
    await expect(page.getByRole('navigation', { name: '移动端主导航' })).toHaveCSS('padding-bottom', `${safeAreaBottom}px`)
    await expect(page.getByRole('main')).toHaveCSS('padding-bottom', `${128 + safeAreaBottom}px`)
  } finally {
    await page.evaluate(() => document.documentElement.style.removeProperty('--safe-area-bottom'))
  }
}

test('owner creates, finds, labels, and maintains a public box', async ({ browser, page }, testInfo) => {
  const state = createMockState()
  await installMockBackend(page, state)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '收起来。也找得回来。' })).toBeVisible()
  await register(page, 'owner@example.com', false)
  await expect(page.getByRole('heading', { name: /^(早上好|中午好|下午好|晚上好)，今天找什么？$/ })).toBeVisible()
  const welcomeDialog = page.getByRole('dialog', { name: '开始使用 Nomo' })
  await expect(welcomeDialog).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await welcomeDialog.getByRole('button', { name: '关闭开始使用 Nomo' }).click()
  await expect(welcomeDialog).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: '新手指南' })).toBeVisible()
  await expect(welcomeDialog).toHaveCount(0)
  await page.getByRole('button', { name: '新手指南' }).click()
  await expect(welcomeDialog).toBeVisible()
  await welcomeDialog.getByRole('button', { name: '关闭开始使用 Nomo' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '新手指南' }).click()
  await expect(welcomeDialog).toBeVisible()
  await expectNoHorizontalOverflow(page)
  const welcomeGeometry = await welcomeDialog.evaluate((dialog) => {
    const rect = dialog.getBoundingClientRect()
    return { left: rect.left, right: rect.right, width: rect.width, viewportWidth: window.innerWidth }
  })
  expect(welcomeGeometry.left).toBeGreaterThanOrEqual(0)
  expect(welcomeGeometry.right).toBeLessThanOrEqual(welcomeGeometry.viewportWidth)
  await welcomeDialog.getByRole('button', { name: '关闭开始使用 Nomo' }).click()
  await page.setViewportSize(testInfo.project.name === 'desktop-chromium'
    ? { width: 1280, height: 720 }
    : { width: 390, height: 844 })
  if (testInfo.project.name === 'desktop-chromium') await expectDesktopNavigation(page)
  else await expectMobileNavigation(page)
  await createSpace(page, '家')
  await expect(page.getByRole('button', { name: '卡片视图' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '平面视图' }).click()
  await expect(page.getByRole('region', { name: '空间平面总览' })).toBeVisible()
  await expect(page.getByRole('link', { name: /家/ })).toBeVisible()
  await page.getByRole('button', { name: '调整布局' }).click()
  await expect(page.getByText('拖动卡片移动位置；拖动右下角调整尺寸。布局会自动保存。', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '完成调整' }).click()
  await expectNoHorizontalOverflow(page)
  await page.goto('/app/boxes/new')
  await expect(page).toHaveURL(/\/app\/boxes\?create=1$/)
  await expect(page.getByRole('dialog', { name: '创建箱子' })).toBeVisible()
  await page.getByRole('button', { name: '关闭创建箱子' }).click()
  const publicUrl = await createBox(page, '冬季衣物', 'public')
  await expect(page.getByText('箱子已创建', { exact: true })).toBeVisible()
  await expect(page.locator('header').getByRole('button', { name: '创建箱子', exact: true })).toBeFocused()
  await createBox(page, '露营用品', 'private')

  await page.goto(publicUrl)
  await openNewItem(page)
  await page.getByLabel('物品名称').fill('羽绒服')
  await page.getByRole('button', { name: '增加数量' }).click()
  await expect(page.getByRole('spinbutton', { name: '数量' })).toHaveValue('2')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('heading', { name: '羽绒服' })).toBeVisible()
  await expect.poll(() => page.getByText('2 件', { exact: true }).evaluateAll((elements) =>
    elements.some((element) => element.getClientRects().length > 0),
  )).toBe(true)

  await page.goto('/app/boxes')
  await expect(page.getByRole('heading', { name: '全部箱子', exact: true })).toBeVisible()
  await expect(page.getByText('2 个箱子 · 1 件物品', { exact: true })).toBeVisible()
  await expect(page.getByText('2 / 3 个免费箱子', { exact: true })).toBeVisible()
  const winterLink = page.getByRole('link', { name: '打开冬季衣物' })
  const campingLink = page.getByRole('link', { name: '打开露营用品' })
  await expect(winterLink).toBeVisible()
  await expect(campingLink).toBeVisible()
  await expect(page.getByRole('searchbox', { name: '搜索箱子' })).toHaveCount(0)
  await expectNoHorizontalOverflow(page)

  await page.reload()
  await expect(page.getByRole('link', { name: '打开冬季衣物' })).toBeVisible()
  await expect(page.getByRole('link', { name: '打开露营用品' })).toBeVisible()

  let managementTrigger = page.getByRole('button', { name: '管理冬季衣物' })
  await managementTrigger.click()
  let editButton = page.getByRole('button', { name: '编辑冬季衣物' })
  await expect(editButton).toBeVisible()
  await editButton.click()
  await expect(page).toHaveURL(/\/app\/boxes\?edit=box-1$/)
  const editDialog = page.getByRole('dialog', { name: '编辑箱子' })
  await expect(editDialog).toBeVisible()
  await expect(editDialog.getByLabel('箱子名称')).toHaveValue('冬季衣物')
  await editDialog.getByRole('button', { name: '关闭编辑箱子' }).click()
  await expect(page).toHaveURL('/app/boxes')
  await expect(page.getByRole('link', { name: '打开冬季衣物' })).toBeVisible()
  await expect(page.getByRole('link', { name: '打开露营用品' })).toBeVisible()

  managementTrigger = page.getByRole('button', { name: '管理冬季衣物' })
  await managementTrigger.click()
  editButton = page.getByRole('button', { name: '编辑冬季衣物' })
  await expect(editButton).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(editButton).toHaveCount(0)
  await expect(managementTrigger).toBeFocused()

  await managementTrigger.click()
  await page.getByRole('button', { name: '删除冬季衣物' }).click()
  const deleteDialog = page.getByRole('alertdialog', { name: '删除“冬季衣物”？' })
  await expect(deleteDialog).toBeVisible()
  await deleteDialog.getByRole('button', { name: '取消' }).click()
  await expect(deleteDialog).toHaveCount(0)
  await expect(managementTrigger).toBeFocused()

  await page.getByRole('link', { name: '打开冬季衣物' }).click()
  await expect(page).toHaveURL(publicUrl)
  await expectBoxDetailTitle(page, '冬季衣物', testInfo.project.name !== 'desktop-chromium')

  await page.goto('/app/search?q=%E7%BE%BD%E7%BB%92%E6%9C%8D')
  await expect(page).toHaveURL(/\/app\/search\?q=%E7%BE%BD%E7%BB%92%E6%9C%8D$/)
  await expect(page.getByRole('heading', { name: '物品' })).toBeVisible()
  await expect(page.getByRole('link', { name: /羽绒服 × 2/ })).toBeVisible()

  await page.goto('/app/print')
  if (testInfo.project.name === 'desktop-chromium') {
    await expect(page.getByRole('heading', { level: 1, name: '打印二维码标签', exact: true })).toBeVisible()
    const workspace = page.getByRole('region', { name: '批量标签工作台' })
    await expect(workspace).toBeVisible()
    await workspace.getByRole('checkbox', { name: /冬季衣物/ }).check()
    const a4Preview = workspace.getByRole('region', { name: 'A4 标签预览' })
    await expect(a4Preview).toBeVisible()
    await expect(a4Preview.getByTestId('a4-sheet')).toBeVisible()
    await expect(a4Preview.getByRole('img', { name: '冬季衣物二维码' })).toBeVisible()
  } else {
    await expect(page.getByRole('heading', { level: 1, name: '下载箱子标签', exact: true })).toBeVisible()
    const singleLabel = page.getByRole('region', { name: '单个标签下载' })
    await expect(singleLabel).toBeVisible()
    await singleLabel.getByRole('radio', { name: /冬季衣物/ }).check()
    await expect(singleLabel.getByRole('region', { name: '单个标签预览' })).toBeVisible()
    await expect(singleLabel.getByRole('button', { name: '下载单个标签' })).toBeEnabled()
  }
  await expectNoHorizontalOverflow(page)

  const anonymousContext = await browser.newContext()
  const anonymous = await anonymousContext.newPage()
  await installMockBackend(anonymous, state)
  await anonymous.goto(publicUrl)
  await expectBoxDetailTitle(anonymous, '冬季衣物', testInfo.project.name !== 'desktop-chromium')
  await expect(anonymous.getByRole('button', { name: '新增物品' })).toHaveCount(0)
  await anonymousContext.close()
})

test('dashboard switches spaces and recent boxes with the selected venue', async ({ page }) => {
  const state = createMockState()
  await installMockBackend(page, state)
  await register(page, 'owner@example.com')

  const ownerId = '11111111-1111-4111-8111-111111111111'
  const defaultVenue = state.venues.find((venue) => venue.owner_id === ownerId && venue.is_default)
  if (!defaultVenue) throw new Error('mock registration did not create a default venue')
  state.venues.push({ id: 'venue-office', owner_id: ownerId, name: '公司', description: null, is_default: false })
  state.spaces.push(
    { id: 'space-home', owner_id: ownerId, venue_id: defaultVenue.id, name: '客厅', description: null },
    { id: 'space-office', owner_id: ownerId, venue_id: 'venue-office', name: '档案室', description: null },
  )
  state.boxes.push(
    { id: 'box-home', owner_id: ownerId, public_id: 'home', box_code: 'BX-HOME', space_id: 'space-home', name: '家庭用品', category: null, location: null, description: null, visibility: 'private', updated_at: '2026-08-01T08:00:00Z' },
    { id: 'box-office', owner_id: ownerId, public_id: 'office', box_code: 'BX-OFFICE', space_id: 'space-office', name: '公司档案', category: null, location: null, description: null, visibility: 'private', updated_at: '2026-08-01T09:00:00Z' },
  )

  await page.reload()
  const venueTrigger = page.getByRole('button', { name: `选择场地，${defaultVenue.name}` })
  await expect(venueTrigger).toBeVisible()
  await expect(page.getByText('家庭用品', { exact: true })).toBeVisible()
  await expect(page.getByText('公司档案', { exact: true })).toHaveCount(0)

  await venueTrigger.click()
  await page.getByRole('menu', { name: '选择场地' }).getByRole('menuitemradio', { name: /^公司，/ }).click()
  await expect(page.getByText('公司档案', { exact: true })).toBeVisible()
  await expect(page.getByText('档案室', { exact: true })).toBeVisible()
  await expect(page.getByText('家庭用品', { exact: true })).toHaveCount(0)
  await expect(page.getByText('客厅', { exact: true })).toHaveCount(0)
})

test('switches onboarding and app navigation to English', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the language switcher is exposed in the desktop sidebar')
  const state = createMockState()
  await installMockBackend(page, state)
  await register(page, 'english-onboarding@example.com', false)

  const welcomeDialog = page.getByRole('dialog', { name: '开始使用 Nomo' })
  await expect(welcomeDialog).toBeVisible()
  await welcomeDialog.getByRole('button', { name: '关闭开始使用 Nomo' }).click()
  await page.getByRole('button', { name: '打开账户菜单' }).click()
  await page.getByRole('menu', { name: '账户' }).getByRole('menuitem', { name: '设置' }).click()
  await page.getByRole('dialog', { name: '设置' }).getByRole('link', { name: /通用.*语言与地区/ }).click()
  await page.getByRole('dialog', { name: '通用' }).getByRole('combobox', { name: '语言' }).selectOption('en-US')
  await page.getByRole('dialog', { name: 'General' }).getByRole('button', { name: 'Close General' }).click()
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Close Settings' }).click()

  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /what are you looking for today/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Getting started' })).toBeVisible()
  await page.getByRole('button', { name: 'Getting started' }).click()

  const englishDialog = page.getByRole('dialog', { name: 'Get started with Nomo' })
  await expect(englishDialog).toBeVisible()
  await expect(englishDialog.getByRole('button', { name: 'Create your first space' })).toBeVisible()
})

test('navigation changes exactly at the 1024px desktop breakpoint', async ({ page }) => {
  const state = createMockState()
  await installMockBackend(page, state)
  await register(page, 'owner@example.com')

  await page.setViewportSize({ width: 768, height: 1024 })
  await expectMobileNavigation(page)
  await page.setViewportSize({ width: 1024, height: 768 })
  await expectDesktopNavigation(page)

  await createSpace(page, '家')
  await createBox(page, '断点测试箱', 'private')

  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/app/print')
  await expect(page.getByRole('region', { name: '单个标签下载' })).toBeVisible()
  await expect(page.getByRole('region', { name: '批量标签工作台' })).toBeHidden()
  await expectNoHorizontalOverflow(page)

  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/app/print')
  await expect(page.getByRole('region', { name: '单个标签下载' })).toBeVisible()
  await expect(page.getByRole('region', { name: '批量标签工作台' })).toBeHidden()
  await expectNoHorizontalOverflow(page)

  await page.setViewportSize({ width: 1024, height: 768 })
  await expect(page.getByRole('complementary')).toBeVisible()
  await expect(page.getByRole('navigation', { name: '移动端主导航' })).toBeHidden()
  await expect(page.getByRole('region', { name: '批量标签工作台' })).toBeVisible()
  await expect(page.getByRole('region', { name: '单个标签下载' })).toBeHidden()
  await expectNoHorizontalOverflow(page)
})

test('mobile home search submits from the visible action', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-chromium', 'mobile search action is mobile-only')
  const state = createMockState()
  await installMockBackend(page, state)
  await register(page, 'mobile-search@example.com')
  await createSpace(page, '家')
  await createBox(page, '摄影器材', 'private')

  await page.goto('/app')
  await page.getByRole('searchbox', { name: '搜索物品或箱子' }).fill('摄影')
  await page.getByRole('button', { name: '搜索', exact: true }).click()

  await expect(page).toHaveURL('/app/search?q=%E6%91%84%E5%BD%B1')
  await expect(page.getByRole('link', { name: /摄影器材/ })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('mobile My tab exposes profile settings and confirmed sign out', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-chromium', 'mobile account navigation is mobile-only')
  const state = createMockState()
  await installMockBackend(page, state)
  await register(page, 'mobile-profile@example.com')

  await page.getByRole('navigation', { name: '移动端主导航' }).getByRole('link', { name: '我的' }).click()
  await expect(page).toHaveURL('/app/me')
  await expect(page.getByRole('link', { name: /mobile-profile.*mobile-profile@example.com/ })).toBeVisible()
  await page.getByRole('link', { name: /设置.*通用、语言与地区/ }).click()
  await page.getByRole('link', { name: /通用.*语言与地区/ }).click()
  await page.getByRole('combobox', { name: /语言/ }).selectOption('en-US')
  await expect(page.getByRole('status')).toContainText('Settings saved')

  await page.getByRole('navigation', { name: 'Mobile primary navigation' }).getByRole('link', { name: 'My' }).click()
  await page.getByRole('group', { name: 'Account actions' }).getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('alertdialog', { name: 'Sign out?' })).toBeVisible()
  await page.getByRole('alertdialog', { name: 'Sign out?' }).getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/login')
})

test('route alignment across required viewport breakpoints', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the test covers all required viewports internally')
  test.setTimeout(60_000)
  const state = createMockState()
  await installMockBackend(page, state)
  await register(page, 'owner@example.com')
  await createSpace(page, '家')
  const publicUrl = await createBox(page, '窄屏收纳箱', 'public')

  const routes = [
    { path: '/app', heading: /^(早上好|中午好|下午好|晚上好)，今天找什么？$/, expectShell: true },
    { path: '/app/spaces', heading: '空间', expectShell: true },
    { path: '/app/boxes', heading: '全部箱子', expectShell: true },
    { path: '/app/boxes/box-1/edit', heading: '编辑箱子', expectShell: true },
    { path: '/app/search', heading: '搜索', expectShell: true },
    { path: '/app/scan', heading: '扫码查看', expectShell: true },
    { path: '/app/print', heading: '下载箱子标签', desktopHeading: '打印二维码标签', expectShell: true },
    { path: '/app/me', heading: '我的', expectShell: true },
    { path: publicUrl, heading: '窄屏收纳箱', expectShell: false },
  ]

  const viewports = [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]

  for (const viewport of viewports) {
    const { width } = viewport
    const desktop = width >= 1024
    await page.setViewportSize(viewport)
    for (const route of routes) {
      await page.goto(route.path)
      const heading = desktop && 'desktopHeading' in route ? route.desktopHeading : route.heading
      if (!route.expectShell && !desktop) {
        await expect(page.getByRole('navigation', { name: '箱子详情导航' }).getByText(`${route.heading} · 箱子详情`, { exact: true })).toBeVisible()
      } else if (route.path.endsWith('/edit')) {
        const editDialog = page.getByRole('dialog', { name: '编辑箱子' })
        await expect(editDialog).toBeVisible()
        await editDialog.getByRole('button', { name: '关闭编辑箱子' }).click()
      } else if (!desktop && route.path === '/app/search') {
        await expect(page.getByRole('navigation', { name: '搜索导航' }).getByText('查找收纳', { exact: true })).toBeVisible()
      } else {
        await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible()
      }
      await expectRouteFrame(page, route.expectShell, desktop)
      if (route.path === '/app' && !desktop) await expectShellSafeArea(page, 24)
      if (!route.expectShell && width < 768) {
        await expectItemFormActionClearance(page, 24)
      }
    }
  }
})

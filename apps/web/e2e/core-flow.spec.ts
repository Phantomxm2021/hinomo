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
  await expect(banner.getByRole('link', { name: 'Nomo' })).toHaveAttribute('href', '/app')
  const navigation = shell.getByRole('navigation', { name: '移动端主导航' })
  await expect(navigation).toBeVisible()
  await expect.poll(async () => {
    const mainPadding = await shell.getByRole('main').evaluate((main) => Number.parseFloat(getComputedStyle(main).paddingBottom))
    const navigationHeight = await navigation.evaluate((nav) => nav.getBoundingClientRect().height)
    return mainPadding >= navigationHeight
  }).toBe(true)
}

async function expectOwnerCtaClearance(page: Parameters<typeof installMockBackend>[0], safeAreaBottom: number) {
  const cta = page.getByRole('button', { name: '移动端新增物品' })
  await expect(cta).toBeVisible()
  await page.evaluate((inset) => {
    document.documentElement.style.setProperty('--safe-area-bottom', `${inset}px`)
    window.scrollTo(0, document.documentElement.scrollHeight)
  }, safeAreaBottom)
  try {
    await expect.poll(async () => {
      const geometry = await cta.evaluate((element) => ({
        bottom: element.getBoundingClientRect().bottom,
        viewportHeight: window.innerHeight,
      }))
      return Math.abs(geometry.viewportHeight - geometry.bottom - Math.max(16, safeAreaBottom)) <= 1
    }).toBe(true)
    await expect.poll(async () => {
      const ctaTop = await cta.evaluate((element) => element.getBoundingClientRect().top)
      const lastSectionBottom = await page.locator('main > section').last().evaluate((element) => element.getBoundingClientRect().bottom)
      return lastSectionBottom <= ctaTop
    }).toBe(true)
    await expect(page.getByRole('main')).toHaveCSS('padding-bottom', `${96 + safeAreaBottom}px`)
  } finally {
    await page.evaluate(() => document.documentElement.style.removeProperty('--safe-area-bottom'))
  }
}

async function expectItemFormActionClearance(page: Parameters<typeof installMockBackend>[0], safeAreaBottom: number) {
  await page.getByRole('button', { name: /^(新增物品|移动端新增物品)$/ }).click()
  await expect(page.getByRole('heading', { name: '新增物品' })).toBeVisible()
  const actionBar = page.getByRole('button', { name: '保存' }).locator('..')
  await page.evaluate((inset) => {
    document.documentElement.style.setProperty('--safe-area-bottom', `${inset}px`)
    window.scrollTo(0, document.documentElement.scrollHeight)
  }, safeAreaBottom)
  try {
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
  await expect(page).toHaveURL(/\/login$/)
  await register(page, 'owner@example.com')
  await expect(page.getByRole('heading', { name: '早上好，今天找什么？' })).toBeVisible()
  if (testInfo.project.name === 'desktop-chromium') await expectDesktopNavigation(page)
  else await expectMobileNavigation(page)
  await createSpace(page, '家')
  await expect(page.getByRole('button', { name: '卡片视图' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '平面视图' }).click()
  await expect(page.getByRole('region', { name: '空间平面总览' })).toBeVisible()
  await expect(page.getByRole('link', { name: /家/ })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.goto('/app/boxes/new')
  await expect(page).toHaveURL(/\/app\/boxes\?create=1$/)
  await expect(page.getByRole('dialog', { name: '创建箱子' })).toBeVisible()
  await page.getByRole('button', { name: '关闭创建箱子' }).click()
  const publicUrl = await createBox(page, '冬季衣物', 'public')
  await expect(page.getByRole('status', { name: '箱子已创建' })).toBeVisible()
  await expect(page.locator('header').getByRole('button', { name: '创建箱子', exact: true })).toBeFocused()
  await createBox(page, '露营用品', 'private')

  await page.goto(publicUrl)
  await page.getByRole('button', { name: /^(新增物品|移动端新增物品)$/ }).click()
  await page.getByLabel('物品名称').fill('羽绒服')
  await page.getByRole('button', { name: '增加数量' }).click()
  await expect(page.getByRole('spinbutton', { name: '数量' })).toHaveValue('2')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('heading', { name: '羽绒服' })).toBeVisible()
  await expect(page.getByText('2 件', { exact: true })).toBeVisible()

  await page.goto('/app/boxes')
  await expect(page.getByRole('heading', { name: '全部箱子', exact: true })).toBeVisible()
  await expect(page.getByText('2 个箱子 · 1 件物品', { exact: true })).toBeVisible()
  const winterLink = page.getByRole('link', { name: '打开冬季衣物' })
  const campingLink = page.getByRole('link', { name: '打开露营用品' })
  await expect(winterLink).toBeVisible()
  await expect(campingLink).toBeVisible()

  let searchbox = page.getByRole('searchbox', { name: '搜索箱子' })
  await searchbox.fill('BX-00001')
  await expect(page).toHaveURL('/app/boxes?q=BX-00001')
  await expect(winterLink).toBeVisible()
  await expect(campingLink).toHaveCount(0)
  await expectNoHorizontalOverflow(page)

  await page.reload()
  searchbox = page.getByRole('searchbox', { name: '搜索箱子' })
  await expect(searchbox).toHaveValue('BX-00001')
  await expect(page.getByRole('link', { name: '打开冬季衣物' })).toBeVisible()
  await expect(page.getByRole('link', { name: '打开露营用品' })).toHaveCount(0)

  let managementTrigger = page.getByRole('button', { name: '管理冬季衣物' })
  await managementTrigger.click()
  let editLink = page.getByRole('link', { name: '编辑冬季衣物' })
  await expect(editLink).toHaveAttribute('href', '/app/boxes/box-1/edit')
  await editLink.click()
  await expect(page).toHaveURL('/app/boxes/box-1/edit')
  await expect(page.getByRole('heading', { name: '编辑箱子', exact: true })).toBeVisible()
  await expect(page.getByLabel('箱子名称')).toHaveValue('冬季衣物')

  await page.goBack()
  await expect(page).toHaveURL('/app/boxes?q=BX-00001')
  searchbox = page.getByRole('searchbox', { name: '搜索箱子' })
  await expect(searchbox).toHaveValue('BX-00001')
  await expect(page.getByRole('link', { name: '打开冬季衣物' })).toBeVisible()
  await expect(page.getByRole('link', { name: '打开露营用品' })).toHaveCount(0)

  managementTrigger = page.getByRole('button', { name: '管理冬季衣物' })
  await managementTrigger.click()
  editLink = page.getByRole('link', { name: '编辑冬季衣物' })
  await expect(editLink).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(editLink).toHaveCount(0)
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
  await expect(page.getByRole('heading', { name: '冬季衣物' })).toBeVisible()

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
  await expect(anonymous.getByRole('heading', { name: '冬季衣物' })).toBeVisible()
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
  const venueSelect = page.getByRole('combobox', { name: '选择场地' })
  await expect(venueSelect).toHaveValue(defaultVenue.id)
  await expect(page.getByText('家庭用品', { exact: true })).toBeVisible()
  await expect(page.getByText('公司档案', { exact: true })).toHaveCount(0)

  await venueSelect.selectOption('venue-office')
  await expect(page.getByText('公司档案', { exact: true })).toBeVisible()
  await expect(page.getByText('档案室', { exact: true })).toBeVisible()
  await expect(page.getByText('家庭用品', { exact: true })).toHaveCount(0)
  await expect(page.getByText('客厅', { exact: true })).toHaveCount(0)
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
  await page.getByRole('button', { name: '搜索' }).click()

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
  await expect(page.getByLabel('昵称')).toHaveValue('mobile-profile')
  await expect(page.getByLabel('邮箱')).toHaveValue('mobile-profile@example.com')
  await page.getByLabel('语言').selectOption('en-US')
  await expect(page.getByRole('status')).toContainText('设置已保存')

  await page.getByRole('button', { name: '退出登录' }).click()
  await expect(page.getByRole('alertdialog', { name: '退出登录？' })).toBeVisible()
  await page.getByRole('button', { name: '确认退出' }).click()
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
    { path: '/app', heading: '早上好，今天找什么？', expectShell: true },
    { path: '/app/spaces', heading: '场地与空间', expectShell: true },
    { path: '/app/boxes', heading: '全部箱子', expectShell: true },
    { path: '/app/boxes/box-1/edit', heading: '编辑箱子', expectShell: true },
    { path: '/app/search', heading: '查找收纳', expectShell: true },
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
      await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible()
      await expectRouteFrame(page, route.expectShell, desktop)
      if (route.path === '/app' && !desktop) await expectShellSafeArea(page, 24)
      if (!route.expectShell && width < 768) {
        await expectOwnerCtaClearance(page, 24)
        await expectItemFormActionClearance(page, 24)
      }
    }
  }
})

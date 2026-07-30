import { expect, test } from '@playwright/test'
import { createBox, createMockState, createSpace, installMockBackend, register } from './mock-backend'

async function expectNoHorizontalOverflow(page: Parameters<typeof installMockBackend>[0]) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true)
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
  const publicUrl = await createBox(page, '冬季衣物', 'public')

  await page.goto(publicUrl)
  await page.getByRole('button', { name: /^(新增物品|移动端新增物品)$/ }).click()
  await page.getByLabel('物品名称').fill('羽绒服')
  await page.getByRole('button', { name: '增加数量' }).click()
  await expect(page.getByRole('spinbutton', { name: '数量' })).toHaveValue('2')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('heading', { name: '羽绒服' })).toBeVisible()
  await expect(page.getByText('2 件', { exact: true })).toBeVisible()

  await page.goto('/app/boxes')
  await expect(page.getByRole('heading', { name: '箱子', exact: true })).toBeVisible()
  await expect(page.getByRole('article', { name: '冬季衣物' })).toBeVisible()

  await page.goto('/app/search?q=%E7%BE%BD%E7%BB%92%E6%9C%8D')
  await expect(page).toHaveURL(/\/app\/search\?q=%E7%BE%BD%E7%BB%92%E6%9C%8D$/)
  await expect(page.getByRole('heading', { name: '物品' })).toBeVisible()
  await expect(page.getByRole('link', { name: /羽绒服 × 2/ })).toBeVisible()

  await page.goto('/app/print')
  if (testInfo.project.name === 'desktop-chromium') {
    const workspace = page.getByRole('region', { name: '批量标签工作台' })
    await expect(workspace).toBeVisible()
    await workspace.getByRole('checkbox', { name: /冬季衣物/ }).check()
    await expect(workspace.getByRole('heading', { name: '标签预览' })).toBeVisible()
    await expect(workspace.getByRole('img', { name: '二维码标签预览' })).toBeVisible()
  } else {
    const singleLabel = page.getByRole('region', { name: '单个标签' })
    await expect(singleLabel).toBeVisible()
    await singleLabel.getByRole('radio', { name: /冬季衣物/ }).check()
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

test('navigation changes exactly at the 1024px desktop breakpoint', async ({ page }) => {
  const state = createMockState()
  await installMockBackend(page, state)
  await register(page, 'owner@example.com')

  await page.setViewportSize({ width: 768, height: 1024 })
  await expectMobileNavigation(page)
  await expectNoHorizontalOverflow(page)

  await page.setViewportSize({ width: 1024, height: 768 })
  await expectDesktopNavigation(page)
  await expectNoHorizontalOverflow(page)
})

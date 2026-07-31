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
  await expect(page.getByRole('button', { name: '卡片视图' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '平面视图' }).click()
  await expect(page.getByRole('region', { name: '家庭平面总览' })).toBeVisible()
  await expect(page.getByRole('link', { name: /家/ })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.goto('/app/boxes/new')
  await expect(page).toHaveURL(/\/app\/boxes\?create=1$/)
  await expect(page.getByRole('dialog', { name: '创建箱子' })).toBeVisible()
  await page.getByRole('button', { name: '关闭创建箱子' }).click()
  const publicUrl = await createBox(page, '冬季衣物', 'public')
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

import { expect, test } from '@playwright/test'
import { createBox, createMockState, createSpace, installMockBackend, register } from './mock-backend'

test('owner creates, labels, and maintains a public box', async ({ browser, page }) => {
  const state = createMockState()
  await installMockBackend(page, state)
  await register(page, 'owner@example.com')
  await createSpace(page, '家')
  const publicUrl = await createBox(page, '冬季衣物', 'public')

  await page.goto(publicUrl)
  await page.getByRole('button', { name: '新增物品' }).click()
  await page.getByLabel('物品名称').fill('羽绒服')
  await page.getByLabel('数量').fill('2')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('heading', { name: '羽绒服' })).toBeVisible()
  await expect(page.getByText('未分类 · 2 件')).toBeVisible()

  const anonymousContext = await browser.newContext()
  const anonymous = await anonymousContext.newPage()
  await installMockBackend(anonymous, state)
  await anonymous.goto(publicUrl)
  await expect(anonymous.getByRole('heading', { name: '冬季衣物' })).toBeVisible()
  await expect(anonymous.getByRole('button', { name: '新增物品' })).toHaveCount(0)
  await anonymousContext.close()
})

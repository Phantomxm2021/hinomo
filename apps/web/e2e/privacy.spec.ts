import { expect, test } from '@playwright/test'
import { createBox, createMockState, createSpace, installMockBackend, register } from './mock-backend'

test('private details and the owner catalogue stay scoped to the current account', async ({ browser, page }, testInfo) => {
  const state = createMockState()
  await installMockBackend(page, state)
  await register(page, 'owner@example.com')
  await expect(page.getByRole('heading', { name: '早上好，今天找什么？' })).toBeVisible()
  await createSpace(page, '家')
  const privateUrl = await createBox(page, '证件箱', 'private')
  const publicUrl = await createBox(page, '公开纪念品', 'public')

  const anonymousContext = await browser.newContext()
  const anonymous = await anonymousContext.newPage()
  await installMockBackend(anonymous, state)
  await anonymous.goto(privateUrl)
  await expect(anonymous.getByRole('heading', { name: '无权限或内容不存在' })).toBeVisible()
  await anonymous.goto(publicUrl)
  if (testInfo.project.name === 'desktop-chromium') {
    await expect(anonymous.getByRole('heading', { name: '公开纪念品' })).toBeVisible()
    await expect(anonymous.getByText('公开箱子')).toBeVisible()
  } else {
    await expect(anonymous.getByRole('navigation', { name: '箱子详情导航' }).getByText('公开纪念品 · 箱子详情', { exact: true })).toBeVisible()
  }

  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await installMockBackend(other, state)
  await register(other, 'other@example.com')
  await other.goto(privateUrl)
  await expect(other.getByRole('heading', { name: '无权限或内容不存在' })).toBeVisible()
  await other.goto('/app/boxes')
  await expect(other.getByText('0 个箱子 · 0 件物品', { exact: true })).toBeVisible()
  await expect(other.getByRole('link', { name: '打开公开纪念品' })).toHaveCount(0)

  await anonymousContext.close()
  await otherContext.close()
})

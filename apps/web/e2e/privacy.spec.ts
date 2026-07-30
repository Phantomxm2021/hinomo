import { expect, test } from '@playwright/test'
import { createBox, createMockState, createSpace, installMockBackend, register } from './mock-backend'

test('private box is hidden from anonymous visitors and another account', async ({ browser, page }) => {
  const state = createMockState()
  await installMockBackend(page, state)
  await register(page, 'owner@example.com')
  await expect(page.getByRole('heading', { name: '早上好，今天找什么？' })).toBeVisible()
  await createSpace(page, '家')
  const privateUrl = await createBox(page, '证件箱', 'private')

  const anonymousContext = await browser.newContext()
  const anonymous = await anonymousContext.newPage()
  await installMockBackend(anonymous, state)
  await anonymous.goto(privateUrl)
  await expect(anonymous.getByRole('heading', { name: '无权限或内容不存在' })).toBeVisible()

  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await installMockBackend(other, state)
  await register(other, 'other@example.com')
  await other.goto(privateUrl)
  await expect(other.getByRole('heading', { name: '无权限或内容不存在' })).toBeVisible()

  await anonymousContext.close()
  await otherContext.close()
})

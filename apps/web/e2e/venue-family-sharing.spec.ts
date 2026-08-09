import { expect, test } from '@playwright/test'
import { boxQrUrl } from '../src/features/qr-print/qr'
import { createBox, createMockState, createSpace, installMockBackend, register } from './mock-backend'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'

async function openNewItem(page: Parameters<typeof installMockBackend>[0]) {
  const desktopAction = page.getByRole('button', { name: '新增物品', exact: true })
  if (await desktopAction.isVisible()) {
    await desktopAction.click()
    return
  }
  const manualAction = page.getByRole('button', { name: '手动记录', exact: true })
  if (await manualAction.isVisible()) {
    await manualAction.click()
    return
  }
  await page.getByRole('button', { name: '打开箱子操作菜单' }).click()
  await page.getByRole('dialog', { name: '箱子操作' }).getByRole('button', { name: '新增物品' }).click()
}

async function openPacking(page: Parameters<typeof installMockBackend>[0]) {
  const desktopAction = page.getByRole('button', { name: 'AI 装箱', exact: true })
  if (await desktopAction.isVisible()) {
    await desktopAction.click()
    return
  }
  await page.getByRole('button', { name: '打开箱子操作菜单' }).click()
  await page.getByRole('dialog', { name: '箱子操作' }).getByRole('button', { name: 'AI 装箱' }).click()
}

async function expectBoxTitle(page: Parameters<typeof installMockBackend>[0], name: string) {
  await expect.poll(async () => (
    await page.getByRole('heading', { name, exact: true }).isVisible().catch(() => false)
    || await page.getByRole('navigation', { name: '箱子详情导航' }).getByText(`${name} · 箱子详情`, { exact: true }).isVisible().catch(() => false)
  )).toBe(true)
}

/**
 * This intentionally exercises two independent browser storage contexts. The
 * shared mock state models server authority; neither page is permitted to
 * manufacture membership or an invite through REST table writes.
 */
test('owner invite grants shared work, then removal immediately revokes the stale member', async ({ browser, page }) => {
  const state = createMockState()
  await installMockBackend(page, state)
  await register(page, 'owner@example.com')
  await createSpace(page, '家')
  const sourceUrl = await createBox(page, '冬衣', 'private')
  await createBox(page, '备用箱', 'private')

  await page.goto(sourceUrl)
  await openNewItem(page)
  await page.getByLabel('物品名称').fill('羽绒服')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('heading', { name: '羽绒服' })).toBeVisible()

  const venueId = `venue-default-${OWNER_ID}`
  await page.goto(`/app/venues/${venueId}/members`)
  await page.getByRole('button', { name: '创建邀请' }).click()
  const invite = (state as unknown as { invites: Array<{ token: string }> }).invites[0]
  expect(invite).toBeTruthy()

  const memberContext = await browser.newContext()
  const member = await memberContext.newPage()
  await installMockBackend(member, state)
  await register(member, 'other@example.com')
  state.creditSummaries[MEMBER_ID] = { credits_available: 1, credits_reserved: 0 }
  await member.goto(`/join/venue#token=${invite.token}`)
  await member.getByRole('button', { name: '加入场地' }).click()
  await expect(member).toHaveURL(/\/app$/)

  // Shared venue search and the exact public-id URL placed on a printed QR
  // label are available to the member without exposing unrelated venues.
  await member.goto('/app')
  await member.getByRole('button', { name: /选择场地/ }).click()
  await expect(member.getByText('家庭共享', { exact: true })).toBeVisible()
  await member.getByRole('menuitemradio', { name: /家庭共享/ }).click()
  const scannerQrUrl = boxQrUrl('http://127.0.0.1:4173', state.boxes[0]!.public_id)
  expect(new URL(scannerQrUrl).pathname).toBe(sourceUrl)
  await member.goto(scannerQrUrl)
  await expectBoxTitle(member, '冬衣')
  await expect(member.getByText('羽绒服', { exact: true })).toBeVisible()
  await member.goto('/app/search')
  await member.getByRole('searchbox').fill('羽绒服')
  await member.getByRole('button', { name: '提交搜索' }).click()
  await expect(member.getByRole('link', { name: /羽绒服/ })).toBeVisible()

  await member.goto(scannerQrUrl)
  await member.getByRole('button', { name: '打开羽绒服操作' }).click()
  const movementDialog = member.getByRole('dialog', { name: '羽绒服' })
  await movementDialog.getByRole('button', { name: '移动到其他箱子' }).click()
  const moveForm = member.getByRole('dialog', { name: '移动物品' })
  await moveForm.locator('#movement-target-box').selectOption('box-2')
  await moveForm.getByRole('button', { name: '确认移动' }).click()
  await expect(movementDialog).toBeHidden()

  await openPacking(member)
  await expect.poll(() => state.packingSessions.length).toBe(1)
  expect(state.creditSummaries[OWNER_ID]).toBeUndefined()
  expect(state.creditSummaries[MEMBER_ID]).toEqual({ credits_available: 1, credits_reserved: 0 })
  expect(state.packingSessions[0]).toMatchObject({ box_id: 'box-1', owner_id: OWNER_ID, created_by: MEMBER_ID })

  // Members may edit shared contents and create up to the owner's venue quota,
  // but the fourth box must not offer the member a personal purchase route.
  await member.goto('/app/boxes')
  await member.getByRole('button', { name: '创建箱子', exact: true }).click()
  const createDialog = member.getByRole('dialog', { name: '创建箱子' })
  await createDialog.getByLabel('空间').selectOption({ label: '家' })
  await createDialog.getByLabel('箱子名称').fill('成员第三箱')
  await createDialog.getByRole('button', { name: '创建箱子', exact: true }).click()
  await expect(createDialog).toBeHidden()
  await member.getByRole('button', { name: '创建箱子', exact: true }).click()
  await expect(member.getByText('请联系场所所有者解锁', { exact: true })).toBeVisible()
  await expect(member.getByRole('button', { name: 'HK$38 永久解锁' })).toHaveCount(0)

  const bypass = await member.evaluate(async ({ venueId, memberId }) => {
    const request = (path: string, method: string, body: unknown) => fetch(`http://127.0.0.1:54321/rest/v1/${path}`, {
      method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).then(async (response) => ({ status: response.status, body: await response.json() }))
    return Promise.all([
      request('venue_members', 'POST', { venue_id: venueId, user_id: memberId }),
      request('venue_invites', 'POST', { venue_id: venueId }),
      request('boxes?id=eq.box-1', 'DELETE', {}),
      request('spaces?id=eq.space-1', 'DELETE', {}),
      request(`venues?id=eq.${venueId}`, 'DELETE', {}),
    ])
  }, { venueId, memberId: MEMBER_ID })
  for (const response of bypass) expect(response).toMatchObject({ status: 403, body: { code: '42501' } })

  await page.goto(`/app/venues/${venueId}/activity`)
  await expect(page.getByRole('heading', { name: '最近活动' })).toBeVisible()
  await expect(page.locator('article').filter({ hasText: /other.*羽绒服.*冬衣.*备用箱/ })).toHaveCount(1)

  await page.goto(`/app/venues/${venueId}/members`)
  await page.getByRole('button', { name: /移除\s?other/ }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '移除成员' }).click()
  // A stale route makes a fresh server access request and is cleared back to
  // the member's own dashboard instead of retaining shared-page data.
  await member.goto(`/app/venues/${venueId}/members`)
  await expect(member).toHaveURL(/\/app$/)
  await memberContext.close()
})

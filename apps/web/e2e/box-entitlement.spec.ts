import { expect, test, type Page } from '@playwright/test'
import {
  completeBoxUnlimitedPurchase,
  createMockState,
  createSpace,
  installMockBackend,
  register,
  type MockState,
} from './mock-backend'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'

function seedOwnerBoxes(state: MockState, count: number) {
  const space = state.spaces.find((candidate) => candidate.owner_id === OWNER_ID)
  if (!space) throw new Error('seedOwnerBoxes requires an owner space')

  for (let index = state.boxes.length; index < count; index += 1) {
    const sequence = index + 1
    state.boxes.push({
      id: `seed-box-${sequence}`,
      owner_id: OWNER_ID,
      public_id: `123e4567-e89b-42d3-a456-${String(sequence).padStart(12, '0')}`,
      box_code: `BX-SEED-${sequence}`,
      space_id: space.id,
      name: `已有箱子 ${sequence}`,
      category: null,
      location: null,
      description: null,
      visibility: 'private',
      updated_at: `2026-08-09T00:00:0${sequence}Z`,
    })
  }
  state.boxPlan.box_count = count
  state.boxPlan.can_create = state.boxPlan.unlimited_boxes || count < state.boxPlan.free_limit
}

async function prepareOwner(page: Page, state: MockState) {
  await installMockBackend(page, state)
  await register(page, 'owner@example.com')
  await createSpace(page, '家')
}

async function submitOpenCreateDialog(page: Page, name: string) {
  const dialog = page.getByRole('dialog', { name: '创建箱子' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('空间').selectOption({ label: '家' })
  await dialog.getByLabel('箱子名称').fill(name)
  await dialog.getByRole('button', { name: '创建箱子', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
}

test('a free account creates its third box and the fourth attempt is stopped by the HK$38 paywall', async ({ page }) => {
  const state = createMockState({ boxCount: 2 })
  await prepareOwner(page, state)
  seedOwnerBoxes(state, 2)

  await page.goto('/app/boxes')
  await expect(page.getByText('2 / 3 个免费箱子', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '创建箱子', exact: true }).click()
  const createDialog = page.getByRole('dialog', { name: '创建箱子' })
  await createDialog.getByLabel('空间').selectOption({ label: '家' })
  await createDialog.getByLabel('箱子名称').fill('第三个箱子')
  await createDialog.getByRole('button', { name: '创建箱子', exact: true }).click()
  await createDialog.waitFor({ state: 'hidden' })

  await expect(page.getByText('3 / 3 · 已达免费上限', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '创建箱子', exact: true }).click()
  const paywall = page.getByRole('dialog', { name: '免费版最多可保有 3 个箱子' })
  await expect(paywall).toBeVisible()
  await expect(paywall.getByRole('button', { name: 'HK$38 永久解锁' })).toBeVisible()
  await expect(state.boxes).toHaveLength(3)

  await paywall.getByRole('button', { name: '关闭箱子额度提示' }).click()
  state.boxPlan.can_create = true
  await page.reload()
  await page.getByRole('button', { name: '创建箱子', exact: true }).click()
  const staleCreateDialog = page.getByRole('dialog', { name: '创建箱子' })
  await staleCreateDialog.getByLabel('空间').selectOption({ label: '家' })
  await staleCreateDialog.getByLabel('箱子名称').fill('不会丢失的第四箱')
  await staleCreateDialog.getByRole('button', { name: '创建箱子', exact: true }).click()

  await expect(page.getByRole('dialog', { name: '免费版最多可保有 3 个箱子' })).toBeVisible()
  await expect(staleCreateDialog.getByLabel('箱子名称')).toHaveValue('不会丢失的第四箱')
  expect(state.boxes).toHaveLength(3)
})

test('canceling the unlimited-box checkout leaves the free account unchanged', async ({ page }) => {
  const state = createMockState({ boxCount: 3 })
  state.boxCheckout.result = 'canceled'
  await prepareOwner(page, state)
  seedOwnerBoxes(state, 3)

  await page.goto('/app/boxes')
  await page.getByRole('button', { name: '创建箱子', exact: true }).click()
  const paywall = page.getByRole('dialog', { name: '免费版最多可保有 3 个箱子' })
  await paywall.getByRole('button', { name: 'HK$38 永久解锁' }).click()

  await expect(page).toHaveURL('/app/boxes')
  await expect(page.getByText('已取消购买无限箱子', { exact: true })).toBeVisible()
  expect(state.boxPlan).toMatchObject({ box_count: 3, unlimited_boxes: false, can_create: false })
  expect(state.boxes).toHaveLength(3)
})

test('a delayed paid checkout unlocks creation of boxes four and five without changing AI Credits', async ({ page }) => {
  const state = createMockState({ boxCount: 3 })
  state.creditSummary = { credits_available: 20, credits_reserved: 0 }
  await prepareOwner(page, state)
  seedOwnerBoxes(state, 3)

  await page.goto('/app/boxes')
  await page.getByRole('button', { name: '创建箱子', exact: true }).click()
  await page.getByRole('dialog', { name: '免费版最多可保有 3 个箱子' })
    .getByRole('button', { name: 'HK$38 永久解锁' })
    .click()

  await expect(page).toHaveURL(/\/app\/boxes\?purchase=success$/)
  await expect(page.getByRole('status', { name: '支付已完成，正在确认无限箱子权益' })).toBeVisible()
  await expect(page.getByRole('button', { name: '创建箱子', exact: true })).toBeDisabled()
  expect(state.boxCheckout.pending).toBe(true)

  completeBoxUnlimitedPurchase(state)
  await submitOpenCreateDialog(page, '第四个箱子')
  await expect(page.getByText('无限箱子 · 已永久解锁', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '创建箱子', exact: true }).click()
  await submitOpenCreateDialog(page, '第五个箱子')
  expect(state.boxes).toHaveLength(5)
  expect(state.boxPlan).toMatchObject({ box_count: 5, unlimited_boxes: true, can_create: true })

  await page.goto('/app/me/credits')
  await expect(page.getByRole('region', { name: 'AI 额度概览' })).toContainText('20credits')
  expect(state.creditSummary).toEqual({ credits_available: 20, credits_reserved: 0 })
})

test('a legacy free account keeps five boxes usable and deletable while new creation stays blocked', async ({ page }) => {
  const state = createMockState({ boxCount: 5 })
  await prepareOwner(page, state)
  seedOwnerBoxes(state, 5)

  await page.goto('/app/boxes')
  await expect(page.getByText('已有 5 个箱子 · 免费上限 3 个', { exact: true })).toBeVisible()
  await expect(page.locator('article').getByRole('link', { name: /^打开已有箱子/ })).toHaveCount(5)

  await page.getByRole('button', { name: '创建箱子', exact: true }).click()
  let paywall = page.getByRole('dialog', { name: '免费版最多可保有 3 个箱子' })
  await expect(paywall).toBeVisible()
  await paywall.getByRole('button', { name: '关闭箱子额度提示' }).click()

  await page.getByRole('button', { name: '管理已有箱子 1' }).click()
  await page.getByRole('button', { name: '删除已有箱子 1' }).click()
  const deleteDialog = page.getByRole('alertdialog', { name: '删除“已有箱子 1”？' })
  await deleteDialog.getByRole('button', { name: '删除' }).click()

  await expect(page.getByRole('link', { name: '打开已有箱子 1' })).toHaveCount(0)
  await expect(page.getByText('已有 4 个箱子 · 免费上限 3 个', { exact: true })).toBeVisible()
  expect(state.boxes).toHaveLength(4)
  expect(state.boxPlan).toMatchObject({ box_count: 4, unlimited_boxes: false, can_create: false })

  await page.getByRole('button', { name: '创建箱子', exact: true }).click()
  paywall = page.getByRole('dialog', { name: '免费版最多可保有 3 个箱子' })
  await expect(paywall).toBeVisible()
})

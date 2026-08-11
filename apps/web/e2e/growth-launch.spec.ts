import { expect, test } from '@playwright/test'
import { createMockState, installMockBackend } from './mock-backend'

async function useEnglish(page: Parameters<typeof installMockBackend>[0]) {
  await page.addInitScript(() => window.localStorage.setItem('nomo-locale', 'en-US'))
}

test('campaign explains the offer and starts registration without analytics before consent', async ({ page }) => {
  const posthogRequests: string[] = []
  page.on('request', request => {
    if (request.url().includes('posthog')) posthogRequests.push(request.url())
  })
  await useEnglish(page)
  await page.goto('/3-box-reset')
  await expect(page.getByRole('heading', { name: 'Pack once. Find anything later.' })).toBeVisible()
  expect(posthogRequests).toEqual([])
  await page.getByRole('button', { name: 'No thanks' }).click()
  await page.getByRole('link', { name: 'Organize 3 boxes free' }).first().click()
  await expect(page).toHaveURL(/\/register\?campaign=three_box_reset/)
})

test('growth activation creates a space, box, and item then reaches search and print without console errors', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await useEnglish(page)
  await installMockBackend(page, createMockState())
  await page.goto('/register?campaign=three_box_reset')
  await page.getByRole('button', { name: 'No thanks' }).click()
  await page.getByLabel('Nickname').fill('growth activation')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('growth-activation@example.com')
  await page.getByLabel('Password').fill('correct-horse-battery-staple')
  await page.getByRole('checkbox', { name: /I have read and agree/ }).check()
  await page.getByRole('button', { name: 'Sign up' }).click()
  await page.waitForURL('**/app')

  const onboarding = page.getByRole('dialog', { name: 'Get started with Nomo' })
  await onboarding.getByRole('button', { name: 'Create your first space' }).click()
  const spaceDialog = page.getByRole('dialog', { name: 'Create space' })
  await spaceDialog.getByLabel('Space name').fill('Home')
  await spaceDialog.getByRole('button', { name: 'Create space', exact: true }).click()

  await page.getByRole('dialog', { name: 'Get started with Nomo' })
    .getByRole('button', { name: 'Create your first box' })
    .click()
  const boxDialog = page.getByRole('dialog', { name: 'Create box' })
  await boxDialog.getByLabel('Box name').fill('Cable box')
  await boxDialog.getByRole('button', { name: 'Create box', exact: true }).click()
  await expect(page).toHaveURL(/\/b\/[^/]+\?onboarding=item/)

  const itemOnboarding = page.getByRole('dialog', { name: 'Get started with Nomo' })
  await itemOnboarding.getByRole('button', { name: 'Record an item' }).click()
  const itemDialog = page.getByRole('dialog', { name: 'Add item' })
  await itemDialog.getByLabel('Item name').fill('HDMI cable')
  await itemDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await itemDialog.waitFor({ state: 'hidden' })
  await expect(page.getByText('HDMI cable', { exact: true })).toBeVisible()

  await page.goto('/app/search')
  await page.getByRole('search').getByRole('searchbox').fill('HDMI cable')
  await expect(page.getByText(/HDMI cable × 1/)).toBeVisible()

  await page.goto('/app/print')
  if (await page.getByRole('button', { name: 'Download PDF' }).count()) {
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible()
  } else {
    await expect(page.getByRole('button', { name: 'Download single label' })).toBeVisible()
  }
  expect(consoleErrors).toEqual([])
})

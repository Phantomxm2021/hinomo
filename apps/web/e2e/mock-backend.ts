import { expect, type Page, type Route } from '@playwright/test'

type Venue = { id: string; owner_id: string; name: string; description: string | null; is_default: boolean }
type Space = { id: string; owner_id: string; venue_id: string; name: string; description: string | null }
type SpaceLayout = { space_id: string; owner_id: string; x_percent: number; y_percent: number; width_percent: number; height_percent: number }
type Item = { id: string; box_id: string; name: string; category: string | null; quantity: number; description: string | null }
type Profile = { id: string; display_name: string | null; avatar_object_key: string | null; locale: 'zh-CN' | 'en-US' }
type Box = {
  id: string
  owner_id: string
  public_id: string
  box_code: string
  space_id: string
  name: string
  category: string | null
  location: string | null
  description: string | null
  visibility: 'public' | 'private'
  updated_at: string
}

export type MockState = { venues: Venue[]; spaces: Space[]; spaceLayouts: SpaceLayout[]; boxes: Box[]; items: Item[]; profiles: Profile[] }

export const createMockState = (): MockState => ({ venues: [], spaces: [], spaceLayouts: [], boxes: [], items: [], profiles: [] })

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

function authUser(id: string, email: string) {
  const now = new Date().toISOString()
  return {
    id, aud: 'authenticated', role: 'authenticated', email,
    email_confirmed_at: now, confirmed_at: now, last_sign_in_at: now,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {}, identities: [], created_at: now, updated_at: now,
  }
}

function eqValue(url: URL, field: string) {
  const value = url.searchParams.get(field)
  return value?.startsWith('eq.') ? value.slice(3) : null
}

export async function installMockBackend(page: Page, state: MockState) {
  let currentUserId: string | null = null
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()

    if (url.pathname === '/auth/v1/signup' || url.pathname === '/auth/v1/token') {
      const credentials = request.postDataJSON() as { email?: string }
      const email = credentials.email ?? `user-${Date.now()}@example.com`
      currentUserId = email.includes('other')
        ? '22222222-2222-4222-8222-222222222222'
        : '11111111-1111-4111-8111-111111111111'
      if (!state.profiles.some((profile) => profile.id === currentUserId)) {
        state.profiles.push({ id: currentUserId, display_name: email.split('@')[0], avatar_object_key: null, locale: 'zh-CN' })
      }
      if (!state.venues.some((venue) => venue.owner_id === currentUserId && venue.is_default)) {
        state.venues.push({
          id: `venue-default-${currentUserId}`,
          owner_id: currentUserId,
          name: '默认',
          description: null,
          is_default: true,
        })
      }
      const user = authUser(currentUserId, email)
      return json(route, {
        access_token: `token-${currentUserId}`,
        refresh_token: `refresh-${currentUserId}`,
        expires_in: 3600,
        token_type: 'bearer',
        user,
      })
    }
    if (url.pathname === '/auth/v1/user') {
      return currentUserId
        ? json(route, authUser(currentUserId, 'owner@example.com'))
        : json(route, { message: 'not authenticated' }, 401)
    }
    if (url.pathname === '/auth/v1/logout' && method === 'POST') {
      currentUserId = null
      return route.fulfill({ status: 204, body: '' })
    }

    if (url.pathname === '/rest/v1/profiles' && method === 'GET') {
      const profileId = eqValue(url, 'id')
      const profile = state.profiles.find((candidate) => candidate.id === profileId && candidate.id === currentUserId)
      return profile ? json(route, profile) : json(route, null)
    }

    if (url.pathname === '/rest/v1/rpc/update_profile_locale' && method === 'POST' && currentUserId) {
      const { p_locale: locale } = request.postDataJSON() as { p_locale: 'zh-CN' | 'en-US' }
      const profile = state.profiles.find((candidate) => candidate.id === currentUserId)
      if (profile) profile.locale = locale
      return json(route, null)
    }

    if (url.pathname === '/rest/v1/rpc/get_credit_summary' && method === 'POST' && currentUserId) {
      return json(route, [{
        credits_available: 0,
        credits_reserved: 0,
      }])
    }

    if (url.pathname === '/rest/v1/venues') {
      if (method === 'GET') {
        return json(route, state.venues.filter((venue) => venue.owner_id === currentUserId).map((venue) => ({
          id: venue.id,
          name: venue.name,
          description: venue.description,
          is_default: venue.is_default,
          spaces: [{ count: state.spaces.filter((space) => space.venue_id === venue.id).length }],
        })))
      }
      if (method === 'POST' && currentUserId) {
        const input = request.postDataJSON() as { name: string; description: string | null }
        const venue = { ...input, id: `venue-${state.venues.length + 1}`, owner_id: currentUserId, is_default: false }
        state.venues.push(venue)
        return json(route, { id: venue.id }, 201)
      }
      if (method === 'PATCH' && currentUserId) {
        const venueId = eqValue(url, 'id')
        const venue = state.venues.find((candidate) => candidate.id === venueId && candidate.owner_id === currentUserId)
        if (venue) Object.assign(venue, request.postDataJSON())
        return json(route, null, 204)
      }
      if (method === 'DELETE' && currentUserId) {
        const venueId = eqValue(url, 'id')
        if (state.spaces.some((space) => space.venue_id === venueId)) return json(route, { code: '23503', message: 'venue is not empty' }, 409)
        state.venues = state.venues.filter((venue) => venue.id !== venueId || venue.owner_id !== currentUserId)
        return json(route, null, 204)
      }
    }

    if (url.pathname === '/rest/v1/spaces') {
      if (method === 'GET') {
        return json(route, state.spaces.filter((space) => space.owner_id === currentUserId).map((space) => ({
          id: space.id,
          venue_id: space.venue_id,
          name: space.name,
          description: space.description,
          venues: { name: state.venues.find((venue) => venue.id === space.venue_id)?.name ?? '' },
          boxes: state.boxes.filter((box) => box.space_id === space.id).map((box) => ({
            id: box.id,
            items: [{ count: state.items.filter((item) => item.box_id === box.id).length }],
          })),
        })))
      }
      if (method === 'POST' && currentUserId) {
        const input = request.postDataJSON() as { venue_id: string; name: string; description: string | null }
        const space = { ...input, id: `space-${state.spaces.length + 1}`, owner_id: currentUserId }
        state.spaces.push(space)
        return json(route, { id: space.id }, 201)
      }
    }

    if (url.pathname === '/rest/v1/space_layouts') {
      if (method === 'GET') {
        return json(route, state.spaceLayouts.filter((layout) => layout.owner_id === currentUserId).map((layout) => ({
          space_id: layout.space_id,
          x_percent: layout.x_percent,
          y_percent: layout.y_percent,
          width_percent: layout.width_percent,
          height_percent: layout.height_percent,
        })))
      }
      if (method === 'POST' && currentUserId) {
        const input = request.postDataJSON() as Omit<SpaceLayout, 'owner_id'> & { owner_id?: string }
        const layout = { ...input, owner_id: currentUserId }
        const existingIndex = state.spaceLayouts.findIndex((candidate) => candidate.space_id === input.space_id)
        if (existingIndex >= 0) state.spaceLayouts[existingIndex] = layout
        else state.spaceLayouts.push(layout)
        return json(route, null, 201)
      }
    }

    if (url.pathname === '/rest/v1/boxes') {
      if (method === 'POST' && currentUserId) {
        const input = request.postDataJSON() as Omit<Box, 'id' | 'public_id' | 'box_code'>
        const box: Box = {
          ...input,
          id: `box-${state.boxes.length + 1}`,
          public_id: `123e4567-e89b-42d3-a456-${String(state.boxes.length + 1).padStart(12, '0')}`,
          box_code: `BX-${String(state.boxes.length + 1).padStart(5, '0')}`,
          updated_at: new Date().toISOString(),
        }
        state.boxes.push(box)
        return json(route, { id: box.id, public_id: box.public_id, box_code: box.box_code, name: box.name }, 201)
      }
      if (method === 'GET') {
        const publicId = eqValue(url, 'public_id')
        const boxId = eqValue(url, 'id')
        if (publicId || boxId) {
          const box = state.boxes.find((candidate) =>
            (publicId ? candidate.public_id === publicId : candidate.id === boxId)
            && (candidate.visibility === 'public' || candidate.owner_id === currentUserId),
          )
          if (!box) return json(route, { code: 'PGRST116', message: 'not found', details: null, hint: null }, 406)
          const space = state.spaces.find((candidate) => candidate.id === box.space_id)!
          return json(route, {
            ...box,
            cover_object_key: null,
            spaces: {
              name: space.name,
              venues: { name: state.venues.find((venue) => venue.id === space.venue_id)?.name ?? '' },
            },
            items: state.items.filter((item) => item.box_id === box.id).map((item) => ({ ...item, image_object_key: null })),
          })
        }
        const ownerId = eqValue(url, 'owner_id')
        return json(route, state.boxes
          .filter((box) => box.visibility === 'public' || box.owner_id === currentUserId)
          .filter((box) => !ownerId || box.owner_id === ownerId)
          .map((box) => {
            const space = state.spaces.find((candidate) => candidate.id === box.space_id && candidate.owner_id === currentUserId)
            return {
              ...box,
              cover_object_key: null,
              items: [{ count: state.items.filter((item) => item.box_id === box.id).length }],
              spaces: space ? {
                name: space.name,
                venues: { name: state.venues.find((venue) => venue.id === space.venue_id)?.name ?? '' },
              } : null,
            }
          }))
      }
    }

    if (url.pathname === '/rest/v1/rpc/get_public_box' && method === 'POST') {
      const { p_public_id: publicId } = request.postDataJSON() as { p_public_id?: string }
      const box = state.boxes.find((candidate) => (
        candidate.public_id === publicId && candidate.visibility === 'public'
      ))
      if (!box) return json(route, [])
      const space = state.spaces.find((candidate) => candidate.id === box.space_id)
      const venue = state.venues.find((candidate) => candidate.id === space?.venue_id)
      return json(route, [{
        ...box,
        cover_object_key: null,
        venue_name: venue?.name ?? '',
        space_name: space?.name ?? '',
        items: state.items
          .filter((item) => item.box_id === box.id)
          .map((item) => ({ ...item, image_object_key: null })),
      }])
    }

    if (url.pathname === '/rest/v1/rpc/search_my_items' && method === 'POST' && currentUserId) {
      const { p_query: query = '' } = request.postDataJSON() as { p_query?: string }
      const needle = query.toLocaleLowerCase()
      return json(route, state.items.flatMap((item) => {
        const box = state.boxes.find((candidate) => candidate.id === item.box_id)
        const space = state.spaces.find((candidate) => candidate.id === box?.space_id)
        if (!box || box.owner_id !== currentUserId || !item.name.toLocaleLowerCase().includes(needle)) return []
        return [{
          item_id: item.id,
          item_name: item.name,
          category: item.category,
          quantity: item.quantity,
          box_id: box.id,
          box_name: box.name,
          box_public_id: box.public_id,
          box_code: box.box_code,
          location: box.location,
          venue_name: state.venues.find((venue) => venue.id === space?.venue_id)?.name ?? '',
          space_name: space?.name ?? '',
        }]
      }))
    }

    if (url.pathname === '/rest/v1/items' && method === 'POST' && currentUserId) {
      const input = request.postDataJSON() as Omit<Item, 'id'>
      const item = { ...input, id: `item-${state.items.length + 1}` }
      state.items.push(item)
      return json(route, item, 201)
    }

    return json(route, { message: `Unhandled mock request: ${method} ${url.pathname}` }, 500)
  })
}

export async function register(page: Page, email: string) {
  await page.goto('/register')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill('correct-horse-battery-staple')
  await page.getByRole('button', { name: '注册' }).click()
  await page.waitForURL('**/app')
}

export async function createSpace(page: Page, name: string) {
  await page.goto('/app/spaces')
  const createVenueButton = page.getByRole('button', { name: '先创建场地' })
  const createSpaceButton = page.getByRole('button', { name: '创建空间', exact: true })
  await expect.poll(async () => (
    await createVenueButton.isVisible().catch(() => false)
    || await createSpaceButton.isEnabled().catch(() => false)
  )).toBe(true)
  if (await createVenueButton.isVisible()) {
    await createVenueButton.click()
    const venueDialog = page.getByRole('dialog', { name: '创建场地' })
    await venueDialog.getByLabel('场地名称').fill('家里')
    await venueDialog.getByRole('button', { name: '创建场地' }).click()
    await venueDialog.waitFor({ state: 'hidden' })
  }
  await createSpaceButton.click()
  const dialog = page.getByRole('dialog', { name: '创建空间' })
  await dialog.getByLabel('空间名称').fill(name)
  await dialog.getByRole('button', { name: '创建空间', exact: true }).click()
  await page.getByRole('heading', { name, exact: true }).waitFor()
}

export async function createBox(page: Page, name: string, visibility: 'public' | 'private') {
  await page.goto('/app/boxes')
  const boxLinks = page.locator('article').getByRole('link', { name: /^打开/ })
  await expect.poll(async () => (
    await boxLinks.count() > 0
    || await page.getByText('还没有箱子', { exact: true }).count() > 0
  )).toBe(true)
  const linksBefore = await boxLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')).filter(Boolean))
  await page.locator('header').getByRole('button', { name: '创建箱子', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '创建箱子' })
  await expect(page).toHaveURL(/\/app\/boxes\?create=1$/)
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true)
  await dialog.getByLabel('空间').selectOption({ label: '家' })
  await dialog.getByLabel('箱子名称').fill(name)
  await dialog.getByLabel('具体位置').fill('衣柜上层')
  await dialog.getByLabel('查看权限').selectOption(visibility)
  await dialog.getByRole('button', { name: '创建箱子', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  await expect(boxLinks).toHaveCount(linksBefore.length + 1)
  const linksAfter = await boxLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')).filter(Boolean))
  const publicUrl = linksAfter.find((href) => !linksBefore.includes(href))
  expect(publicUrl).toBeTruthy()
  return publicUrl!
}

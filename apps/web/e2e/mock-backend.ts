import { expect, type Page, type Route } from '@playwright/test'

type Space = { id: string; owner_id: string; name: string; description: string | null }
type SpaceLayout = { space_id: string; owner_id: string; x_percent: number; y_percent: number; width_percent: number; height_percent: number }
type Item = { id: string; box_id: string; name: string; category: string | null; quantity: number; description: string | null }
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

export type MockState = { spaces: Space[]; spaceLayouts: SpaceLayout[]; boxes: Box[]; items: Item[] }

export const createMockState = (): MockState => ({ spaces: [], spaceLayouts: [], boxes: [], items: [] })

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

    if (url.pathname === '/rest/v1/spaces') {
      if (method === 'GET') {
        return json(route, state.spaces.filter((space) => space.owner_id === currentUserId).map((space) => ({
          id: space.id,
          name: space.name,
          description: space.description,
          boxes: state.boxes.filter((box) => box.space_id === space.id).map((box) => ({
            id: box.id,
            items: [{ count: state.items.filter((item) => item.box_id === box.id).length }],
          })),
        })))
      }
      if (method === 'POST' && currentUserId) {
        const input = request.postDataJSON() as { name: string; description: string | null }
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
            spaces: { name: space.name },
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
              spaces: space ? { name: space.name } : null,
            }
          }))
      }
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
  await page.getByRole('button', { name: '创建空间', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '创建空间' })
  await dialog.getByLabel('空间名称').fill(name)
  await dialog.getByRole('button', { name: '创建空间', exact: true }).click()
  await page.getByRole('heading', { name, exact: true }).waitFor()
}

export async function createBox(page: Page, name: string, visibility: 'public' | 'private') {
  await page.goto('/app/boxes')
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
  const boxLink = page.getByRole('link', { name: `打开${name}` })
  await boxLink.waitFor()
  return await boxLink.getAttribute('href') as string
}

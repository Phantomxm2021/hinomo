import type { Page, Route } from '@playwright/test'

type Space = { id: string; owner_id: string; name: string; description: string | null }
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
}

export type MockState = { spaces: Space[]; boxes: Box[]; items: Item[] }

export const createMockState = (): MockState => ({ spaces: [], boxes: [], items: [] })

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
          boxes: [{ count: state.boxes.filter((box) => box.space_id === space.id).length }],
        })))
      }
      if (method === 'POST' && currentUserId) {
        const input = request.postDataJSON() as { name: string; description: string | null }
        const space = { ...input, id: `space-${state.spaces.length + 1}`, owner_id: currentUserId }
        state.spaces.push(space)
        return json(route, { id: space.id }, 201)
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
        return json(route, state.boxes.filter((box) => box.owner_id === currentUserId).map((box) => ({
          ...box,
          spaces: { name: state.spaces.find((space) => space.id === box.space_id)?.name ?? '' },
        })))
      }
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
  await page.getByLabel('空间名称').fill(name)
  await page.getByRole('button', { name: '创建空间' }).click()
  await page.getByRole('heading', { name, exact: true }).waitFor()
}

export async function createBox(page: Page, name: string, visibility: 'public' | 'private') {
  await page.goto('/app/boxes/new')
  await page.getByLabel('空间').selectOption({ label: '家' })
  await page.getByLabel('箱子名称').fill(name)
  await page.getByLabel('具体位置').fill('衣柜上层')
  await page.getByLabel('查看权限').selectOption(visibility)
  await page.getByRole('button', { name: '创建箱子' }).click()
  await page.getByText(/BX-\d{5}/).waitFor()
  return page.getByRole('link', { name: /\/b\// }).getAttribute('href') as Promise<string>
}

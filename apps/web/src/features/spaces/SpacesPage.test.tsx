import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { SpacesPage } from './SpacesPage'

const { mockCreateSpace, mockDeleteSpace, mockListSpaceLayouts, mockListSpaces, mockSaveSpaceLayout, mockStorageGetItem, mockStorageSetItem, mockUpdateSpace } = vi.hoisted(() => ({
  mockCreateSpace: vi.fn(),
  mockDeleteSpace: vi.fn(),
  mockListSpaceLayouts: vi.fn(),
  mockListSpaces: vi.fn(),
  mockSaveSpaceLayout: vi.fn(),
  mockStorageGetItem: vi.fn(),
  mockStorageSetItem: vi.fn(),
  mockUpdateSpace: vi.fn(),
}))

vi.mock('./spaces.api', () => ({
  createSpace: mockCreateSpace,
  deleteSpace: mockDeleteSpace,
  listSpaceLayouts: mockListSpaceLayouts,
  listSpaces: mockListSpaces,
  isLayoutStorageUnavailable: (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'LAYOUT_STORAGE_UNAVAILABLE'),
  saveSpaceLayout: mockSaveSpaceLayout,
  updateSpace: mockUpdateSpace,
}))

function renderSpaces() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <MemoryRouter>
        <div data-app-shell>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </div>
      </MemoryRouter>
    )
  }

  return render(<SpacesPage />, { wrapper: Wrapper })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

beforeEach(() => {
  mockCreateSpace.mockReset()
  mockDeleteSpace.mockReset()
  mockListSpaceLayouts.mockReset()
  mockListSpaces.mockReset()
  mockSaveSpaceLayout.mockReset()
  mockStorageGetItem.mockReset()
  mockStorageSetItem.mockReset()
  mockUpdateSpace.mockReset()
  mockListSpaceLayouts.mockResolvedValue([])
  mockSaveSpaceLayout.mockResolvedValue(undefined)
  mockStorageGetItem.mockReturnValue(null)
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: { getItem: mockStorageGetItem, setItem: mockStorageSetItem },
  })
})

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

test('shows toolbar and space-card skeletons while the cards view initially loads', () => {
  mockListSpaces.mockReturnValue(new Promise(() => undefined))
  renderSpaces()

  const loading = screen.getByRole('status', { name: '正在加载空间' })
  const visualLayout = loading.querySelector(':scope > [aria-hidden="true"]')
  expect(visualLayout).toHaveClass('grid', 'gap-5')
  expect(visualLayout?.children).toHaveLength(2)
  expect(visualLayout?.children[1]).toHaveClass('sm:grid-cols-2', 'xl:grid-cols-3')
  expect(visualLayout?.querySelector('.rounded-shell')).not.toBeInTheDocument()
  expect(screen.queryByText('正在加载空间…')).not.toBeInTheDocument()
})

test('shows toolbar and plan skeletons while the plan view initially loads', () => {
  mockStorageGetItem.mockReturnValue('plan')
  mockListSpaces.mockReturnValue(new Promise(() => undefined))
  renderSpaces()

  const loading = screen.getByRole('status', { name: '正在加载空间' })
  const visualLayout = loading.querySelector(':scope > [aria-hidden="true"]')
  expect(visualLayout).toHaveClass('grid', 'gap-5')
  expect(visualLayout?.children).toHaveLength(2)
  expect(visualLayout?.children[1]).toHaveClass('rounded-shell')
  expect(visualLayout?.querySelector('.sm\\:grid-cols-2')).not.toBeInTheDocument()
})

test('keeps the create editor closed until the prominent action is used', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([])
  renderSpaces()

  await screen.findByText('还没有空间')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('空间名称')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '创建空间' }))

  const dialog = screen.getByRole('dialog', { name: '创建空间' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveClass(
    'max-h-[calc(100dvh-1.5rem)]',
    'max-w-lg',
    'bg-surface',
    'p-6',
  )
  expect(dialog.parentElement).toHaveClass(
    'flex',
    'items-end',
    'justify-center',
    'p-3',
    'sm:items-center',
  )
  expect(dialog.parentElement).not.toHaveClass('backdrop-blur-sm')
  const nameInput = within(dialog).getByLabelText('空间名称')
  expect(nameInput).toHaveValue('')
  expect(nameInput).toHaveFocus()
  expect(within(dialog).getByLabelText('描述（可选）')).toHaveValue('')
})

test('isolates and restores the real application shell around the portalled editor', async () => {
  const user = userEvent.setup()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  mockListSpaces.mockResolvedValue([])
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app/spaces']}>
        <AuthProvider session={{ user: { id: 'user-1', email: 'lin@example.com', user_metadata: {} } } as unknown as import('@supabase/supabase-js').Session}>
          <Routes>
            <Route path="/app" element={<AppShell />}>
              <Route path="spaces" element={<SpacesPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  await screen.findByText('还没有空间')
  const appShell = document.querySelector('[data-app-shell]')
  expect(appShell).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '创建空间' }))
  expect(screen.getByRole('dialog', { name: '创建空间' })).toBeInTheDocument()
  expect(appShell).toHaveAttribute('inert')
  expect(appShell).toHaveAttribute('aria-hidden', 'true')

  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '取消' }))
  expect(appShell).not.toHaveAttribute('inert')
  expect(appShell).not.toHaveAttribute('aria-hidden')
})

test('creates a space, closes the editor, and resets it for the next create', async () => {
  const user = userEvent.setup()
  mockListSpaces
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { id: 'space-home', name: '家', description: null, box_count: 0, item_count: 0 },
    ])
  mockCreateSpace.mockResolvedValue({ id: 'space-home' })
  renderSpaces()

  await screen.findByText('还没有空间')
  await user.click(screen.getByRole('button', { name: '创建空间' }))
  await user.type(screen.getByLabelText('空间名称'), '家')
  await user.click(
    within(screen.getByRole('dialog', { name: '创建空间' })).getByRole('button', {
      name: '创建空间',
    }),
  )

  expect(mockCreateSpace).toHaveBeenCalledWith({
    name: '家',
    description: null,
  })
  expect(await screen.findByText('家')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(document.querySelector('[data-app-shell]')).not.toHaveAttribute('inert')
  expect(document.querySelector('[data-app-shell]')).not.toHaveAttribute('aria-hidden')
  expect(document.body.style.overflow).toBe('')

  await user.click(screen.getByRole('button', { name: '创建空间' }))
  expect(screen.getByLabelText('空间名称')).toHaveValue('')
  expect(screen.getByLabelText('描述（可选）')).toHaveValue('')
})

test('isolates the app and locks scrolling while open, then restores on cancel and unmount', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([])
  const view = renderSpaces()

  await screen.findByText('还没有空间')
  await user.click(screen.getByRole('button', { name: '创建空间' }))

  const appShell = document.querySelector('[data-app-shell]')
  expect(appShell).toHaveAttribute('inert')
  expect(appShell).toHaveAttribute('aria-hidden', 'true')
  expect(document.body.style.overflow).toBe('hidden')
  expect(appShell).not.toContainElement(screen.getByRole('dialog', { name: '创建空间' }))

  await user.click(screen.getByRole('button', { name: '取消' }))
  expect(appShell).not.toHaveAttribute('inert')
  expect(appShell).not.toHaveAttribute('aria-hidden')
  expect(document.body.style.overflow).toBe('')

  await user.click(screen.getByRole('button', { name: '创建空间' }))
  view.unmount()
  expect(appShell).not.toHaveAttribute('inert')
  expect(appShell).not.toHaveAttribute('aria-hidden')
  expect(document.body.style.overflow).toBe('')
})

test('restores pre-existing shell and body isolation values', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([])
  renderSpaces()

  await screen.findByText('还没有空间')
  const createButton = screen.getByRole('button', { name: '创建空间' })
  const appShell = document.querySelector('[data-app-shell]')!
  appShell.setAttribute('inert', '')
  appShell.setAttribute('aria-hidden', 'false')
  document.body.style.overflow = 'clip'
  fireEvent.click(createButton)

  expect(screen.getByRole('dialog', { name: '创建空间' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '取消' }))

  expect(appShell).toHaveAttribute('inert')
  expect(appShell).toHaveAttribute('aria-hidden', 'false')
  expect(document.body.style.overflow).toBe('clip')
})

test('restores focus to the persistent create action when the empty-state opener unmounts', async () => {
  const user = userEvent.setup()
  mockListSpaces
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { id: 'space-home', name: '家', description: null, box_count: 0, item_count: 0 },
    ])
  mockCreateSpace.mockResolvedValue({ id: 'space-home' })
  renderSpaces()

  await screen.findByText('还没有空间')
  await user.click(screen.getByRole('button', { name: '创建第一个空间' }))
  await user.type(screen.getByLabelText('空间名称'), '家')
  await user.click(
    within(screen.getByRole('dialog', { name: '创建空间' })).getByRole('button', {
      name: '创建空间',
    }),
  )

  await screen.findByText('家')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '创建空间' })).toHaveFocus()
})

test('opens the edit panel with populated values, then updates and resets it', async () => {
  const user = userEvent.setup()
  mockListSpaces
    .mockResolvedValueOnce([
      { id: 's1', name: '家', description: '一楼', box_count: 0, item_count: 3 },
    ])
    .mockResolvedValueOnce([
      { id: 's1', name: '新家', description: '搬家后', box_count: 0, item_count: 3 },
    ])
  mockUpdateSpace.mockResolvedValue(undefined)
  renderSpaces()

  await user.click(await screen.findByRole('button', { name: '编辑家' }))
  const dialog = screen.getByRole('dialog', { name: '编辑空间' })
  const nameInput = within(dialog).getByLabelText('空间名称')
  expect(nameInput).toHaveValue('家')
  expect(within(dialog).getByLabelText('描述（可选）')).toHaveValue('一楼')

  await user.clear(nameInput)
  await user.type(nameInput, '新家')
  await user.clear(screen.getByLabelText('描述（可选）'))
  await user.type(screen.getByLabelText('描述（可选）'), '搬家后')
  await user.click(screen.getByRole('button', { name: '保存空间' }))

  expect(mockUpdateSpace).toHaveBeenCalledWith('s1', {
    name: '新家',
    description: '搬家后',
  })
  expect(await screen.findByText('新家')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '创建空间' }))
  expect(screen.getByLabelText('空间名称')).toHaveValue('')
})

test('cancel and close dismiss the editor and reset entered values', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([])
  renderSpaces()

  await screen.findByText('还没有空间')
  const emptyCreateButton = screen.getByRole('button', { name: '创建第一个空间' })
  await user.click(emptyCreateButton)
  await user.type(screen.getByLabelText('空间名称'), '未保存')
  await user.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(emptyCreateButton).toHaveFocus()

  await user.click(screen.getByRole('button', { name: '创建空间' }))
  expect(screen.getByLabelText('空间名称')).toHaveValue('')
  await user.type(screen.getByLabelText('空间名称'), '仍未保存')
  await user.click(screen.getByRole('button', { name: '关闭创建空间编辑器' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '创建空间' }))
  expect(screen.getByLabelText('空间名称')).toHaveValue('')
})

test('dismisses with Escape or a backdrop click and wraps keyboard focus', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([])
  renderSpaces()

  await screen.findByText('还没有空间')
  await user.click(screen.getByRole('button', { name: '创建空间' }))
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '创建空间' }))
  const dialog = screen.getByRole('dialog', { name: '创建空间' })
  const closeButton = within(dialog).getByRole('button', { name: '关闭创建空间编辑器' })
  const submitButton = within(dialog).getByRole('button', { name: '创建空间' })
  submitButton.focus()
  await user.tab()
  expect(closeButton).toHaveFocus()
  closeButton.focus()
  await user.tab({ shift: true })
  expect(submitButton).toHaveFocus()

  fireEvent.mouseDown(dialog.parentElement!)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('restores focus to the edit opener after cancelling', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '家', description: null, box_count: 0, item_count: 0 },
  ])
  renderSpaces()

  const editButton = await screen.findByRole('button', { name: '编辑家' })
  await user.click(editButton)
  await user.click(screen.getByRole('button', { name: '取消' }))

  expect(editButton).toHaveFocus()
})

test('announces pending saves and prevents dismissal or duplicate submission', async () => {
  const user = userEvent.setup()
  const createResult = deferred<{ id: string }>()
  mockListSpaces.mockResolvedValue([])
  mockCreateSpace.mockReturnValue(createResult.promise)
  renderSpaces()

  await screen.findByText('还没有空间')
  await user.click(screen.getByRole('button', { name: '创建空间' }))
  await user.type(screen.getByLabelText('空间名称'), '家')
  const dialog = screen.getByRole('dialog', { name: '创建空间' })
  const form = within(dialog).getByRole('button', { name: '创建空间' }).closest('form')!
  await user.click(within(dialog).getByRole('button', { name: '创建空间' }))

  expect(await screen.findByRole('status')).toHaveTextContent('正在保存空间…')
  expect(dialog).toHaveAttribute('aria-busy', 'true')
  await user.keyboard('{Escape}')
  fireEvent.mouseDown(dialog.parentElement!)
  fireEvent.submit(form)
  expect(screen.getByRole('dialog', { name: '创建空间' })).toBeInTheDocument()
  expect(mockCreateSpace).toHaveBeenCalledTimes(1)

  createResult.resolve({ id: 'space-home' })
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

test('keeps the editor open with a safe error when an update fails', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '家', description: null, box_count: 0, item_count: 0 },
  ])
  mockUpdateSpace.mockRejectedValue(new Error('sensitive update details'))
  renderSpaces()

  await user.click(await screen.findByRole('button', { name: '编辑家' }))
  await user.clear(screen.getByLabelText('空间名称'))
  await user.type(screen.getByLabelText('空间名称'), '新家')
  await user.click(screen.getByRole('button', { name: '保存空间' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请稍后重试')
  expect(screen.getByRole('dialog', { name: '编辑空间' })).toBeInTheDocument()
  expect(screen.queryByText('sensitive update details')).not.toBeInTheDocument()
})

test('connects validation errors to invalid editor fields', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([])
  renderSpaces()

  await screen.findByText('还没有空间')
  await user.click(screen.getByRole('button', { name: '创建空间' }))
  const dialog = screen.getByRole('dialog', { name: '创建空间' })
  fireEvent.change(within(dialog).getByLabelText('描述（可选）'), {
    target: { value: '长'.repeat(501) },
  })
  await user.click(within(dialog).getByRole('button', { name: '创建空间' }))

  const nameInput = within(dialog).getByLabelText('空间名称')
  const descriptionInput = within(dialog).getByLabelText('描述（可选）')
  expect(nameInput).toHaveAttribute('aria-invalid', 'true')
  expect(nameInput).toHaveAttribute('aria-describedby', 'space-name-error')
  expect(within(dialog).getByText('请输入空间名称')).toHaveAttribute('id', 'space-name-error')
  expect(descriptionInput).toHaveAttribute('aria-invalid', 'true')
  expect(descriptionInput).toHaveAttribute('aria-describedby', 'space-description-error')
  expect(within(dialog).getByText('描述最多 500 字')).toHaveAttribute(
    'id',
    'space-description-error',
  )
})

test('renders direct navigation cards with exact counts and separate actions', async () => {
  mockListSpaces.mockResolvedValue([
    { id: 'home / 1', name: '家', description: '日常收纳', box_count: 2, item_count: 5 },
  ])
  renderSpaces()

  const cardLink = await screen.findByRole('link', { name: /家/ })
  expect(cardLink).toHaveAttribute('href', '/app/boxes?space=home%20%2F%201')
  expect(within(cardLink).getByText('日常收纳')).toBeInTheDocument()
  expect(within(cardLink).getByText('2 个箱子')).toBeInTheDocument()
  expect(within(cardLink).getByText('5 件物品')).toBeInTheDocument()
  expect(within(cardLink).queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '编辑家' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '删除家' })).toBeInTheDocument()
})

test('defaults to cards and remembers the optional plan view', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '客厅', description: '公共区域', box_count: 2, item_count: 5 },
  ])
  renderSpaces()

  expect(await screen.findByRole('button', { name: '卡片视图' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('article')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '平面视图' }))

  expect(screen.getByRole('button', { name: '平面视图' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('region', { name: '家庭平面总览' })).toBeInTheDocument()
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(mockStorageSetItem).toHaveBeenCalledWith('nomo-space-view', 'plan')
})

test('restores a previously selected plan view', async () => {
  mockStorageGetItem.mockReturnValue('plan')
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '客厅', description: null, box_count: 0, item_count: 0 },
  ])
  renderSpaces()

  expect(await screen.findByRole('button', { name: '平面视图' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('region', { name: '家庭平面总览' })).toBeInTheDocument()
})

test('reports a real layout query failure without hiding the automatic plan', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '客厅', description: null, box_count: 0, item_count: 0 },
  ])
  mockListSpaceLayouts.mockRejectedValue(new Error('database unavailable'))
  renderSpaces()

  await user.click(await screen.findByRole('button', { name: '平面视图' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('布局加载失败；当前显示自动布局')
  expect(screen.getByRole('region', { name: '家庭平面总览' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '调整布局' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '重试布局' })).toBeInTheDocument()
})

test('keeps automatic layout read-only when layout SQL is not installed', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '客厅', description: null, box_count: 0, item_count: 0 },
  ])
  mockListSpaceLayouts.mockRejectedValue({ code: 'LAYOUT_STORAGE_UNAVAILABLE' })
  renderSpaces()

  await user.click(await screen.findByRole('button', { name: '平面视图' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('布局保存尚未启用，请先执行 space_layouts 数据库迁移')
  expect(screen.getByRole('button', { name: '调整布局' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: '重试布局' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: '家庭平面总览' })).toBeInTheDocument()
})

test('does not enable layout editing before stored positions finish loading', async () => {
  const layoutResult = deferred<never[]>()
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '客厅', description: null, box_count: 0, item_count: 0 },
  ])
  mockListSpaceLayouts.mockReturnValue(layoutResult.promise)
  renderSpaces()

  fireEvent.click(await screen.findByRole('button', { name: '平面视图' }))
  const loadingControl = screen.getByRole('button', { name: '布局加载中' })
  expect(loadingControl).toBeDisabled()
  expect(loadingControl).toHaveAttribute('title', '布局加载中')
  expect(within(loadingControl).getByTestId('skeleton')).toBeInTheDocument()
  expect(within(loadingControl).getByTestId('skeleton').tagName).toBe('SPAN')
  expect(screen.queryByText('正在加载布局…')).not.toBeInTheDocument()
  layoutResult.resolve([])
  expect(await screen.findByRole('button', { name: '调整布局' })).toBeEnabled()
})

test('saves a keyboard layout change while plan editing is enabled', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '客厅', description: null, box_count: 2, item_count: 5 },
  ])
  renderSpaces()

  await user.click(await screen.findByRole('button', { name: '平面视图' }))
  await user.click(screen.getByRole('button', { name: '调整布局' }))
  fireEvent.keyDown(screen.getByRole('link', { name: /客厅/ }), { key: 'ArrowRight' })

  await waitFor(() => expect(mockSaveSpaceLayout).toHaveBeenCalledWith('s1', {
    x: 22,
    y: 29,
    width: 60,
    height: 42,
  }))
})

test('serializes repeated layout saves so older writes cannot finish last', async () => {
  const firstSave = deferred<void>()
  mockSaveSpaceLayout.mockReset()
  mockSaveSpaceLayout.mockReturnValueOnce(firstSave.promise).mockResolvedValueOnce(undefined)
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '客厅', description: null, box_count: 2, item_count: 5 },
  ])
  renderSpaces()

  fireEvent.click(await screen.findByRole('button', { name: '平面视图' }))
  fireEvent.click(screen.getByRole('button', { name: '调整布局' }))
  const room = screen.getByRole('link', { name: /客厅/ })
  fireEvent.keyDown(room, { key: 'ArrowRight' })
  fireEvent.keyDown(room, { key: 'ArrowRight' })

  await waitFor(() => expect(mockSaveSpaceLayout).toHaveBeenCalledTimes(1))
  firstSave.resolve()
  await waitFor(() => expect(mockSaveSpaceLayout).toHaveBeenCalledTimes(2))
  expect(mockSaveSpaceLayout).toHaveBeenLastCalledWith('s1', { x: 24, y: 29, width: 60, height: 42 })
})

test('explains why a non-empty space cannot be deleted', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '家', description: null, box_count: 2, item_count: 5 },
  ])
  renderSpaces()

  await user.click(await screen.findByRole('button', { name: '删除家' }))

  expect(screen.getByRole('button', { name: '删除家' })).not.toHaveAttribute('aria-disabled')
  expect(screen.getByRole('alert')).toHaveTextContent(
    '请先移动或删除其中的 2 个箱子',
  )
  expect(mockDeleteSpace).not.toHaveBeenCalled()
})

test('restores focus to a programmatically activated delete trigger on cancel', async () => {
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '空房间', description: null, box_count: 0, item_count: 0 },
  ])
  renderSpaces()

  const deleteButton = await screen.findByRole('button', { name: '删除空房间' })
  fireEvent.click(deleteButton)
  fireEvent.click(screen.getByRole('button', { name: '取消' }))

  await waitFor(() => expect(deleteButton).toHaveFocus())
})

test('focuses the persistent create action after deleting an empty space', async () => {
  const user = userEvent.setup()
  mockListSpaces
    .mockResolvedValueOnce([
      { id: 's1', name: '空房间', description: null, box_count: 0, item_count: 0 },
    ])
    .mockResolvedValueOnce([])
  mockDeleteSpace.mockResolvedValue(undefined)
  renderSpaces()

  await user.click(await screen.findByRole('button', { name: '删除空房间' }))
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  expect(mockDeleteSpace).toHaveBeenCalledWith('s1')
  expect(await screen.findByText('还没有空间')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '创建空间' })).toHaveFocus()
})

test('keeps localized mutation errors without leaking backend text', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '空房间', description: null, box_count: 0, item_count: 0 },
  ])
  mockCreateSpace.mockRejectedValue(new Error('sensitive create details'))
  mockDeleteSpace.mockRejectedValue(new Error('sensitive delete details'))
  renderSpaces()

  await screen.findByText('空房间')
  await user.click(screen.getByRole('button', { name: '创建空间' }))
  await user.type(screen.getByLabelText('空间名称'), '失败空间')
  await user.click(
    within(screen.getByRole('dialog', { name: '创建空间' })).getByRole('button', {
      name: '创建空间',
    }),
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请稍后重试')
  expect(screen.getByRole('dialog', { name: '创建空间' })).toBeInTheDocument()
  expect(screen.queryByText('sensitive create details')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '取消' }))
  const deleteButton = screen.getByRole('button', { name: '删除空房间' })
  await user.click(deleteButton)
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('删除失败，请稍后重试')
  expect(screen.queryByText('sensitive delete details')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '确认删除' })).toHaveFocus()

  await user.click(screen.getByRole('button', { name: '取消' }))
  await waitFor(() => expect(deleteButton).toHaveFocus())
})

import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider, useI18n } from '../i18n/I18nProvider'
import { MobileFeedbackProvider } from '../components/MobileFeedbackProvider'
import { AuthContext } from './auth/auth-context'
import { getAuthErrorMessage } from './auth/auth-errors'
import { ScannerPage } from './scanner/ScannerPage'
import { PrintBoxSelector } from './qr-print/PrintBoxSelector'
import { PackingChecklistSection } from './packing/PackingChecklistSection'
import { PackingPhotoDeck } from './packing/PackingPhotoDeck'
import { VenueEditorDialog } from './venues/VenueEditorDialog'
import { CreditsPage } from './credits/CreditsPage'
import { CreditGateSheet } from './credits/CreditGateSheet'
import { AccountDetailsPage } from './profile/AccountDetailsPage'
import { AccountAvatar } from './profile/account-view'
import { ItemForm } from './items/ItemForm'
import { ItemMovementSheet } from './item-movements/ItemMovementSheet'
import type { BoxSummary } from './boxes/boxes.api'
import type { PackingPhoto } from './packing/packing.api'

const mocks = vi.hoisted(() => ({
  scannerStart: vi.fn(),
  packingSessions: vi.fn(),
  packingItems: vi.fn(),
  packingPhoto: vi.fn(),
  packingPromotion: vi.fn(),
  packingMerge: vi.fn(),
  packingPromote: vi.fn(),
  packingReanalysis: vi.fn(),
  packingUpdate: vi.fn(),
  creditSummary: vi.fn(),
  creditTransactions: vi.fn(),
  checkout: vi.fn(),
  profile: vi.fn(),
  avatarDownload: vi.fn(),
  avatarUpload: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: class {
    decodeFromConstraints = mocks.scannerStart
  },
}))
vi.mock('./packing/packing.api', () => ({
  getPackingPhoto: mocks.packingPhoto,
  getPackingItemPromotion: mocks.packingPromotion,
  listDetectedPackingItems: mocks.packingItems,
  listPackingSessions: mocks.packingSessions,
  mergeDetectedPackingItems: mocks.packingMerge,
  requestPackingItemPromotion: mocks.packingPromote,
  requestPackingReanalysis: mocks.packingReanalysis,
  updateDetectedPackingItem: mocks.packingUpdate,
}))
vi.mock('./packing/PackingAuthorizedImage', () => ({
  PackingAuthorizedImage: ({ alt }: { alt: string }) => <img src="signed:image" alt={alt} />,
}))
vi.mock('./credits/credits.api', () => ({
  getCreditSummary: mocks.creditSummary,
  listCreditTransactions: mocks.creditTransactions,
  startCheckout: mocks.checkout,
}))
vi.mock('./profile/profile.api', () => ({
  getProfile: mocks.profile,
  getAvatarDownload: mocks.avatarDownload,
  uploadAvatar: mocks.avatarUpload,
}))
vi.mock('./items/items.api', () => ({
  createItem: mocks.createItem,
  updateItem: mocks.updateItem,
}))
vi.mock('../media/useMediaUpload', () => ({
  useMediaUpload: () => ({ stage: 'idle', upload: mocks.upload, reset: vi.fn() }),
}))
vi.mock('../media/AuthorizedImage', () => ({
  AuthorizedImage: ({ alt }: { alt: string }) => <img src="signed:image" alt={alt} />,
}))

beforeEach(() => {
  mocks.scannerStart.mockReset().mockResolvedValue({ stop: vi.fn() })
  mocks.packingSessions.mockReset().mockResolvedValue([])
  mocks.packingItems.mockReset().mockResolvedValue([])
  mocks.packingPhoto.mockReset().mockResolvedValue(null)
  mocks.packingPromotion.mockReset().mockResolvedValue(null)
  mocks.packingMerge.mockReset().mockResolvedValue(undefined)
  mocks.packingPromote.mockReset().mockResolvedValue({ id: 'promotion-1' })
  mocks.packingReanalysis.mockReset().mockResolvedValue(undefined)
  mocks.packingUpdate.mockReset().mockResolvedValue(undefined)
  mocks.creditSummary.mockReset().mockResolvedValue({ credits_available: 82, credits_reserved: 3 })
  mocks.creditTransactions.mockReset().mockResolvedValue([])
  mocks.checkout.mockReset().mockReturnValue(new Promise(() => undefined))
  mocks.profile.mockReset().mockResolvedValue({ id: 'user-1', display_name: 'Lin', avatar_object_key: null, locale: 'en-US' })
  mocks.avatarDownload.mockReset().mockResolvedValue(null)
  mocks.avatarUpload.mockReset().mockResolvedValue('avatar-key')
  mocks.createItem.mockReset()
  mocks.updateItem.mockReset()
  mocks.upload.mockReset()
})

afterEach(() => {
  cleanup()
  try {
    window.localStorage?.clear()
  } catch {
    // jsdom may expose a window without a usable storage backend.
  }
  vi.unstubAllGlobals()
})

function LocaleSetter({ children }: { children: ReactNode }) {
  const { setLocale } = useI18n()
  useEffect(() => setLocale('en-US'), [setLocale])
  return <>{children}</>
}

function EnglishProvider({ children }: { children: ReactNode }) {
  return <I18nProvider><LocaleSetter>{children}</LocaleSetter></I18nProvider>
}

function renderEnglish(ui: ReactNode) {
  return render(<EnglishProvider>{ui}</EnglishProvider>)
}

function queryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

const boxes: BoxSummary[] = [{
  id: 'box-1', public_id: 'public-1', box_code: 'BX-001', name: 'Winter clothes',
  space_id: 'space-1', venue_name: 'Home', space_name: 'Bedroom', location: null, visibility: 'private',
  cover_object_key: null, item_count: 0, updated_at: '2026-08-08T00:00:00Z',
}]

test('scanner English permission error keeps title and accessible alert copy', async () => {
  const insecureWindow = Object.create(window) as Window & typeof globalThis
  Object.defineProperties(insecureWindow, {
    isSecureContext: { value: false },
    location: { value: { hostname: 'nomo.example' } },
  })
  vi.stubGlobal('window', insecureWindow)

  renderEnglish(<MemoryRouter><MobileFeedbackProvider><ScannerPage /></MobileFeedbackProvider></MemoryRouter>)

  expect(screen.getByRole('heading', { name: 'Scan to view' })).toBeInTheDocument()
  expect(await screen.findByRole('alertdialog', { name: 'This page is not HTTPS, so the camera is unavailable' })).toBeInTheDocument()
})

test('print selector exposes English search and download operations', () => {
  renderEnglish(<PrintBoxSelector boxes={boxes} totalCount={1} selected={new Set()} query="" generating={false} onQueryChange={vi.fn()} onToggle={vi.fn()} onToggleVisible={vi.fn()} onDownload={vi.fn()} />)

  expect(screen.getByRole('region', { name: 'Select boxes to print' })).toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Search boxes' })).toHaveAttribute('placeholder', 'Search box names, codes, or spaces')
  expect(screen.getByRole('button', { name: 'Download PDF' })).toBeDisabled()
})

test('packing photo deck uses English region and navigation labels', () => {
  const photos: PackingPhoto[] = [
    { id: 'photo-1', box_id: 'box-1', session_id: 'session-1', sequence_no: 1, object_key: 'packing/1.jpg', normalized_object_key: null, upload_status: 'confirmed', created_at: '2026-08-08T00:00:00Z', confirmed_at: '2026-08-08T00:00:00Z', mime_type: 'image/jpeg', size_bytes: 100, sha256: null, perceptual_hash: null, quality_flags: {}, width: null, height: null, owner_id: 'user-1', updated_at: '2026-08-08T00:00:00Z', upload_expires_at: '2026-08-08T01:00:00Z' },
    { id: 'photo-2', box_id: 'box-1', session_id: 'session-1', sequence_no: 2, object_key: 'packing/2.jpg', normalized_object_key: null, upload_status: 'confirmed', created_at: '2026-08-08T00:00:00Z', confirmed_at: '2026-08-08T00:00:00Z', mime_type: 'image/jpeg', size_bytes: 100, sha256: null, perceptual_hash: null, quality_flags: {}, width: null, height: null, owner_id: 'user-1', updated_at: '2026-08-08T00:00:00Z', upload_expires_at: '2026-08-08T01:00:00Z' },
  ]
  renderEnglish(<PackingPhotoDeck photos={photos} />)

  expect(screen.getByRole('region', { name: 'Captured photos' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous photo' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next photo' })).toBeInTheDocument()
})

test('packing checklist exposes the English failed-analysis stage', async () => {
  mocks.packingSessions.mockResolvedValue([{ id: 'session-1', box_id: 'box-1', status: 'failed', photo_count: 2, current_revision: 1 }])
  render(<EnglishProvider><QueryClientProvider client={queryClient()}><PackingChecklistSection boxId="box-1" venueId={null} onVenueAccessDenied={() => undefined} /></QueryClientProvider></EnglishProvider>)

  expect(await screen.findByRole('button', { name: /AI smart list/i })).toBeInTheDocument()
  expect(screen.getByText('Analysis is incomplete. Tap to review or analyze again.')).toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('button', { name: /AI smart list/i }))
  expect(await screen.findByRole('dialog', { name: 'AI smart list' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Analyze again' })).toBeInTheDocument()
})

test('venue editor renders English fields and validation copy', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  renderEnglish(<VenueEditorDialog open venue={null} pending={false} error={false} onClose={vi.fn()} onSubmit={onSubmit} onDelete={vi.fn()} />)
  const user = userEvent.setup()

  expect(screen.getByRole('dialog', { name: 'Create venue' })).toBeInTheDocument()
  expect(screen.getByLabelText('Venue name')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Create venue' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a venue name')
  expect(onSubmit).not.toHaveBeenCalled()
})

test('credits page and gate expose English purchase and unlock copy', async () => {
  const client = queryClient()
  render(<EnglishProvider><MemoryRouter><QueryClientProvider client={client}><CreditsPage /><CreditGateSheet open availableCredits={2} requiredCredits={5} onClose={vi.fn()} /></QueryClientProvider></MemoryRouter></EnglishProvider>)

  expect(await screen.findByRole('heading', { name: 'AI credits' })).toBeInTheDocument()
  expect(await screen.findByText('No auto-renewal')).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: /Buy 20 credits/ })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'More recognition credits needed' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Buy credits' })).toBeInTheDocument()
})

test('account details and avatar retain English heading and aria labels', async () => {
  const client = queryClient()
  render(
    <EnglishProvider>
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <AuthContext.Provider value={{ session: { user: { id: 'user-1', email: 'lin@example.com', user_metadata: {} } } as unknown as Session, loading: false, isPasswordRecovery: false }}>
            <AccountDetailsPage />
          </AuthContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>
    </EnglishProvider>,
  )

  expect(await screen.findByRole('heading', { name: 'Account details' })).toBeInTheDocument()
  expect(await screen.findByLabelText('Change avatar')).toBeInTheDocument()
  cleanup()
  renderEnglish(<AccountAvatar name="Lin" size="sm" />)
  expect(screen.getByLabelText('Lin avatar')).toBeInTheDocument()
})

test('item form validates required name and announces English success', async () => {
  const client = queryClient()
  const onSaved = vi.fn()
  render(<EnglishProvider><MobileFeedbackProvider><QueryClientProvider client={client}><ItemForm boxId="box-1" onSaved={onSaved} /></QueryClientProvider></MobileFeedbackProvider></EnglishProvider>)
  const user = userEvent.setup()

  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Enter an item name')).toBeInTheDocument()

  mocks.createItem.mockResolvedValue({ id: 'item-1' })
  await user.type(screen.getByLabelText('Item name'), 'Lantern')
  expect(screen.getByRole('button', { name: 'Add item image' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('status', { name: 'Item created' })).toBeInTheDocument()
  expect(onSaved).toHaveBeenCalledOnce()
})

test('movement sheet exposes English availability and operation labels', () => {
  renderEnglish(<ItemMovementSheet open currentBoxId="box-1" item={{ id: 'item-1', name: 'Lantern', category: null, quantity: 3, stored_quantity: 2, description: null, image_object_key: null }} boxes={[]} pending={false} onClose={vi.fn()} onEdit={vi.fn()} onSubmit={vi.fn().mockResolvedValue(undefined)} />)

  expect(screen.getByText('Partially out · 2/3 stored')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Take out/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'View movement history' })).toBeInTheDocument()
})

function AuthErrorProbe() {
  const { t } = useI18n()
  return <output>{getAuthErrorMessage(new Error('Invalid login credentials'), t)}</output>
}

test('auth error helper renders the translated English error key', () => {
  renderEnglish(<AuthErrorProbe />)
  expect(screen.getByText('The email or password is incorrect.')).toBeInTheDocument()
})

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { LegalDocumentPage } from './LegalDocumentPage'
import { LEGAL_POLICY_VERSION } from './legal-policy'

afterEach(cleanup)

function renderDocument(kind: 'privacy' | 'terms', entry: string) {
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/legal/:document" element={<LegalDocumentPage kind={kind} />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

test('renders the Chinese privacy Markdown by default', () => {
  renderDocument('privacy', '/legal/privacy')

  expect(screen.getByRole('heading', { name: 'Nomo 隐私政策' })).toBeInTheDocument()
  expect(screen.getByRole('main').closest('.legal-page')).toHaveAttribute('lang', 'zh-CN')
  expect(screen.getByRole('link', { name: '← 返回注册' })).toHaveAttribute('href', '/register')
})

test('switches the terms Markdown to English and updates the URL', () => {
  renderDocument('terms', '/legal/terms?lang=zh-CN')

  fireEvent.change(screen.getByRole('combobox', { name: '语言' }), {
    target: { value: 'en-US' },
  })

  expect(screen.getByRole('heading', { name: 'Nomo Terms of Service' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en-US')
  expect(document.documentElement.lang).toBe('en-US')
})

test('publishes the venue-sharing privacy, optional analytics, and responsibility boundaries in both languages', () => {
  renderDocument('privacy', '/legal/privacy?lang=zh-CN')
  expect(screen.getByRole('main')).toHaveTextContent('同一场地的成员可以看到彼此的展示名、头像、共享内容和操作快照')
  expect(screen.getByRole('main')).toHaveTextContent('退出后，历史操作中的展示名快照仍会保留')
  expect(screen.getByRole('main')).toHaveTextContent('邀请链接持有人在加入前可以查看最小场地信息')
  expect(screen.getByRole('main')).toHaveTextContent('可选，并且仅在你同意后启用')
  expect(screen.getByRole('main')).toHaveTextContent('第三方产品分析服务商 PostHog')
  expect(screen.getByRole('main')).toHaveTextContent('家庭照片、物品名称、搜索词、二维码内容或支付详情')
  expect(screen.getByRole('main')).toHaveTextContent('生效日期：2026 年 8 月 11 日')

  fireEvent.change(screen.getByRole('combobox', { name: '语言' }), { target: { value: 'en-US' } })
  expect(screen.getByRole('main')).toHaveTextContent('Members of the same venue can see each other’s display names, avatars, shared content, and activity snapshots')
  expect(screen.getByRole('main')).toHaveTextContent('Historical display-name snapshots remain after a member leaves')
  expect(screen.getByRole('main')).toHaveTextContent('An invitation-link holder can view minimal venue information before joining')
  expect(screen.getByRole('main')).toHaveTextContent('optional and start only after you consent')
  expect(screen.getByRole('main')).toHaveTextContent('third-party product analytics provider, PostHog')
  expect(screen.getByRole('main')).toHaveTextContent('household photos, item names, search terms, QR contents, or payment details')
  expect(screen.getByRole('main')).toHaveTextContent('Effective date: August 11, 2026')

  cleanup()
  renderDocument('terms', '/legal/terms?lang=zh-CN')
  expect(screen.getByRole('main')).toHaveTextContent('所有者负责发放和撤销邀请')
  expect(screen.getByRole('main')).toHaveTextContent('成员可以删除物品，但不能删除箱子、空间或场地')
  expect(screen.getByRole('main')).toHaveTextContent('所有者箱子额度与每位成员本人的 AI Credits 分离')

  cleanup()
  renderDocument('terms', '/legal/terms?lang=en-US')
  expect(screen.getByRole('main')).toHaveTextContent('Owners are responsible for issuing and revoking invitations')
  expect(screen.getByRole('main')).toHaveTextContent('Members may delete items but may not delete boxes, spaces, or venues')
  expect(screen.getByRole('main')).toHaveTextContent('The owner’s box allowance is separate from each member’s own AI Credits')
  expect(LEGAL_POLICY_VERSION).toBe('2026-08-11')
})

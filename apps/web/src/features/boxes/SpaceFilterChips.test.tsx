import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState, type PropsWithChildren } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { SpaceFilterChips } from './SpaceFilterChips'
import { I18nProvider, useI18n } from '../../i18n/I18nProvider'

afterEach(cleanup)

function SpaceChipsHarness({ onChange }: { onChange: (spaceId: string) => void }) {
  const [selectedSpace, setSelectedSpace] = useState('space-bedroom')
  const spaces: ReadonlyArray<{ id: string; name: string; count: number }> = [
    { id: 'space-bedroom', name: '卧室', count: 4 },
    { id: 'space-kitchen', name: '厨房', count: 2 },
  ]

  return <SpaceFilterChips
    spaces={spaces}
    selectedSpace={selectedSpace}
    totalCount={6}
    onChange={(spaceId) => {
      onChange(spaceId)
      setSelectedSpace(spaceId)
    }}
  />
}

test('renders accessible filter chips and updates their pressed state', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<SpaceChipsHarness onChange={onChange} />)

  expect(screen.getByRole('group', { name: '按空间筛选' })).toBeInTheDocument()
  const allSpaces = screen.getByRole('button', { name: '全部空间 6' })
  const bedroom = screen.getByRole('button', { name: '卧室 4' })
  const kitchen = screen.getByRole('button', { name: '厨房 2' })
  expect(allSpaces).toHaveAttribute('aria-pressed', 'false')
  expect(bedroom).toHaveAttribute('aria-pressed', 'true')
  expect(kitchen).toHaveAttribute('aria-pressed', 'false')

  await user.click(kitchen)

  expect(onChange).toHaveBeenCalledWith('space-kitchen')
  expect(kitchen).toHaveAttribute('aria-pressed', 'true')
  expect(bedroom).toHaveAttribute('aria-pressed', 'false')
})

test('keeps filter chips horizontally scrollable', () => {
  render(<SpaceChipsHarness onChange={vi.fn()} />)

  expect(screen.getByRole('group', { name: '按空间筛选' })).toHaveClass('overflow-x-auto', 'space-filter-scroll')
  expect(screen.getByRole('button', { name: '全部空间 6' })).toHaveClass('min-h-11', 'shrink-0')
})

test('renders filter labels in English', async () => {
  function EnglishProvider({ children }: PropsWithChildren) {
    const { setLocale } = useI18n()
    useEffect(() => setLocale('en-US'), [setLocale])
    return <>{children}</>
  }
  render(
    <I18nProvider>
      <EnglishProvider><SpaceChipsHarness onChange={vi.fn()} /></EnglishProvider>
    </I18nProvider>,
  )

  expect(await screen.findByRole('group', { name: 'Filter by space' })).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'All spaces 6' })).toBeInTheDocument()
})

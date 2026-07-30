import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { BoxFormPage } from './BoxFormPage'

const { mockBoxForm } = vi.hoisted(() => ({ mockBoxForm: vi.fn() }))

vi.mock('./BoxForm', () => ({
  BoxForm: (props: unknown) => {
    mockBoxForm(props)
    return <div>box form</div>
  },
}))

test('passes the edit route id to the reusable page form', () => {
  render(
    <MemoryRouter initialEntries={['/app/boxes/box-1/edit']}>
      <Routes>
        <Route path="/app/boxes/:boxId/edit" element={<BoxFormPage />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.getByText('box form')).toBeInTheDocument()
  expect(mockBoxForm).toHaveBeenCalledWith({ boxId: 'box-1', presentation: 'page' })
})

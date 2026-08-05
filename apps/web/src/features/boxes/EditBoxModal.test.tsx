import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { EditBoxModal } from './EditBoxModal'

const { mockBoxForm } = vi.hoisted(() => ({ mockBoxForm: vi.fn() }))

vi.mock('./BoxForm', () => ({
  BoxForm: (props: unknown) => {
    mockBoxForm(props)
    return <form><select aria-label="空间"><option>家</option></select></form>
  },
}))

afterEach(() => {
  mockBoxForm.mockReset()
  document.body.innerHTML = ''
})

test('renders the editing form in the shared responsive dialog and forwards completion', () => {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const returnFocusRef = createRef<HTMLElement>()

  render(<EditBoxModal open boxId="box-1" returnFocusRef={returnFocusRef} onClose={onClose} onSaved={onSaved} />)

  expect(screen.getByRole('dialog', { name: '编辑箱子' })).toBeInTheDocument()
  expect(mockBoxForm).toHaveBeenCalledWith(expect.objectContaining({
    boxId: 'box-1', presentation: 'modal', onSaved,
  }))
})

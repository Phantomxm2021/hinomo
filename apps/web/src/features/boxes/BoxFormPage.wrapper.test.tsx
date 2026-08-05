import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { expect, test } from 'vitest'
import { BoxFormPage } from './BoxFormPage'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

test('redirects the legacy edit route to the catalogue edit dialog state', () => {
  render(
    <MemoryRouter initialEntries={['/app/boxes/box-1/edit']}>
      <Routes>
        <Route path="/app/boxes/:boxId/edit" element={<BoxFormPage />} />
        <Route path="/app/boxes" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.getByTestId('location')).toHaveTextContent('/app/boxes?edit=box-1')
})

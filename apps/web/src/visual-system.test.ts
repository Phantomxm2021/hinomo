/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

test('defines the integrated dashboard and authentication visual system', () => {
  expect(css).toContain('.dashboard-hero {')
  expect(css).toContain('.dashboard-stats {')
  expect(css).toContain('.quick-actions {')
  expect(css).toContain('.auth-shell {')
  expect(css).toContain(':focus-visible')
  expect(css).toContain('@media (prefers-reduced-motion: reduce)')
})

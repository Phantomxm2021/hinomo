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

test('reserves mobile content space for the elevated navigation action', () => {
  expect(css).toContain('padding: 24px 20px calc(128px + env(safe-area-inset-bottom));')
})

test('gives the active mobile scan action a distinct visible treatment', () => {
  expect(css).toContain('.mobile-scan-action.active .nav-icon {')
})

test('allows the fixed desktop sidebar to scroll in short viewports', () => {
  expect(css).toMatch(/\.desktop-sidebar\s*\{[^}]*overflow-y: auto;/)
})

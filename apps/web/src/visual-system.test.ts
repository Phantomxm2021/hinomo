/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8')
const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')

test('defines the approved Tailwind warm-family theme', () => {
  expect(css.startsWith('@import "tailwindcss";')).toBe(true)
  for (const token of [
    '--color-canvas: #f8f2e8;',
    '--color-surface: #fffdf8;',
    '--color-sidebar: #f0e3d3;',
    '--color-ink: #30271e;',
    '--color-muted: #756a5e;',
    '--color-brand: #df6538;',
    '--color-brand-strong: #c95229;',
    '--color-success: #71896f;',
    '--color-danger: #b42318;',
    '--color-line: #e3d5c5;',
    '--color-placeholder: #ead7c2;',
    '--breakpoint-lg: 64rem;',
  ]) expect(css).toContain(token)
})

test('does not restore the rejected dark-purple theme', () => {
  expect(css).not.toContain('@media (prefers-color-scheme: dark)')
  expect(css).not.toMatch(/#(?:6946e8|ad97ff|7c3aed)/i)
})

test('uses the warm-family colors in PWA and browser metadata', () => {
  expect(viteConfig).toContain("theme_color: '#df6538'")
  expect(viteConfig).toContain("background_color: '#f8f2e8'")
  expect(viteConfig).not.toContain("theme_color: '#7c3aed'")
  expect(indexHtml).toContain('<meta name="theme-color" content="#df6538" />')
})

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

test('keeps a visible focus indicator on the dashboard searchbox', () => {
  expect(css).not.toMatch(/\.global-find-field input\s*\{[^}]*outline:\s*0;/)
  expect(css).toMatch(
    /\.global-find-input:focus-visible\s*\{[^}]*outline:\s*3px solid color-mix\(in srgb, var\(--accent\) 45%, transparent\);[^}]*outline-offset:\s*-4px;/,
  )
})

test('hides only the dashboard scan button in the mobile navigation layout', () => {
  const mobileStart = css.indexOf('@media (max-width: 767px)')
  const mobileEnd = css.indexOf('@media (max-width: 520px)', mobileStart)
  const mobileCss = css.slice(mobileStart, mobileEnd)

  expect(mobileStart).toBeGreaterThan(-1)
  expect(mobileEnd).toBeGreaterThan(mobileStart)
  expect(mobileCss).toMatch(/\.dashboard \.scan-icon-button\s*\{[^}]*display:\s*none;/)
  expect(mobileCss).not.toMatch(
    /[^{}]*\.(?:global-find-bar|global-find-field|global-find-input)[^{]*\{[^}]*display:\s*none;/,
  )
})

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

test('defines every custom property referenced by authored CSS', () => {
  const definitions = new Set([...css.matchAll(/--([\w-]+)\s*:/g)].map((match) => match[1]))
  const references = new Set([...css.matchAll(/var\(--([\w-]+)/g)].map((match) => match[1]))
  const missing = [...references].filter((name) => !definitions.has(name)).sort()

  expect(missing).toEqual([])
  expect(css).toContain('--mono: "SFMono-Regular", Consolas, monospace;')
  expect(css).toContain('--code-bg: #ebe6dc;')
})

test('layers legacy selectors below Tailwind utilities', () => {
  const legacyLayerStart = css.indexOf('@layer components {')

  expect(legacyLayerStart).toBeGreaterThan(-1)
  expect(css).toMatch(/}\n\n@layer components \{\n\* \{/)
  expect(css.slice(0, legacyLayerStart)).not.toMatch(/(?:^|\n)\* \{/)
  expect(css.slice(legacyLayerStart)).toContain('button {')
  expect(css.slice(legacyLayerStart)).toContain('.panel {')
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

test('keeps authentication compatibility after migrating the core workspace', () => {
  expect(css).toContain('.auth-shell {')
  expect(css).toContain(':focus-visible')
  expect(css).toContain('@media (prefers-reduced-motion: reduce)')
})

test('removes migrated core workspace selectors and the old mobile breakpoint', () => {
  expect(css).not.toContain('@media (max-width: 767px)')
  for (const selector of [
    '.dashboard-hero',
    '.quick-actions',
    '.space-card',
    '.mobile-nav',
    '.desktop-sidebar',
  ]) expect(css).not.toContain(selector)
})

test('preserves the legacy card action button affordance after Preflight', () => {
  expect(css).toMatch(
    /\.primary-link,\s*\.card-actions a,\s*\.card-actions button\s*\{[^}]*min-height:\s*44px;[^}]*padding:\s*9px 15px;[^}]*border:\s*1px solid var\(--accent-border\);[^}]*background:\s*var\(--accent-bg\);/,
  )
  expect(css).toMatch(/(?:^|\n):focus-visible\s*\{[^}]*outline:/)
})

test('removes the migrated box catalogue selector', () => {
  expect(css).not.toContain('.box-card')
})

test('removes migrated box detail and item form selectors', () => {
  for (const selector of [
    '.public-box',
    '.box-cover',
    '.item-card',
    '.item-image',
  ]) expect(css).not.toContain(selector)
  expect(css).toContain('.form-stack')
})

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
})

test('contains only the final Tailwind visual system primitives', () => {
  expect(css).toContain('@layer base')
  expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  expect(css).toContain('@media print')
  expect(css).not.toContain('@layer components')
  expect(css).not.toContain('radial-gradient')
  for (const selector of ['.panel', '.card-grid', '.form-stack', '.auth-shell', '.quick-actions']) {
    expect(css).not.toContain(selector)
  }
  for (const variable of ['--text:', '--bg:', '--accent:']) {
    expect(css).not.toContain(variable)
  }
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

test('keeps global accessibility and output media rules', () => {
  expect(css).toContain(':focus-visible')
  expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  expect(css).toContain('@media print')
})

test('defines the warm heading hierarchy inside the base layer', () => {
  const baseStart = css.indexOf('@layer base {')
  const baseEnd = css.indexOf('@media (prefers-reduced-motion: reduce)')
  const base = css.slice(baseStart, baseEnd)

  expect(baseStart).toBeGreaterThan(-1)
  expect(baseEnd).toBeGreaterThan(baseStart)
  expect(base).toMatch(/h1,\s*h2,\s*h3\s*\{[^}]*color: var\(--color-ink\);[^}]*font-weight: 800;[^}]*letter-spacing: -0\.025em;[^}]*line-height: 1\.15;/s)
  expect(base).toMatch(/h1\s*\{[^}]*font-size: clamp\(1\.75rem, 2\.5vw, 2\.25rem\);[^}]*letter-spacing: -0\.04em;[^}]*line-height: 1\.1;/s)
  expect(base).toMatch(/h2\s*\{[^}]*font-size: clamp\(1\.35rem, 3vw, 2rem\);/s)
  expect(base).toMatch(/h3\s*\{[^}]*font-size: 1\.125rem;[^}]*line-height: 1\.3;/s)
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

test('preserves the global focus affordance after Preflight', () => {
  expect(css).toMatch(/(?:^|\n)\s*:focus-visible\s*\{[^}]*outline:/)
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
  expect(css).not.toContain('.form-stack')
})

test('removes migrated search and print selectors', () => {
  for (const selector of ['.search-result', '.print-option']) {
    expect(css).not.toContain(selector)
  }
})

/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8')
const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
const boxesPageSource = readFileSync(resolve(process.cwd(), 'src/features/boxes/BoxesPage.tsx'), 'utf8')
const catalogueCardSource = readFileSync(resolve(process.cwd(), 'src/features/boxes/BoxCatalogueCard.tsx'), 'utf8')
const boxCardMenuSource = readFileSync(resolve(process.cwd(), 'src/features/boxes/BoxCardMenu.tsx'), 'utf8')
const spaceFilterChipsSource = readFileSync(resolve(process.cwd(), 'src/features/boxes/SpaceFilterChips.tsx'), 'utf8')
const onboardingDialogSource = readFileSync(resolve(process.cwd(), 'src/features/dashboard/OnboardingWelcomeDialog.tsx'), 'utf8')
const responsiveEditorDialogSource = readFileSync(resolve(process.cwd(), 'src/components/ResponsiveEditorDialog.tsx'), 'utf8')
const messagesSource = readFileSync(resolve(process.cwd(), 'src/i18n/messages.ts'), 'utf8')
const catalogueSources = [
  catalogueCardSource,
  boxCardMenuSource,
  spaceFilterChipsSource,
]
const alignedPageSources = [
  'src/app/AuthLayout.tsx',
  'src/features/boxes/BoxForm.tsx',
  'src/features/boxes/BoxesPage.tsx',
  'src/features/boxes/PublicBoxPage.tsx',
  'src/features/qr-print/PrintPage.tsx',
  'src/features/scanner/ScannerPage.tsx',
  'src/features/search/SearchPage.tsx',
  'src/features/spaces/SpacesPage.tsx',
].map((path) => readFileSync(resolve(process.cwd(), path), 'utf8')).concat(catalogueSources)

function expectStaticClassToken(source: string, token: string) {
  const staticClassNames = [...source.matchAll(/className="([^"]*)"/g)].map((match) => match[1])
  expect(staticClassNames.some((className) => className.split(/\s+/).includes(token))).toBe(true)
}

function hasHiddenGlobalOverflow(source: string) {
  const globalSelectors = new Set(['html', 'body', '#root'])

  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].some(([, selectorList, declarations]) => {
    const hasGlobalSelector = selectorList
      .split(',')
      .some((selector) => globalSelectors.has(selector.trim()))

    return hasGlobalSelector && /\boverflow(?:-x)?\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(declarations)
  })
}

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

test('defines the approved semantic typography scale', () => {
  for (const token of [
    '--font-sans: "SF Pro Text", "SF Pro Display", "PingFang SC", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif;',
    '--text-display: clamp(2rem, 3.25vw, 3rem);',
    '--text-display--line-height: 1.08;',
    '--text-display--letter-spacing: -0.045em;',
    '--text-metric: 2.5rem;',
    '--text-metric--line-height: 1;',
    '--text-page-title: clamp(1.5rem, 2.25vw, 2.25rem);',
    '--text-page-title--line-height: 1.12;',
    '--text-section-title: clamp(1.25rem, 1.5vw, 1.625rem);',
    '--text-section-title--line-height: 1.2;',
    '--text-card-title: 1.125rem;',
    '--text-card-title--line-height: 1.3;',
    '--text-body: 1rem;',
    '--text-body--line-height: 1.55;',
    '--text-meta: 0.875rem;',
    '--text-meta--line-height: 1.45;',
    '--tracking-eyebrow: 0.04em;',
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
  expect(css).toContain('.scanner-vignette')
  for (const selector of ['.panel', '.card-grid', '.form-stack', '.quick-actions']) {
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
  expect(indexHtml).toContain('content="width=device-width, initial-scale=1.0, viewport-fit=cover"')
  expect(css).toMatch(/:root\s*\{[^}]*--safe-area-bottom:\s*env\(safe-area-inset-bottom,\s*0px\);/s)
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
  expect(base).toMatch(/h1,\s*h2,\s*h3\s*\{[^}]*color: var\(--color-ink\);[^}]*font-weight: 750;[^}]*letter-spacing: -0\.03em;/s)
  expect(base).toMatch(/h1\s*\{[^}]*font-size: var\(--text-page-title\);[^}]*line-height: var\(--text-page-title--line-height\);/s)
  expect(base).toMatch(/h2\s*\{[^}]*font-size: var\(--text-section-title\);[^}]*line-height: var\(--text-section-title--line-height\);/s)
  expect(base).toMatch(/h3\s*\{[^}]*font-size: var\(--text-card-title\);[^}]*line-height: var\(--text-card-title--line-height\);/s)
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

test('allows narrow viewports without a global minimum page width', () => {
  expect(css).not.toMatch(/(?:html|body|#root)\s*\{[^}]*\bmin-width\s*:/s)
})

test('does not hide horizontal overflow globally', () => {
  expect(hasHiddenGlobalOverflow(css)).toBe(false)
})

test('hides scrollbars only within app scroll containers', () => {
  expect(css).toMatch(/\.venue-filter-scroll\s*\{[^}]*scrollbar-width:\s*none\s*!important;/s)
  expect(css).toMatch(/\.venue-filter-scroll::-webkit-scrollbar\s*\{[^}]*height:\s*0\s*!important;/s)
  expect(css).toMatch(/\.space-filter-scroll\s*\{[^}]*scrollbar-width:\s*none\s*!important;/s)
  expect(css).toMatch(/\.space-filter-scroll::-webkit-scrollbar\s*\{[^}]*display:\s*none\s*!important;/s)
})

test('allows hidden overflow on a local component', () => {
  expect(hasHiddenGlobalOverflow('.crop { overflow-x: hidden; }')).toBe(false)
})

test('detects hidden overflow declarations on global root selectors', () => {
  expect(hasHiddenGlobalOverflow('html { overflow: hidden; }')).toBe(true)
  expect(hasHiddenGlobalOverflow('body, #root { overflow-x: hidden; }')).toBe(true)
})

test('removes the migrated box catalogue selector', () => {
  expect(css).not.toContain('.box-card')
})

test('keeps the extracted box catalogue on approved visual tokens', () => {
  expectStaticClassToken(boxesPageSource, 'text-page-title')
  expectStaticClassToken(catalogueCardSource, 'text-card-title')
  expectStaticClassToken(catalogueCardSource, 'rounded-card')
  expectStaticClassToken(catalogueCardSource, 'border-line')
  expectStaticClassToken(boxCardMenuSource, 'bg-surface')
  expectStaticClassToken(boxCardMenuSource, 'border-line')
  expectStaticClassToken(spaceFilterChipsSource, 'overflow-x-auto')
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

test('keeps business pages on the shared typography language', () => {
  const pages = alignedPageSources.join('\n')

  expect(pages).not.toContain('text-xs font-extrabold tracking-[0.12em] text-brand uppercase')
  expect(pages).not.toContain('text-2xl font-black tracking-tight text-ink md:text-4xl')
  expect(pages.match(/text-meta font-medium tracking-eyebrow text-muted/g)?.length).toBeGreaterThanOrEqual(7)
  expect(pages.match(/text-page-title font-extrabold/g)?.length).toBeGreaterThanOrEqual(7)
})

test('keeps Chinese and English typography rules explicit for shared copy', () => {
  expect(css).toContain('.landing-zh .landing-display')
  expect(css).toContain('line-break: strict;')
  expect(css).toContain('.landing-en .landing-display')
  expect(onboardingDialogSource).toContain('text-section-title font-extrabold')
  expect(onboardingDialogSource).toContain('text-body leading-relaxed')
  expect(messagesSource).toContain("title: '开始使用 Nomo'")
  expect(messagesSource).toContain("title: 'Get started with Nomo'")
})

test('keeps the 390px onboarding bottom sheet inside the viewport', () => {
  expect(responsiveEditorDialogSource).toContain('w-full')
  expect(responsiveEditorDialogSource).toContain('min-w-0')
  expect(responsiveEditorDialogSource).toContain('overflow-x-hidden')
  expect(responsiveEditorDialogSource).toContain('overflow-y-auto')
  expect(responsiveEditorDialogSource).toContain('lg:items-center')
  expect(onboardingDialogSource).toContain('sm:w-auto')
})

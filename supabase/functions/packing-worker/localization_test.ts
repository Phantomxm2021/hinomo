import { normalizeLocalizedItem, normalizeSearchAliases } from './localization.ts'

Deno.test('uses a Chinese alias when a Chinese session receives an English name', () => {
  const item = normalizeLocalizedItem({
    name: 'keyboard',
    search_aliases: { 'zh-CN': [' 键盘 ', '电脑键盘'], 'en-US': ['Keyboard'] },
  }, 'zh-CN')

  if (item.name !== '键盘') throw new Error(`unexpected Chinese display name: ${item.name}`)
  if (!item.searchAliases.includes('keyboard')) throw new Error('original name was not retained as an alias')
  if (item.searchAliases.includes('键盘')) throw new Error('display name was not removed from aliases')
})

Deno.test('uses an English alias when an English session receives a Chinese name', () => {
  const item = normalizeLocalizedItem({
    name: '键盘',
    search_aliases: { 'zh-CN': ['键盘'], 'en-US': [' Keyboard ', 'computer keyboard'] },
  }, 'en-US')

  if (item.name !== 'Keyboard') throw new Error(`unexpected English display name: ${item.name}`)
  if (!item.searchAliases.includes('键盘')) throw new Error('original Chinese name was not retained as an alias')
  if (!item.searchAliases.includes('computer keyboard')) throw new Error('secondary alias was dropped')
})

Deno.test('accepts Unicode Latin letters in an English display name', () => {
  const item = normalizeLocalizedItem({
    name: 'café',
    search_aliases: { 'zh-CN': [], 'en-US': [] },
  }, 'en-US')

  if (item.name !== 'café') throw new Error('Unicode Latin display name was rejected')
})

Deno.test('rejects a locale mismatch without a usable target alias', () => {
  let rejected = false
  try {
    normalizeLocalizedItem({ name: 'keyboard', search_aliases: { 'zh-CN': [], 'en-US': [] } }, 'zh-CN')
  } catch (error) {
    rejected = error instanceof Error && error.message === 'packing_output_locale_invalid'
  }
  if (!rejected) throw new Error('invalid localized name was accepted')
})

Deno.test('normalizes aliases with NFKC, trims whitespace and deduplicates case-insensitively', () => {
  const item = normalizeLocalizedItem({
    name: 'Ｋｅｙｂｏａｒｄ',
    search_aliases: {
      'zh-CN': [' 键盘 ', '键盘', '电脑键盘'],
      'en-US': ['Keyboard', ' keyboard ', 'ＫＥＹＢＯＡＲＤ'],
    },
  }, 'zh-CN')

  if (item.name !== '键盘') throw new Error(`unexpected fallback: ${item.name}`)
  if (item.searchAliases.join('|') !== 'Keyboard|电脑键盘') {
    throw new Error(`unexpected normalized aliases: ${JSON.stringify(item.searchAliases)}`)
  }
})

Deno.test('caps each locale at eight aliases and the flattened result at sixteen', () => {
  const chinese = Array.from({ length: 12 }, (_, index) => `中文别名${index + 1}`)
  const english = Array.from({ length: 12 }, (_, index) => `keyboard alias ${index + 1}`)
  const item = normalizeLocalizedItem({
    name: 'keyboard',
    search_aliases: { 'zh-CN': chinese, 'en-US': english },
  }, 'zh-CN')

  if (item.name !== '中文别名1') throw new Error(`unexpected first Chinese alias: ${item.name}`)
  if (item.searchAliases.length !== 16) {
    throw new Error(`expected original plus capped aliases from both locales, got ${item.searchAliases.length}`)
  }
  if (item.searchAliases[0] !== 'keyboard') throw new Error('original name was not kept first')
  if (item.searchAliases.includes('中文别名1')) throw new Error('display alias was not removed')
  if (item.searchAliases.at(-1) !== 'keyboard alias 8') throw new Error('per-locale alias cap/order changed')
})

Deno.test('drops blank, non-string and overlong aliases while retaining a mixed-script Chinese alias', () => {
  const item = normalizeLocalizedItem({
    name: 'keyboard',
    search_aliases: {
      'zh-CN': ['', '   ', 7, 'a'.repeat(81), 'Apple Magic Keyboard 键盘'],
      'en-US': [],
    },
  }, 'zh-CN')

  if (item.name !== 'Apple Magic Keyboard 键盘') throw new Error('mixed-script Chinese alias was rejected')
  if (item.searchAliases.join('|') !== 'keyboard') throw new Error(`invalid aliases were retained: ${JSON.stringify(item.searchAliases)}`)
})

Deno.test('preserves a valid localized name and does not duplicate it as an alias', () => {
  const item = normalizeLocalizedItem({
    name: 'Apple Magic Keyboard 键盘',
    search_aliases: { 'zh-CN': ['键盘', 'Apple Magic Keyboard 键盘'], 'en-US': ['keyboard'] },
  }, 'zh-CN')

  if (item.name !== 'Apple Magic Keyboard 键盘') throw new Error('valid display name changed')
  if (!item.searchAliases.includes('键盘')) throw new Error('Chinese search alias was lost')
  if (!item.searchAliases.includes('keyboard')) throw new Error('English search alias was lost')
  if (item.searchAliases.includes('Apple Magic Keyboard 键盘')) throw new Error('display name was duplicated')
})

Deno.test('flattens historical aliases without replacing the existing display name', () => {
  const aliases = normalizeSearchAliases('keyboard', {
    'zh-CN': ['键盘'],
    'en-US': ['computer keyboard'],
  })
  if (aliases.join('|') !== 'keyboard|键盘|computer keyboard') {
    throw new Error(`unexpected historical aliases: ${JSON.stringify(aliases)}`)
  }
})

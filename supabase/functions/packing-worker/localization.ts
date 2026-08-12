/**
 * Pure, deterministic normalization for model-generated localized item
 * names and search aliases.
 *
 * This module deliberately has no database, network, or model dependencies.
 * The worker uses it at the boundary between Qwen's loose response and the
 * values that are persisted as display fields and hidden search aliases.
 */

export type PackingLocale = 'zh-CN' | 'en-US'

/**
 * Qwen responses are intentionally typed loosely at this boundary. Invalid
 * members are ignored rather than making an otherwise usable item fail.
 */
export type LocalizedAliases = Record<PackingLocale, unknown[]>

const LOCALES: readonly PackingLocale[] = ['zh-CN', 'en-US']
const MAX_ALIASES_PER_LOCALE = 8
const MAX_ALIAS_LENGTH = 80

export function isPackingLocale(value: unknown): value is PackingLocale {
  return value === 'zh-CN' || value === 'en-US'
}

/** Return whether a value contains at least one character from the locale's script. */
function hasTargetScript(value: string, locale: PackingLocale): boolean {
  return locale === 'zh-CN'
    ? /\p{Script=Han}/u.test(value)
    : /\p{Script=Latin}/u.test(value)
}

function matchesTargetLanguage(value: string, locale: PackingLocale): boolean {
  if (!hasTargetScript(value, locale)) return false
  // English display fields may preserve Latin brand/model tokens, but a Han
  // phrase is still a language mismatch. Chinese fields may legitimately
  // combine Han with a brand, model number, or industry abbreviation.
  return locale !== 'en-US' || !/\p{Script=Han}/u.test(value)
}

function normalizeText(value: string): string {
  // NFKC makes visually equivalent model output (for example full-width
  // Latin characters) compare and search consistently. Only outer whitespace
  // is trimmed; meaningful internal spacing in names is preserved.
  return value.normalize('NFKC').trim()
}

function isUsableAlias(value: string): boolean {
  const length = Array.from(value).length
  return length >= 1 && length <= MAX_ALIAS_LENGTH
}

function dedupeKey(value: string): string {
  return value.toLocaleLowerCase('en-US')
}

function normalizeAliasList(values: unknown): string[] {
  if (!Array.isArray(values)) return []

  const normalized: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (typeof value !== 'string') continue
    const candidate = normalizeText(value)
    if (!isUsableAlias(candidate)) continue
    const key = dedupeKey(candidate)
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(candidate)
    if (normalized.length >= MAX_ALIASES_PER_LOCALE) break
  }
  return normalized
}

/** Flatten bilingual aliases without selecting or changing a display name. */
export function normalizeSearchAliases(name: unknown, aliases: unknown): string[] {
  const original = typeof name === 'string' ? normalizeText(name) : ''
  const byLocale = LOCALES.map((key) => normalizeAliasList(
    aliases && typeof aliases === 'object' && !Array.isArray(aliases)
      ? (aliases as Record<string, unknown>)[key]
      : [],
  ))
  const normalized: string[] = []
  const seen = new Set<string>()
  for (const candidate of [original, ...byLocale.flat()]) {
    if (!isUsableAlias(candidate)) continue
    const key = dedupeKey(candidate)
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(candidate)
    if (normalized.length >= MAX_ALIASES_PER_LOCALE * LOCALES.length) break
  }
  return normalized
}

function sameText(left: string, right: string): boolean {
  return dedupeKey(left) === dedupeKey(right)
}

export type NormalizedLocalizedItem = {
  name: string
  searchAliases: string[]
}

/** Normalize and validate a nullable natural-language display field. */
export function normalizeLocalizedText(value: unknown, locale: PackingLocale): string | null {
  if (!isPackingLocale(locale)) throw new Error('packing_output_locale_invalid')
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error('packing_output_locale_invalid')
  const normalized = normalizeText(value)
  if (!normalized) return normalized
  if (!matchesTargetLanguage(normalized, locale)) throw new Error('packing_output_locale_invalid')
  return normalized
}

/**
 * Normalize a localized model item for the selected packing-session locale.
 *
 * If the model emits a name in the wrong script, the first valid alias in the
 * requested locale becomes the display name. The model's original name is
 * retained as a hidden alias so searches in either language still work.
 * When neither the name nor a target-language alias is usable, callers should
 * retry the model's language-repair step; this function reports that contract
 * with the stable `packing_output_locale_invalid` error code.
 */
export function normalizeLocalizedItem(
  input: { name: string; search_aliases: LocalizedAliases },
  locale: PackingLocale,
): NormalizedLocalizedItem {
  if (!isPackingLocale(locale)) throw new Error('packing_output_locale_invalid')
  const normalizedName = typeof input.name === 'string' ? normalizeText(input.name) : ''
  const byLocale = LOCALES.map((key) => normalizeAliasList(input.search_aliases?.[key]))
  const targetAliases = locale === 'zh-CN' ? byLocale[0] : byLocale[1]

  const displayName = matchesTargetLanguage(normalizedName, locale)
    ? normalizedName
    : targetAliases.find((alias) => matchesTargetLanguage(alias, locale))

  if (!displayName) throw new Error('packing_output_locale_invalid')

  // Keep the original model name first (when it is a valid searchable value),
  // followed by aliases in the deterministic locale/key order. Removing the
  // display name avoids needless duplicate search terms while preserving every
  // other usable alias, including the original wrong-language name.
  const aliases: string[] = []
  const seen = new Set<string>()
  const candidates = [normalizedName, ...byLocale.flat()]
  for (const candidate of candidates) {
    if (!isUsableAlias(candidate) || sameText(candidate, displayName)) continue
    const key = dedupeKey(candidate)
    if (seen.has(key)) continue
    seen.add(key)
    aliases.push(candidate)
    if (aliases.length >= MAX_ALIASES_PER_LOCALE * LOCALES.length) break
  }

  return { name: displayName, searchAliases: aliases }
}

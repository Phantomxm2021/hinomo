import privacyEn from '../../content/legal/privacy.en-US.md?raw'
import privacyZh from '../../content/legal/privacy.zh-CN.md?raw'
import termsEn from '../../content/legal/terms.en-US.md?raw'
import termsZh from '../../content/legal/terms.zh-CN.md?raw'
import type { Locale } from '../../i18n/locale'

export type LegalDocumentKind = 'privacy' | 'terms'
export type LegalLocale = Locale

const documents: Record<LegalDocumentKind, Record<LegalLocale, string>> = {
  privacy: { 'zh-CN': privacyZh, 'en-US': privacyEn },
  terms: { 'zh-CN': termsZh, 'en-US': termsEn },
}

export function getLegalDocument(kind: LegalDocumentKind, locale: LegalLocale) {
  return documents[kind][locale]
}

export function parseLegalLocale(value: string | null): LegalLocale {
  return value === 'en-US' || value === 'en' ? 'en-US' : 'zh-CN'
}

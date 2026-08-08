import { useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link, useSearchParams } from 'react-router-dom'
import { BrandIcon } from '../../components/BrandIcon'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { useI18n } from '../../i18n/I18nProvider'
import { getLegalDocument, parseLegalLocale, type LegalDocumentKind } from './legal-documents'

export function LegalDocumentPage({ kind }: { kind: LegalDocumentKind }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { locale, setLocale, t } = useI18n()
  const queryLocale = searchParams.get('lang')
  const documentLocale = queryLocale === null ? locale : parseLegalLocale(queryLocale)
  const title = t(`legal.${kind}.title`)

  useEffect(() => {
    if (queryLocale !== null && documentLocale !== locale) setLocale(documentLocale)
  }, [documentLocale, locale, queryLocale, setLocale])

  useEffect(() => {
    document.title = `${title} | Nomo`
  }, [title])

  function changeLocale(nextLocale: typeof locale) {
    setLocale(nextLocale)
    setSearchParams({ lang: nextLocale }, { replace: true })
  }

  return (
    <div className="legal-page min-h-dvh bg-canvas text-ink" lang={documentLocale}>
      <header className="legal-header sticky top-0 z-10 border-b border-line/70 bg-canvas/92 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-4xl items-center justify-between gap-4 px-5 md:px-8">
          <Link className="flex items-center gap-2 text-lg font-black tracking-[-0.04em] text-ink no-underline" to="/"><BrandIcon className="size-9 rounded-xl" />Nomo</Link>
          <LanguageSwitcher locale={documentLocale} onChange={changeLocale} compact />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 py-10 md:px-8 md:py-16">
        <Link className="legal-back-link inline-flex text-meta font-bold text-brand-strong no-underline" to="/register">← {t('legal.backToRegister')}</Link>
        <article className="legal-markdown mt-8 rounded-shell border border-line bg-surface px-5 py-8 shadow-soft md:px-10 md:py-12"><ReactMarkdown>{getLegalDocument(kind, documentLocale)}</ReactMarkdown></article>
      </main>
    </div>
  )
}

export function PrivacyPolicyPage() {
  return <LegalDocumentPage kind="privacy" />
}

export function TermsOfServicePage() {
  return <LegalDocumentPage kind="terms" />
}

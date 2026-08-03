import { useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link, useSearchParams } from 'react-router-dom'
import { BrandIcon } from '../../components/BrandIcon'
import {
  getLegalDocument,
  parseLegalLocale,
  type LegalDocumentKind,
  type LegalLocale,
} from './legal-documents'

const pageCopy = {
  'zh-CN': {
    back: '返回注册',
    language: '文档语言',
    privacy: '隐私政策',
    terms: '服务条款',
  },
  'en-US': {
    back: 'Back to registration',
    language: 'Document language',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
  },
} satisfies Record<LegalLocale, Record<'back' | 'language' | LegalDocumentKind, string>>

export function LegalDocumentPage({ kind }: { kind: LegalDocumentKind }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const locale = parseLegalLocale(searchParams.get('lang'))
  const t = pageCopy[locale]

  useEffect(() => {
    document.title = `${t[kind]} | Nomo`
  }, [kind, t])

  function changeLocale(nextLocale: LegalLocale) {
    setSearchParams({ lang: nextLocale }, { replace: true })
  }

  return (
    <div className="legal-page min-h-dvh bg-canvas text-ink" lang={locale}>
      <header className="legal-header sticky top-0 z-10 border-b border-line/70 bg-canvas/92 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-4xl items-center justify-between gap-4 px-5 md:px-8">
          <Link className="flex items-center gap-2 text-lg font-black tracking-[-0.04em] text-ink no-underline" to="/">
            <BrandIcon className="size-9 rounded-xl" />
            Nomo
          </Link>
          <label className="flex items-center gap-2 text-meta font-semibold text-muted">
            <span className="max-sm:sr-only">{t.language}</span>
            <select
              aria-label={t.language}
              className="rounded-full border border-line bg-surface px-3 py-2 text-meta font-bold text-ink"
              value={locale}
              onChange={(event) => changeLocale(event.target.value as LegalLocale)}
            >
              <option value="zh-CN">中文</option>
              <option value="en-US">English</option>
            </select>
          </label>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 py-10 md:px-8 md:py-16">
        <Link className="legal-back-link inline-flex text-meta font-bold text-brand-strong no-underline" to="/register">
          ← {t.back}
        </Link>
        <article className="legal-markdown mt-8 rounded-shell border border-line bg-surface px-5 py-8 shadow-soft md:px-10 md:py-12">
          <ReactMarkdown>{getLegalDocument(kind, locale)}</ReactMarkdown>
        </article>
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

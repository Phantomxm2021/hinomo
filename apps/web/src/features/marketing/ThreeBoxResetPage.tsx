import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { BrandIcon } from '../../components/BrandIcon'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { useI18n } from '../../i18n/I18nProvider'
import { captureGrowthEvent, firstGrowthOccurrence, getAnalyticsConsent, subscribeAnalyticsConsent } from '../../lib/analytics'
import { env } from '../../lib/env'
import { useAuth } from '../auth/auth-context'

function deviceCategory() {
  if (typeof window === 'undefined') return 'desktop' as const
  if (window.matchMedia('(pointer: coarse)').matches) {
    return window.matchMedia('(min-width: 768px)').matches ? 'tablet' as const : 'mobile' as const
  }
  return 'desktop' as const
}

export function ThreeBoxResetPage() {
  const { session } = useAuth()
  const { locale, setLocale, t } = useI18n()
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, getAnalyticsConsent)
  const hasCapturedLandingView = useRef(false)
  const [videoUnavailable, setVideoUnavailable] = useState(false)
  const primaryHref = session ? '/app' : '/register?campaign=three_box_reset'

  useEffect(() => {
    document.title = t('threeBoxReset.documentTitle')
  }, [t])

  useEffect(() => {
    if (consent !== 'accepted' || hasCapturedLandingView.current) return
    hasCapturedLandingView.current = true
    captureGrowthEvent('landing_view', {
      campaign: 'three_box_reset',
      language: locale,
      device: deviceCategory(),
      first: firstGrowthOccurrence('landing_view'),
    })
  }, [consent, locale])

  const steps = [
    ['01', t('threeBoxReset.workflow.photoTitle'), t('threeBoxReset.workflow.photoBody')],
    ['02', t('threeBoxReset.workflow.labelTitle'), t('threeBoxReset.workflow.labelBody')],
    ['03', t('threeBoxReset.workflow.findTitle'), t('threeBoxReset.workflow.findBody')],
  ]

  return (
    <div className="min-h-dvh bg-[#f7f3ed] text-ink">
      <header className="border-b border-ink/10 bg-[#f7f3ed]/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8" aria-label="Nomo">
          <Link className="flex items-center gap-2 text-lg font-black tracking-[-0.04em] text-ink no-underline" to="/">
            <BrandIcon className="size-8 rounded-lg" /> Nomo
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher locale={locale} onChange={setLocale} compact />
            <Link className="text-sm font-semibold text-ink no-underline hover:text-brand" to={session ? '/app' : '/login'}>{session ? t('threeBoxReset.nav.open') : t('threeBoxReset.nav.login')}</Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-ink uppercase">{t('threeBoxReset.hero.eyebrow')}</p>
            <h1 className="mt-5 max-w-3xl text-5xl leading-[0.95] font-extrabold tracking-[-0.065em] sm:text-7xl">{t('threeBoxReset.hero.title')}</h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-muted sm:text-xl">{t('threeBoxReset.hero.body')}</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link className="inline-flex min-h-13 items-center justify-center rounded-full bg-brand-strong px-7 font-bold text-white no-underline shadow-float transition hover:bg-[#b64322]" to={primaryHref}>{t('threeBoxReset.hero.cta')}</Link>
              <span className="text-sm font-semibold text-muted">{t('threeBoxReset.hero.noCard')}</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-[2rem] bg-[#e9e0d4] shadow-float">
            <img className="aspect-[4/3] w-full object-cover" src="/landing/hero-home-v2.jpg" alt="" />
          </div>
        </section>

        <section className="bg-[#30271e] px-5 py-16 text-white sm:px-8" data-testid="three-box-demo">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-4xl">{t('threeBoxReset.demo.title')}</h2>
            <div className="mt-7 aspect-video overflow-hidden rounded-[1.5rem] bg-black shadow-float">
              {videoUnavailable ? (
                <div className="relative h-full w-full"><img className="h-full w-full object-cover opacity-80" src="/landing/hero-home-v2.jpg" alt="" /><p className="absolute inset-x-5 bottom-5 rounded-xl bg-ink/80 p-3 text-sm text-white">{t('threeBoxReset.demo.fallback')}</p></div>
              ) : (
                <video className="h-full w-full object-cover" controls playsInline preload="metadata" poster="/landing/hero-home-v2.jpg" onError={() => setVideoUnavailable(true)}>
                  <source src="/marketing/three-box-reset-demo.mp4" type="video/mp4" />
                  {t('threeBoxReset.demo.fallback')}
                </video>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8" data-testid="three-box-workflow">
          <h2 className="text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">{t('threeBoxReset.workflow.title')}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map(([number, title, body]) => <article className="rounded-[1.5rem] border border-line bg-white p-6 shadow-soft" key={number}><p className="text-sm font-bold text-brand-strong">{number}</p><h3 className="mt-8 text-xl font-bold">{title}</h3><p className="mt-3 leading-7 text-muted">{body}</p></article>)}
          </div>
        </section>

        <section className="bg-[#efe5d8] px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-4xl rounded-[2rem] bg-white p-7 shadow-soft sm:p-10">
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{t('threeBoxReset.install.title')}</h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted">{t('threeBoxReset.install.body')}</p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2"><p className="rounded-2xl bg-canvas p-5 leading-7">{t('threeBoxReset.install.iphone')}</p><p className="rounded-2xl bg-canvas p-5 leading-7">{t('threeBoxReset.install.android')}</p></div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-5 py-20 sm:px-8 md:grid-cols-2">
          <article className="rounded-[2rem] bg-brand-strong p-8 text-white" data-testid="three-box-free-offer"><h2 className="text-3xl font-extrabold tracking-[-0.04em] text-white">{t('threeBoxReset.free.title')}</h2><p className="mt-4 max-w-md leading-7 text-white">{t('threeBoxReset.free.body')}</p></article>
          <article className="rounded-[2rem] bg-ink p-8 text-white" data-testid="founding-lifetime-offer"><h2 className="text-3xl font-extrabold tracking-[-0.04em] text-white">{t('threeBoxReset.founder.title')}</h2><p className="mt-4 text-2xl font-bold text-[#efac8e]">{t('threeBoxReset.founder.price')}</p><p className="mt-3 max-w-md leading-7 text-white/75">{t('threeBoxReset.founder.body')}</p></article>
        </section>

        <section className="bg-[#df6538] px-5 py-16 text-center text-white sm:px-8"><Link className="inline-flex min-h-13 items-center justify-center rounded-full bg-white px-8 font-bold text-ink no-underline shadow-float" to={primaryHref}>{t('threeBoxReset.finalCta')}</Link></section>
      </main>

      <footer className="bg-ink px-5 py-8 text-sm text-white/65 sm:px-8"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4"><span>© {new Date().getFullYear()} Nomo</span><div className="flex flex-wrap gap-5"><Link className="text-inherit no-underline hover:text-white" to={`/legal/privacy?lang=${locale}`}>{t('threeBoxReset.footer.privacy')}</Link><Link className="text-inherit no-underline hover:text-white" to={`/legal/terms?lang=${locale}`}>{t('threeBoxReset.footer.terms')}</Link><a className="text-inherit no-underline hover:text-white" href={`mailto:${env.VITE_PUBLIC_SUPPORT_EMAIL}`}>{t('threeBoxReset.footer.support')}</a></div></div></footer>
    </div>
  )
}

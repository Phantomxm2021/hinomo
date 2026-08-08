import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { BrandIcon } from '../components/BrandIcon'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { useI18n } from '../i18n/I18nProvider'

export function AuthLayout() {
  const { locale, setLocale, t } = useI18n()
  const location = useLocation()
  const accessPage = ['/login', '/register', '/forgot-password', '/reset-password']
    .includes(location.pathname)

  useEffect(() => {
    if (!accessPage) return
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    const previousBodyOverscroll = document.body.style.overscrollBehavior
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
      document.body.style.overscrollBehavior = previousBodyOverscroll
    }
  }, [accessPage])

  return (
    <div className={accessPage ? 'auth-login-viewport grid h-dvh w-full place-items-center overflow-hidden' : 'contents'}>
    <div lang={locale} className={`auth-shell ${accessPage ? 'auth-login-shell h-dvh min-h-0 md:my-0 md:h-[min(800px,calc(100dvh-3rem))] md:min-h-0' : 'min-h-dvh md:my-6 md:min-h-[min(800px,calc(100dvh-3rem))]'} mx-auto grid w-full overflow-hidden bg-surface md:w-[min(1180px,calc(100%-2rem))] md:grid-cols-[minmax(0,1.08fr)_minmax(26.25rem,0.92fr)] md:rounded-[2rem] md:border md:border-line md:shadow-[0_28px_80px_rgb(86_58_36_/_18%)]`}>
      <section className={`auth-visual relative min-h-56 flex-col justify-between overflow-hidden bg-sidebar p-6 text-muted md:flex md:min-h-0 md:p-[clamp(2rem,4vw,3.5rem)] ${accessPage ? 'hidden' : 'flex'}`} aria-label={t('auth.layout.productLabel')}>
        <img className="auth-visual-image absolute inset-0 size-full object-cover" src="/landing/hero-home-v2.jpg" alt="" />
        <span className="auth-visual-shade absolute inset-0" aria-hidden="true" />
        <Link className="auth-brand relative z-10 flex w-fit items-center gap-2.5 text-2xl font-black tracking-[-0.05em] text-ink no-underline" to="/">
          <BrandIcon className="size-11 rounded-[0.9rem] shadow-soft" />
          Nomo
        </Link>
        <div className="auth-story relative z-10 max-w-[31rem] rounded-[1.6rem] border border-white/60 bg-[#fffaf2]/88 px-5 py-5 shadow-[0_18px_50px_rgb(62_39_22_/_16%)] backdrop-blur-xl md:px-7 md:py-7">
          <p className="mb-2 text-meta font-bold tracking-eyebrow text-brand-strong">{t('auth.layout.eyebrow')}</p>
          <h2 className="m-0 max-w-md text-display font-extrabold text-ink">{t('auth.layout.title')}</h2>
          <p className="mt-4 mb-0 max-w-md text-body text-muted max-md:hidden">{t('auth.layout.subtitle')}</p>
        </div>
      </section>
      <div className={`auth-form-panel relative grid min-h-0 place-items-center overflow-hidden bg-surface px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] md:p-[clamp(2.5rem,5vw,4.5rem)] [&_main]:w-full [&_main]:max-w-md [&_h1]:text-page-title [&_h1]:font-extrabold ${accessPage ? 'h-full' : ''}`}>
        <span className="auth-form-orbit absolute -top-40 -right-40 size-80 rounded-full border border-line/55" aria-hidden="true" />
        <div className="absolute top-5 right-5 z-20 md:top-7 md:right-7">
          <LanguageSwitcher locale={locale} onChange={setLocale} compact />
        </div>
        <div className="auth-form-frame relative z-10 w-full max-w-md bg-surface [&_h1]:text-page-title [&_h1]:font-extrabold">
          <Outlet />
        </div>
      </div>
    </div>
    </div>
  )
}

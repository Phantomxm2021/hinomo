import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { BrandIcon } from '../../components/BrandIcon'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { useI18n, type I18nContextValue } from '../../i18n/I18nProvider'

type Translate = I18nContextValue['t']

function landingCopy(t: Translate) {
  return {
    nav: {
      story: t('landing.nav.story'),
      moments: t('landing.nav.moments'),
      login: t('landing.nav.login'),
      start: t('landing.nav.start'),
      enter: t('landing.nav.enter'),
    },
    accessibility: {
      skipContent: t('landing.accessibility.skipContent'),
      nav: t('landing.accessibility.nav'),
      productMoment: t('landing.accessibility.productMoment'),
      forgottenImage: t('landing.accessibility.forgottenImage'),
      togetherImage: t('landing.accessibility.togetherImage'),
    },
    hero: {
      eyebrow: t('landing.hero.eyebrow'),
      title: [t('landing.hero.title1'), t('landing.hero.title2')],
      body: t('landing.hero.body'),
      more: t('landing.hero.more'),
      scroll: t('landing.hero.scroll'),
    },
    forgotten: {
      eyebrow: t('landing.forgotten.eyebrow'),
      title: [t('landing.forgotten.title1'), t('landing.forgotten.title2'), t('landing.forgotten.title3')],
      body: t('landing.forgotten.body'),
      items: [t('landing.forgotten.item1'), t('landing.forgotten.item2'), t('landing.forgotten.item3')],
    },
    memory: {
      eyebrow: t('landing.memory.eyebrow'),
      title: [t('landing.memory.title1'), t('landing.memory.title2')],
      body: t('landing.memory.body'),
    },
    find: {
      eyebrow: t('landing.find.eyebrow'),
      title: [t('landing.find.title1'), t('landing.find.title2')],
      body: t('landing.find.body'),
      searchLabel: t('landing.find.searchLabel'),
      searchValue: t('landing.find.searchValue'),
      found: t('landing.find.found'),
      box: t('landing.find.box'),
      place: t('landing.find.place'),
      there: t('landing.find.there'),
    },
    scan: {
      eyebrow: t('landing.scan.eyebrow'),
      title: [t('landing.scan.title1'), t('landing.scan.title2'), t('landing.scan.title3')],
      body: t('landing.scan.body'),
      label: t('landing.scan.label'),
      place: t('landing.scan.place'),
    },
    move: {
      eyebrow: t('landing.move.eyebrow'),
      title: [t('landing.move.title1'), t('landing.move.title2'), t('landing.move.title3')].filter(Boolean),
      body: t('landing.move.body'),
    },
    together: {
      eyebrow: t('landing.together.eyebrow'),
      title: [t('landing.together.title1'), t('landing.together.title2'), t('landing.together.title3')],
      body: t('landing.together.body'),
    },
    ending: {
      title: [t('landing.ending.title1'), t('landing.ending.title2')],
      body: t('landing.ending.body'),
    },
    footer: {
      tagline: t('landing.footer.tagline'),
      explore: t('landing.footer.explore'),
      account: t('landing.footer.account'),
      privacy: t('landing.nav.privacy'),
      terms: t('landing.nav.terms'),
      rights: t('landing.footer.rights'),
    },
  }
}

function BrandMark() {
  return <BrandIcon className="size-9 rounded-[0.72rem] shadow-soft" />
}

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element || !('IntersectionObserver' in window)) {
      element?.setAttribute('data-visible', 'true')
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        element.setAttribute('data-visible', 'true')
        observer.disconnect()
      }
    }, { threshold: 0.18 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return <div className={`landing-reveal ${className}`} ref={ref}>{children}</div>
}

function Headline({ lines, className = '' }: { lines: readonly string[]; className?: string }) {
  const visibleLines = lines.filter(Boolean)
  const separator = visibleLines.some((line) => /[A-Za-z]/.test(line)) ? ' ' : ''
  return (
    <span className={className}>
      <span className="sr-only">{visibleLines.join(separator)}</span>
      <span aria-hidden="true">{visibleLines.map((line) => <span className="block" key={line}>{line}</span>)}</span>
    </span>
  )
}

type LandingCopy = ReturnType<typeof landingCopy>

function ProductMoment({ text, label }: { text: LandingCopy['find']; label: string }) {
  return (
    <div className="relative mx-auto w-full max-w-[31rem]" aria-label={label}>
      <div className="absolute -inset-8 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[2.4rem] border-[8px] border-ink bg-surface shadow-[0_32px_90px_rgb(47_31_20_/_26%)]">
        <div className="flex h-11 items-center justify-center border-b border-line/70"><span className="h-1.5 w-14 rounded-full bg-ink/15" /></div>
        <div className="p-5 sm:p-7">
          <p className="text-xs font-bold tracking-[0.12em] text-muted">{text.searchLabel}</p>
          <div className="landing-search mt-4 flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-white px-5"><span className="size-2.5 shrink-0 rounded-full bg-brand" /><strong className="landing-search-text text-base text-ink sm:text-lg">{text.searchValue}</strong><span className="landing-caret h-5 w-px bg-brand" aria-hidden="true" /></div>
          <div className="landing-result mt-5 rounded-[1.55rem] bg-canvas p-5 sm:p-7">
            <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[0.14em] text-brand-strong">{text.found}</span><span className="grid size-8 place-items-center rounded-full bg-[#ddc26d] text-xs text-ink" aria-hidden="true">●</span></div>
            <h3 className="mt-8 text-2xl font-bold tracking-[-0.035em]">{text.box}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{text.place}</p>
            <div className="mt-8 flex items-center gap-3 text-xs font-bold text-brand-strong"><span className="h-px flex-1 bg-brand/25" />{text.there}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MemoryTag({ text }: { text: LandingCopy['scan'] }) {
  return (
    <div className="landing-tag relative mx-auto aspect-[4/3] w-full max-w-[34rem] overflow-hidden rounded-[2.4rem] bg-[#d8b996] shadow-float" aria-hidden="true">
      <div className="absolute inset-x-[8%] bottom-[-10%] h-[67%] rounded-t-[1.5rem] bg-[#a86f47] shadow-[0_-22px_50px_rgb(73_44_26_/_14%)]"><span className="absolute inset-x-[8%] top-[21%] h-px bg-white/25" /><span className="absolute top-[9%] left-1/2 h-28 w-px -translate-x-1/2 bg-white/25" /></div>
      <div className="absolute top-[22%] left-[10%] flex -rotate-3 items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-float sm:gap-4 sm:p-4"><div className="size-16 shrink-0 overflow-hidden bg-canvas sm:size-20"><img className="size-full object-contain" src="/landing/nomo-qr.png" alt="" /></div><div className="min-w-0 pr-1"><strong className="block whitespace-nowrap text-sm text-ink sm:text-base">{text.label}</strong><span className="mt-1 block whitespace-nowrap text-[0.65rem] font-bold tracking-[0.08em] text-brand-strong sm:text-xs">BX-012</span><span className="mt-1 block whitespace-nowrap text-[0.62rem] text-muted sm:text-xs">{text.place}</span></div></div>
      <span className="landing-scan-line absolute top-[12%] bottom-[6%] left-[11%] w-0.5 bg-brand shadow-[0_0_18px_4px_rgb(223_101_56_/_55%)]" /><div className="absolute top-[15%] right-[12%] grid size-24 place-items-center rounded-full border border-white/50 bg-white/15 backdrop-blur-md sm:size-28"><span className="landing-ring size-12 rounded-full border-2 border-white/80 border-r-transparent sm:size-14" /></div>
    </div>
  )
}

export function LandingPage() {
  const { session } = useAuth()
  const { locale, setLocale, t } = useI18n()
  const text = landingCopy(t)
  const primaryHref = session ? '/app' : '/register'
  const primaryLabel = session ? text.nav.enter : text.nav.start
  const languageClass = locale === 'en-US' ? 'landing-en' : 'landing-zh'

  useEffect(() => {
    document.title = t('landing.hero.documentTitle')
  }, [t])

  return (
    <div className={`landing-page min-h-dvh overflow-hidden bg-[#f7f3ed] text-ink ${languageClass}`}>
      <a className="sr-only z-[100] rounded-full bg-ink px-5 py-3 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3" href="#main-content">{text.accessibility.skipContent}</a>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-ink/[0.08] bg-[#f7f3ed]/90 backdrop-blur-xl">
        <nav className="mx-auto flex h-[4.5rem] w-full max-w-7xl items-center px-4 sm:px-6 lg:px-10" aria-label={text.accessibility.nav}>
          <Link className="flex shrink-0 items-center gap-2 text-lg font-black tracking-[-0.04em] text-ink no-underline" to="/" aria-label="Nomo"><BrandMark /><span className="hidden min-[360px]:inline">Nomo</span></Link>
          <div className="ml-auto flex min-w-0 items-center justify-end gap-0.5 sm:gap-1">
            <div className="hidden items-center md:flex"><a className="rounded-lg px-3.5 py-2 text-sm font-semibold text-muted no-underline transition hover:bg-ink/[0.05] hover:text-ink" href="#story">{text.nav.story}</a><a className="rounded-lg px-3.5 py-2 text-sm font-semibold text-muted no-underline transition hover:bg-ink/[0.05] hover:text-ink" href="#moments">{text.nav.moments}</a></div>
            <LanguageSwitcher locale={locale} onChange={setLocale} compact />
            {!session ? <Link className="hidden min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-ink no-underline transition hover:bg-ink/[0.05] sm:inline-flex" to="/login">{text.nav.login}</Link> : null}
            <Link className="ml-1 inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-ink px-3.5 text-xs font-bold text-white no-underline transition hover:bg-brand sm:ml-2 sm:px-5 sm:text-sm" to={primaryHref}>{primaryLabel}</Link>
          </div>
        </nav>
      </header>

      <main id="main-content">
        <section className="relative min-h-[100svh] overflow-hidden bg-[#e9e0d4]"><img className="landing-hero-image absolute inset-0 h-full w-full object-cover object-[64%_center]" src="/landing/hero-home-v2.jpg" alt="" fetchPriority="high" /><div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(247_243_237_/_98%)_0%,rgb(247_243_237_/_89%)_35%,rgb(247_243_237_/_20%)_70%,transparent_100%)] max-md:bg-[linear-gradient(180deg,rgb(247_243_237_/_96%)_0%,rgb(247_243_237_/_72%)_48%,rgb(30_20_15_/_22%)_100%)]" /><div className="relative mx-auto flex min-h-[100svh] w-full max-w-7xl items-center px-5 pt-24 pb-24 sm:px-8 lg:px-12"><div className="landing-hero-copy max-w-[52rem]"><p className="landing-eyebrow mb-7 text-xs font-bold tracking-[0.22em] text-brand-strong sm:text-sm">{text.hero.eyebrow}</p><h1 className="landing-hero-title text-[clamp(3.75rem,9.3vw,8.7rem)] leading-[0.87] font-extrabold tracking-[-0.075em] text-ink"><Headline lines={text.hero.title} /></h1><p className="landing-body mt-8 max-w-xl text-lg leading-[1.7] text-muted sm:mt-10 sm:text-xl lg:text-2xl">{text.hero.body}</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link className="inline-flex min-h-13 items-center justify-center rounded-full bg-brand px-7 font-bold text-white no-underline shadow-[0_16px_36px_rgb(189_75_36_/_24%)] transition hover:-translate-y-0.5 hover:bg-brand-strong" to={primaryHref}>{primaryLabel}</Link><a className="inline-flex min-h-13 items-center justify-center rounded-full border border-ink/15 bg-white/55 px-7 font-bold text-ink no-underline backdrop-blur-sm hover:bg-white/80" href="#story">{text.hero.more}</a></div></div></div><a className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 items-center gap-3 text-xs font-bold tracking-[0.12em] text-ink/60 no-underline md:flex" href="#story"><span className="landing-scroll-dot grid h-10 w-6 place-items-start justify-center rounded-full border border-ink/25 pt-2"><span className="size-1 rounded-full bg-brand" /></span>{text.hero.scroll}</a></section>

        <section className="bg-[#f7f3ed]" id="story"><Reveal className="mx-auto flex min-h-[50rem] w-full max-w-7xl items-center px-5 py-24 sm:px-8 lg:px-12 lg:py-28"><div className="grid w-full gap-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-20"><div className="landing-story-copy"><p className="landing-eyebrow mb-7 text-xs font-bold tracking-[0.22em] text-brand-strong sm:mb-9 sm:text-sm">{text.forgotten.eyebrow}</p><h2 className="landing-display landing-story-title max-w-[11ch] font-extrabold tracking-[-0.065em]"><Headline lines={text.forgotten.title} /></h2><p className="landing-body mt-10 max-w-2xl text-lg leading-[1.8] text-muted sm:text-xl">{text.forgotten.body}</p></div><div className="mx-auto w-full max-w-[34rem]"><div className="landing-forgotten-visual relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-[#d7c0a5] shadow-[0_32px_80px_rgb(62_42_26_/_16%)] sm:rounded-[2.5rem]"><img className="size-full object-cover" src="/landing/forgotten-still-life-v1.jpg" alt={text.accessibility.forgottenImage} loading="lazy" /></div><div className="landing-forgotten-items mt-8 grid grid-cols-3 gap-2 sm:mt-10 sm:gap-4" aria-hidden="true">{text.forgotten.items.map((item, index) => <div className="landing-forgotten-item" key={item}><span>0{index + 1}</span><strong>{item}</strong></div>)}</div></div></div></Reveal></section>

        <section className="relative min-h-[72svh] overflow-hidden bg-ink"><img className="absolute inset-0 h-full w-full object-cover object-center" src="/landing/memory-family.jpg" alt="" loading="lazy" /><div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_30%,rgb(28_18_12_/_18%)_58%,rgb(28_18_12_/_84%)_100%)] max-md:bg-[linear-gradient(180deg,transparent_20%,rgb(28_18_12_/_25%)_52%,rgb(28_18_12_/_92%)_100%)]" /><Reveal className="relative mx-auto flex min-h-[72svh] w-full max-w-7xl items-end justify-end px-5 py-16 sm:px-8 md:items-center lg:px-12"><div className="landing-copy-panel max-w-xl text-white"><p className="landing-eyebrow mb-6 text-xs font-bold tracking-[0.22em] text-[#efac8e] sm:text-sm">{text.memory.eyebrow}</p><h2 className="landing-display text-[clamp(3.2rem,6vw,6.4rem)] leading-[0.93] font-extrabold tracking-[-0.065em] text-white"><Headline lines={text.memory.title} /></h2><p className="landing-body mt-8 text-lg leading-[1.75] text-white/72 sm:text-xl">{text.memory.body}</p></div></Reveal></section>

        <section className="bg-[#efe5d8]" id="moments"><div className="mx-auto grid w-full max-w-7xl gap-20 px-5 py-28 sm:px-8 lg:grid-cols-[1fr_0.82fr] lg:items-center lg:px-12 lg:py-40"><Reveal><p className="landing-eyebrow mb-6 text-xs font-bold tracking-[0.22em] text-brand-strong sm:text-sm">{text.find.eyebrow}</p><h2 className="landing-display text-[clamp(3.2rem,6.5vw,6.7rem)] leading-[0.93] font-extrabold tracking-[-0.065em]"><Headline lines={text.find.title} /></h2><p className="landing-body mt-9 max-w-xl text-lg leading-[1.8] text-muted sm:text-xl">{text.find.body}</p></Reveal><Reveal className="lg:py-10"><ProductMoment text={text.find} label={text.accessibility.productMoment} /></Reveal></div></section>

        <section className="bg-[#30271e] text-white"><div className="mx-auto grid w-full max-w-7xl gap-20 px-5 py-28 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-12 lg:py-40"><Reveal><MemoryTag text={text.scan} /></Reveal><Reveal><p className="landing-eyebrow mb-6 text-xs font-bold tracking-[0.22em] text-[#efac8e] sm:text-sm">{text.scan.eyebrow}</p><h2 className="landing-display text-[clamp(3.1rem,5.8vw,6rem)] leading-[0.94] font-extrabold tracking-[-0.06em] text-white"><Headline lines={text.scan.title} /></h2><p className="landing-body mt-9 max-w-xl text-lg leading-[1.8] text-white/65 sm:text-xl">{text.scan.body}</p></Reveal></div></section>

        <section className="grid min-h-[72svh] bg-[#f7f3ed] lg:grid-cols-2"><div className="relative min-h-[48svh] overflow-hidden lg:min-h-full"><img className="landing-moving-image absolute inset-0 h-full w-full object-cover object-center" src="/landing/moving-home-v2.jpg" alt="" loading="lazy" /></div><Reveal className="flex items-center px-5 py-24 sm:px-12 lg:px-[clamp(3rem,7vw,8rem)]"><div className="landing-copy-panel"><p className="landing-eyebrow mb-6 text-xs font-bold tracking-[0.22em] text-brand-strong sm:text-sm">{text.move.eyebrow}</p><h2 className="landing-display text-[clamp(3rem,5.5vw,5.8rem)] leading-[0.94] font-extrabold tracking-[-0.06em]"><Headline lines={text.move.title} /></h2><p className="landing-body mt-9 max-w-xl text-lg leading-[1.8] text-muted sm:text-xl">{text.move.body}</p></div></Reveal></section>

        <section className="relative overflow-hidden bg-[#df6538] px-5 py-28 text-white sm:px-8 lg:py-36"><div className="relative mx-auto grid w-full max-w-7xl gap-16 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:gap-20"><Reveal><p className="landing-eyebrow mb-7 text-xs font-bold tracking-[0.22em] text-white/70 sm:mb-9 sm:text-sm">{text.together.eyebrow}</p><h2 className="landing-display max-w-[11ch] font-extrabold tracking-[-0.065em] text-white"><Headline lines={text.together.title} /></h2><p className="landing-body mt-9 max-w-[38rem] text-lg leading-[1.8] text-white/78 sm:mt-11 sm:text-xl">{text.together.body}</p></Reveal><Reveal><div className="relative aspect-[3/2] overflow-hidden rounded-[2rem] bg-[#bb4d29] shadow-[0_36px_90px_rgb(100_35_15_/_30%)] sm:rounded-[2.5rem]"><img className="size-full object-cover" src="/landing/shared-home-v2.jpg" alt={text.accessibility.togetherImage} loading="lazy" /></div></Reveal></div></section>

        <section className="relative grid min-h-[80svh] place-items-center overflow-hidden bg-[#f7f3ed] px-5 py-28 text-center sm:px-8"><div className="landing-orbit absolute size-[72vw] min-h-[34rem] min-w-[34rem] rounded-full border border-line" aria-hidden="true" /><Reveal className="landing-centered-copy relative mx-auto max-w-6xl"><h2 className="landing-display text-[clamp(3.8rem,9vw,9rem)] leading-[0.87] font-extrabold tracking-[-0.078em]"><Headline lines={text.ending.title} /></h2><p className="landing-body mx-auto mt-10 max-w-2xl text-lg leading-[1.8] text-muted sm:text-xl">{text.ending.body}</p><Link className="mt-11 inline-flex min-h-14 items-center justify-center rounded-full bg-ink px-9 font-bold text-white no-underline shadow-float transition hover:-translate-y-0.5 hover:bg-brand" to={primaryHref}>{primaryLabel}</Link></Reveal></section>
      </main>

      <footer className="bg-ink text-white/60"><div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-12"><div className="grid gap-12 border-b border-white/10 pb-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(9rem,0.55fr)_minmax(9rem,0.55fr)] lg:gap-16"><div className="sm:col-span-2 lg:col-span-1"><Link className="flex w-fit items-center gap-2.5 text-xl font-black tracking-[-0.04em] text-white no-underline" to="/"><BrandMark /> Nomo</Link><p className="mt-5 max-w-sm text-sm leading-7 text-white/55 sm:text-base">{text.footer.tagline}</p></div><nav aria-label={text.footer.explore}><h2 className="text-xs font-bold tracking-[0.12em] text-white/40 uppercase">{text.footer.explore}</h2><div className="mt-5 grid gap-3 text-sm font-semibold"><a className="w-fit text-white/70 no-underline transition hover:text-white" href="#story">{text.nav.story}</a><a className="w-fit text-white/70 no-underline transition hover:text-white" href="#moments">{text.nav.moments}</a></div></nav><nav aria-label={text.footer.account}><h2 className="text-xs font-bold tracking-[0.12em] text-white/40 uppercase">{text.footer.account}</h2><div className="mt-5 grid gap-3 text-sm font-semibold">{!session ? <Link className="w-fit text-white/70 no-underline transition hover:text-white" to="/login">{text.nav.login}</Link> : null}<Link className="w-fit text-white/70 no-underline transition hover:text-white" to={primaryHref}>{primaryLabel}</Link></div></nav></div><div className="flex flex-col gap-4 pt-6 text-xs leading-5 sm:flex-row sm:items-center sm:justify-between"><p className="m-0">© {new Date().getFullYear()} Nomo. {text.footer.rights}</p><div className="flex flex-wrap items-center gap-x-6 gap-y-2"><Link className="text-inherit no-underline transition hover:text-white" to={`/legal/privacy?lang=${locale}`}>{text.footer.privacy}</Link><Link className="text-inherit no-underline transition hover:text-white" to={`/legal/terms?lang=${locale}`}>{text.footer.terms}</Link></div></div></div></footer>
    </div>
  )
}

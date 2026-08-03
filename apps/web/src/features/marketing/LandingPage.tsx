import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { AppIcon } from '../../components/AppIcon'
import { BrandIcon } from '../../components/BrandIcon'

type Language = 'zh' | 'en'
const languagePreferenceKey = 'nomo-landing-language'

function initialLanguage(): Language {
  try {
    const savedLanguage = window.localStorage.getItem(languagePreferenceKey)
    if (savedLanguage === 'zh' || savedLanguage === 'en') return savedLanguage
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
  return document.documentElement.lang.startsWith('en') ? 'en' : 'zh'
}

const copy = {
  zh: {
    nav: { story: '我们的故事', moments: '生活场景', login: '登录', start: '免费开始', enter: '进入 Nomo' },
    hero: {
      eyebrow: 'Nomo · 为家记住',
      title: ['收起来。', '也找得回来。'],
      body: '不必记住每件东西放在哪里。你只需要记得，自己想找什么。',
      more: '看看 Nomo 如何改变生活',
      scroll: '向下，重新认识收纳',
    },
    forgotten: {
      eyebrow: '东西没有消失',
      title: ['我们收好了', '很多东西。', '也忘记了它们。'],
      body: '换季的衣服，孩子去年的玩具，偶尔才用的工具。它们还在家里，只是慢慢离开了我们的记忆。',
      items: ['换季的衣服', '去年的玩具', '偶尔才用的工具'],
    },
    memory: {
      eyebrow: '一段生活，再次回来',
      title: ['需要的时候，', '它就在。'],
      body: '不是翻遍每一个柜子之后的偶然发现。而是在想起它的那一刻，就知道该去哪里。',
    },
    find: {
      eyebrow: '你负责想起，Nomo 负责记得',
      title: ['寻找，', '可以很安静。'],
      body: '输入“露营灯”。家、储藏室、户外用品箱——它的来路，清清楚楚。',
      searchLabel: '你想找什么？',
      searchValue: '露营灯',
      found: '找到了',
      box: '户外用品箱',
      place: '家 · 储藏室 · 靠门右侧第二层',
      there: '它就在那里',
    },
    scan: {
      eyebrow: '让箱子拥有记忆',
      title: ['看不见里面。', '依然知道', '里面有什么。'],
      body: '轻轻一扫，收进去的东西重新出现在眼前。箱子关上了，记忆没有。',
      label: '冬日衣物',
      place: '卧室 · 顶柜',
    },
    move: {
      eyebrow: '新的房间，不陌生',
      title: ['搬家之后，', '生活依然熟悉。'],
      body: '即使周围都是相似的纸箱，你也知道今晚要用的杯子、床单和充电器，分别在哪一个里面。',
    },
    together: {
      eyebrow: '家的记忆，属于每个人',
      title: ['家的秩序，', '不必只住在', '一个人的脑海里。'],
      body: '家人不必再问“放哪了”。每个人都能自己找到，也能把它放回正确的位置。',
    },
    ending: {
      title: ['少一点寻找。', '多一点生活。'],
      body: '让每一件被珍惜的东西，都能在需要时重新回到身边。',
    },
    footer: '每件东西，都值得有一个找得到的地方。',
  },
  en: {
    nav: { story: 'Our story', moments: 'Life with Nomo', login: 'Sign in', start: 'Get started', enter: 'Open Nomo' },
    hero: {
      eyebrow: 'Nomo · A memory for your home',
      title: ['Put away.', 'Never lost.'],
      body: "You don't need to remember where everything lives. Only what you're looking for.",
      more: 'See how Nomo changes life at home',
      scroll: 'Scroll to rethink storage',
    },
    forgotten: {
      eyebrow: "Nothing's gone",
      title: ['We put so much away.', 'Then forget', 'it was ever there.'],
      body: "Last season's clothes. The toys they once loved. The tool you need twice a year. Still at home, just no longer in mind.",
      items: ["Last season's clothes", 'The toys they once loved', 'The tool you rarely need'],
    },
    memory: {
      eyebrow: 'A little piece of life, returned',
      title: ['Right when you need it,', 'there it is.'],
      body: 'Not a lucky find after opening every cupboard. The moment you remember it, you know exactly where to go.',
    },
    find: {
      eyebrow: 'You recall it. Nomo remembers the rest.',
      title: ['Finding things', 'can feel this quiet.'],
      body: 'Search “camping lantern.” Home, storage room, outdoor box—one clear path back to it.',
      searchLabel: 'What are you looking for?',
      searchValue: 'Camping lantern',
      found: 'Found',
      box: 'Outdoor box',
      place: 'Home · Storage room · Second shelf',
      there: 'Right where you left it',
    },
    scan: {
      eyebrow: 'Give every box a memory',
      title: ["You can't see inside.", "You still know what's there."],
      body: 'One quick scan brings everything inside back into view. The box is closed. Its memory stays open.',
      label: 'Winter clothes',
      place: 'Bedroom · Top cabinet',
    },
    move: {
      eyebrow: 'A new room that already feels familiar',
      title: ['After the move,', 'life still feels', 'like yours.'],
      body: "Even when every box looks the same, tonight's mug, sheets and charger each have a place you can find.",
    },
    together: {
      eyebrow: 'A home remembered by everyone',
      title: ["Home's order", "shouldn't live", "in one person's head."],
      body: 'No more asking where things went. Everyone can find what they need—and return it to the right place.',
    },
    ending: {
      title: ['Less time searching.', 'More time living.'],
      body: 'So everything worth keeping can find its way back to you, right when you need it.',
    },
    footer: 'Everything deserves a place you can find.',
  },
} as const

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
  const separator = lines.some((line) => /[A-Za-z]/.test(line)) ? ' ' : ''
  return (
    <span className={className}>
      <span className="sr-only">{lines.join(separator)}</span>
      <span aria-hidden="true">
        {lines.map((line) => <span className="block" key={line}>{line}</span>)}
      </span>
    </span>
  )
}

function ProductMoment({ language }: { language: Language }) {
  const t = copy[language].find
  return (
    <div className="relative mx-auto w-full max-w-[31rem]" aria-label={language === 'zh' ? 'Nomo 查找物品界面示意' : 'Nomo item search preview'}>
      <div className="absolute -inset-8 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[2.4rem] border-[8px] border-ink bg-surface shadow-[0_32px_90px_rgb(47_31_20_/_26%)]">
        <div className="flex h-11 items-center justify-center border-b border-line/70">
          <span className="h-1.5 w-14 rounded-full bg-ink/15" />
        </div>
        <div className="p-5 sm:p-7">
          <p className="text-xs font-bold tracking-[0.12em] text-muted">{t.searchLabel}</p>
          <div className="landing-search mt-4 flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-white px-5">
            <span className="size-2.5 shrink-0 rounded-full bg-brand" />
            <strong className="landing-search-text text-base text-ink sm:text-lg">{t.searchValue}</strong>
            <span className="landing-caret h-5 w-px bg-brand" aria-hidden="true" />
          </div>
          <div className="landing-result mt-5 rounded-[1.55rem] bg-canvas p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-[0.14em] text-brand-strong">{t.found}</span>
              <span className="grid size-8 place-items-center rounded-full bg-[#ddc26d] text-xs text-ink" aria-hidden="true">●</span>
            </div>
            <h3 className="mt-8 text-2xl font-bold tracking-[-0.035em]">{t.box}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{t.place}</p>
            <div className="mt-8 flex items-center gap-3 text-xs font-bold text-brand-strong">
              <span className="h-px flex-1 bg-brand/25" />
              {t.there}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MemoryTag({ language }: { language: Language }) {
  const t = copy[language].scan
  return (
    <div className="landing-tag relative mx-auto aspect-[4/3] w-full max-w-[34rem] overflow-hidden rounded-[2.4rem] bg-[#d8b996] shadow-float" aria-hidden="true">
      <div className="absolute inset-x-[8%] bottom-[-10%] h-[67%] rounded-t-[1.5rem] bg-[#a86f47] shadow-[0_-22px_50px_rgb(73_44_26_/_14%)]">
        <span className="absolute inset-x-[8%] top-[21%] h-px bg-white/25" />
        <span className="absolute top-[9%] left-1/2 h-28 w-px -translate-x-1/2 bg-white/25" />
      </div>
      <div className="absolute top-[22%] left-[10%] flex -rotate-3 items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-float sm:gap-4 sm:p-4">
        <div className="size-16 shrink-0 overflow-hidden bg-canvas sm:size-20">
          <img className="size-full object-contain" src="/landing/nomo-qr.png" alt="" />
        </div>
        <div className="min-w-0 pr-1">
          <strong className="block whitespace-nowrap text-sm text-ink sm:text-base">{t.label}</strong>
          <span className="mt-1 block whitespace-nowrap text-[0.65rem] font-bold tracking-[0.08em] text-brand-strong sm:text-xs">BX-012</span>
          <span className="mt-1 block whitespace-nowrap text-[0.62rem] text-muted sm:text-xs">{t.place}</span>
        </div>
      </div>
      <span className="landing-scan-line absolute top-[12%] bottom-[6%] left-[11%] w-0.5 bg-brand shadow-[0_0_18px_4px_rgb(223_101_56_/_55%)]" />
      <div className="absolute top-[15%] right-[12%] grid size-24 place-items-center rounded-full border border-white/50 bg-white/15 backdrop-blur-md sm:size-28">
        <span className="landing-ring size-12 rounded-full border-2 border-white/80 border-r-transparent sm:size-14" />
      </div>
    </div>
  )
}

export function LandingPage() {
  const { session } = useAuth()
  const [language, setLanguage] = useState<Language>(initialLanguage)
  const t = copy[language]
  const primaryHref = session ? '/app' : '/register'
  const primaryLabel = session ? t.nav.enter : t.nav.start

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
    document.title = language === 'zh' ? 'Nomo｜收起来，也找得回来' : 'Nomo | Put away. Never lost.'
    try {
      window.localStorage.setItem(languagePreferenceKey, language)
    } catch {
      // The current page can still switch languages without persistence.
    }
  }, [language])

  return (
    <div className={`landing-page min-h-dvh overflow-hidden bg-[#f7f3ed] text-ink ${language === 'en' ? 'landing-en' : 'landing-zh'}`}>
      <a className="sr-only z-[100] rounded-full bg-ink px-5 py-3 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3" href="#main-content">
        {language === 'zh' ? '跳到主要内容' : 'Skip to content'}
      </a>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-ink/[0.08] bg-[#f7f3ed]/90 backdrop-blur-xl">
        <nav className="mx-auto flex h-[4.5rem] w-full max-w-7xl items-center px-4 sm:px-6 lg:px-10" aria-label={language === 'zh' ? '落地页导航' : 'Landing page navigation'}>
          <Link className="flex shrink-0 items-center gap-2 text-lg font-black tracking-[-0.04em] text-ink no-underline" to="/" aria-label="Nomo">
            <BrandMark /> <span className="hidden min-[360px]:inline">Nomo</span>
          </Link>
          <div className="ml-auto flex min-w-0 items-center justify-end gap-0.5 sm:gap-1">
            <div className="hidden items-center md:flex">
              <a className="rounded-lg px-3.5 py-2 text-sm font-semibold text-muted no-underline transition hover:bg-ink/[0.05] hover:text-ink" href="#story">{t.nav.story}</a>
              <a className="rounded-lg px-3.5 py-2 text-sm font-semibold text-muted no-underline transition hover:bg-ink/[0.05] hover:text-ink" href="#moments">{t.nav.moments}</a>
            </div>
            <label className="relative inline-flex h-10 shrink-0 items-center rounded-lg text-muted transition hover:bg-ink/[0.05] focus-within:bg-ink/[0.05] focus-within:text-ink">
              <span className="sr-only">{language === 'zh' ? '选择语言' : 'Choose language'}</span>
              <select
                className="h-full max-w-[6.6rem] appearance-none border-0 bg-transparent py-0 pr-7 pl-2.5 text-xs font-semibold text-ink outline-none sm:max-w-none sm:px-3 sm:pr-8 sm:text-sm"
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
              >
                <option value="zh">简体中文</option>
                <option value="en">English</option>
              </select>
              <AppIcon className="pointer-events-none absolute right-2.5 rotate-90" name="chevron-right" size={12} />
            </label>
            {!session ? <Link className="hidden min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-ink no-underline transition hover:bg-ink/[0.05] sm:inline-flex" to="/login">{t.nav.login}</Link> : null}
            <Link className="ml-1 inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-ink px-3.5 text-xs font-bold text-white no-underline transition hover:bg-brand sm:ml-2 sm:px-5 sm:text-sm" to={primaryHref}>{primaryLabel}</Link>
          </div>
        </nav>
      </header>

      <main id="main-content">
        <section className="relative min-h-[100svh] overflow-hidden bg-[#e9e0d4]">
          <img className="landing-hero-image absolute inset-0 h-full w-full object-cover object-[64%_center]" src="/landing/hero-home-v2.jpg" alt="" fetchPriority="high" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(247_243_237_/_98%)_0%,rgb(247_243_237_/_89%)_35%,rgb(247_243_237_/_20%)_70%,transparent_100%)] max-md:bg-[linear-gradient(180deg,rgb(247_243_237_/_96%)_0%,rgb(247_243_237_/_72%)_48%,rgb(30_20_15_/_22%)_100%)]" />
          <div className="relative mx-auto flex min-h-[100svh] w-full max-w-7xl items-center px-5 pt-24 pb-24 sm:px-8 lg:px-12">
            <div className="landing-hero-copy max-w-[52rem]">
              <p className="landing-eyebrow mb-7 text-xs font-bold tracking-[0.22em] text-brand-strong sm:text-sm">{t.hero.eyebrow}</p>
              <h1 className="landing-hero-title text-[clamp(3.75rem,9.3vw,8.7rem)] leading-[0.87] font-extrabold tracking-[-0.075em] text-ink">
                <Headline lines={t.hero.title} />
              </h1>
              <p className="landing-body mt-8 max-w-xl text-lg leading-[1.7] text-muted sm:mt-10 sm:text-xl lg:text-2xl">{t.hero.body}</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link className="inline-flex min-h-13 items-center justify-center rounded-full bg-brand px-7 font-bold text-white no-underline shadow-[0_16px_36px_rgb(189_75_36_/_24%)] transition hover:-translate-y-0.5 hover:bg-brand-strong" to={primaryHref}>{primaryLabel}</Link>
                <a className="inline-flex min-h-13 items-center justify-center rounded-full border border-ink/15 bg-white/55 px-7 font-bold text-ink no-underline backdrop-blur-sm hover:bg-white/80" href="#story">{t.hero.more}</a>
              </div>
            </div>
          </div>
          <a className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 items-center gap-3 text-xs font-bold tracking-[0.12em] text-ink/60 no-underline md:flex" href="#story">
            <span className="landing-scroll-dot grid h-10 w-6 place-items-start justify-center rounded-full border border-ink/25 pt-2"><span className="size-1 rounded-full bg-brand" /></span>
            {t.hero.scroll}
          </a>
        </section>

        <section className="bg-[#f7f3ed]" id="story">
          <Reveal className="mx-auto flex min-h-[50rem] w-full max-w-7xl items-center px-5 py-24 sm:px-8 lg:px-12 lg:py-28">
            <div className="grid w-full gap-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-20">
              <div className="landing-story-copy">
                <p className="landing-eyebrow mb-7 text-xs font-bold tracking-[0.22em] text-brand-strong sm:mb-9 sm:text-sm">{t.forgotten.eyebrow}</p>
                <h2 className="landing-display landing-story-title max-w-[11ch] font-extrabold tracking-[-0.065em]">
                  <Headline lines={t.forgotten.title} />
                </h2>
                <p className="landing-body mt-10 max-w-2xl text-lg leading-[1.8] text-muted sm:text-xl">{t.forgotten.body}</p>
              </div>
              <div className="mx-auto w-full max-w-[34rem]">
                <div className="landing-forgotten-visual relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-[#d7c0a5] shadow-[0_32px_80px_rgb(62_42_26_/_16%)] sm:rounded-[2.5rem]">
                  <img
                    className="size-full object-cover"
                    src="/landing/forgotten-still-life-v1.jpg"
                    alt={language === 'zh' ? '收在柜子里的换季衣物、旧玩具和工具' : 'Seasonal clothes, an old toy and a tool stored away in a cabinet'}
                    loading="lazy"
                  />
                </div>
                <div className="landing-forgotten-items mt-8 grid grid-cols-3 gap-2 sm:mt-10 sm:gap-4" aria-hidden="true">
                  {t.forgotten.items.map((item, index) => (
                    <div className="landing-forgotten-item" key={item}>
                      <span>0{index + 1}</span>
                      <strong>{item}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="relative min-h-[88svh] overflow-hidden bg-ink">
          <img className="absolute inset-0 h-full w-full object-cover object-center" src="/landing/memory-family.jpg" alt="" loading="lazy" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_30%,rgb(28_18_12_/_18%)_58%,rgb(28_18_12_/_84%)_100%)] max-md:bg-[linear-gradient(180deg,transparent_20%,rgb(28_18_12_/_25%)_52%,rgb(28_18_12_/_92%)_100%)]" />
          <Reveal className="relative mx-auto flex min-h-[88svh] w-full max-w-7xl items-end justify-end px-5 py-16 sm:px-8 md:items-center lg:px-12">
            <div className="landing-copy-panel max-w-xl text-white">
              <p className="landing-eyebrow mb-6 text-xs font-bold tracking-[0.22em] text-[#efac8e] sm:text-sm">{t.memory.eyebrow}</p>
              <h2 className="landing-display text-[clamp(3.2rem,6vw,6.4rem)] leading-[0.93] font-extrabold tracking-[-0.065em] text-white"><Headline lines={t.memory.title} /></h2>
              <p className="landing-body mt-8 text-lg leading-[1.75] text-white/72 sm:text-xl">{t.memory.body}</p>
            </div>
          </Reveal>
        </section>

        <section className="bg-[#efe5d8]" id="moments">
          <div className="mx-auto grid w-full max-w-7xl gap-20 px-5 py-28 sm:px-8 lg:grid-cols-[1fr_0.82fr] lg:items-center lg:px-12 lg:py-40">
            <Reveal>
              <p className="landing-eyebrow mb-6 text-xs font-bold tracking-[0.22em] text-brand-strong sm:text-sm">{t.find.eyebrow}</p>
              <h2 className="landing-display text-[clamp(3.2rem,6.5vw,6.7rem)] leading-[0.93] font-extrabold tracking-[-0.065em]"><Headline lines={t.find.title} /></h2>
              <p className="landing-body mt-9 max-w-xl text-lg leading-[1.8] text-muted sm:text-xl">{t.find.body}</p>
            </Reveal>
            <Reveal className="lg:py-10"><ProductMoment language={language} /></Reveal>
          </div>
        </section>

        <section className="bg-[#30271e] text-white">
          <div className="mx-auto grid w-full max-w-7xl gap-20 px-5 py-28 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-12 lg:py-40">
            <Reveal><MemoryTag language={language} /></Reveal>
            <Reveal>
              <p className="landing-eyebrow mb-6 text-xs font-bold tracking-[0.22em] text-[#efac8e] sm:text-sm">{t.scan.eyebrow}</p>
              <h2 className="landing-display text-[clamp(3.1rem,5.8vw,6rem)] leading-[0.94] font-extrabold tracking-[-0.06em] text-white"><Headline lines={t.scan.title} /></h2>
              <p className="landing-body mt-9 max-w-xl text-lg leading-[1.8] text-white/65 sm:text-xl">{t.scan.body}</p>
            </Reveal>
          </div>
        </section>

        <section className="grid min-h-[85svh] bg-[#f7f3ed] lg:grid-cols-2">
          <div className="relative min-h-[55svh] overflow-hidden lg:min-h-full">
            <img className="landing-moving-image absolute inset-0 h-full w-full object-cover object-center" src="/landing/moving-home-v2.jpg" alt="" loading="lazy" />
          </div>
          <Reveal className="flex items-center px-5 py-24 sm:px-12 lg:px-[clamp(3rem,7vw,8rem)]">
            <div className="landing-copy-panel">
              <p className="landing-eyebrow mb-6 text-xs font-bold tracking-[0.22em] text-brand-strong sm:text-sm">{t.move.eyebrow}</p>
              <h2 className="landing-display text-[clamp(3rem,5.5vw,5.8rem)] leading-[0.94] font-extrabold tracking-[-0.06em]"><Headline lines={t.move.title} /></h2>
              <p className="landing-body mt-9 max-w-xl text-lg leading-[1.8] text-muted sm:text-xl">{t.move.body}</p>
            </div>
          </Reveal>
        </section>

        <section className="relative overflow-hidden bg-[#df6538] px-5 py-28 text-white sm:px-8 lg:py-36">
          <span className="absolute top-[-18rem] left-[-10rem] size-[42rem] rounded-full border border-white/15" aria-hidden="true" />
          <span className="absolute right-[-12rem] bottom-[-20rem] size-[46rem] rounded-full border border-white/15" aria-hidden="true" />
          <div className="relative mx-auto grid w-full max-w-7xl gap-16 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:gap-20">
            <Reveal className="landing-together-copy">
              <p className="landing-eyebrow mb-7 text-xs font-bold tracking-[0.22em] text-white/70 sm:mb-9 sm:text-sm">{t.together.eyebrow}</p>
              <h2 className="landing-display landing-together-title max-w-[11ch] font-extrabold tracking-[-0.065em] text-white"><Headline lines={t.together.title} /></h2>
              <p className="landing-body mt-9 max-w-[38rem] text-lg leading-[1.8] text-white/78 sm:mt-11 sm:text-xl">{t.together.body}</p>
            </Reveal>
            <Reveal>
              <div className="relative aspect-[3/2] overflow-hidden rounded-[2rem] bg-[#bb4d29] shadow-[0_36px_90px_rgb(100_35_15_/_30%)] sm:rounded-[2.5rem]">
                <img
                  className="size-full object-cover"
                  src="/landing/shared-home-v2.jpg"
                  alt={language === 'zh' ? '孩子自己从家中收纳柜里找到露营灯' : 'A child finding a camping lantern in the family storage cabinet'}
                  loading="lazy"
                />
              </div>
            </Reveal>
          </div>
        </section>

        <section className="relative grid min-h-[92svh] place-items-center overflow-hidden bg-[#f7f3ed] px-5 py-28 text-center sm:px-8">
          <div className="landing-orbit absolute size-[72vw] min-h-[34rem] min-w-[34rem] rounded-full border border-line" aria-hidden="true" />
          <div className="landing-orbit landing-orbit-reverse absolute size-[48vw] min-h-[24rem] min-w-[24rem] rounded-full border border-line/75" aria-hidden="true" />
          <Reveal className="landing-centered-copy relative mx-auto max-w-6xl">
            <h2 className="landing-display landing-ending-title text-[clamp(3.8rem,9vw,9rem)] leading-[0.87] font-extrabold tracking-[-0.078em]"><Headline lines={t.ending.title} /></h2>
            <p className="landing-body mx-auto mt-10 max-w-2xl text-lg leading-[1.8] text-muted sm:text-xl">{t.ending.body}</p>
            <Link className="mt-11 inline-flex min-h-14 items-center justify-center rounded-full bg-ink px-9 font-bold text-white no-underline shadow-float transition hover:-translate-y-0.5 hover:bg-brand" to={primaryHref}>{primaryLabel}</Link>
          </Reveal>
        </section>
      </main>

      <footer className="bg-ink text-white/60">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <Link className="flex items-center gap-2.5 text-lg font-black tracking-[-0.04em] text-white no-underline" to="/"><BrandMark /> Nomo</Link>
          <p className="m-0 text-sm">{t.footer}</p>
          <div className="flex items-center gap-5 text-sm font-semibold">
            <button className="text-inherit hover:text-white" type="button" onClick={() => setLanguage((current) => current === 'zh' ? 'en' : 'zh')}>{language === 'zh' ? 'English' : '中文'}</button>
            {!session ? <Link className="text-inherit no-underline hover:text-white" to="/login">{t.nav.login}</Link> : null}
          </div>
        </div>
      </footer>
    </div>
  )
}

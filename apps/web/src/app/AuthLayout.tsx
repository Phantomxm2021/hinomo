import { Link, Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="auth-shell mx-auto grid min-h-dvh w-full overflow-hidden bg-surface md:my-6 md:min-h-[min(800px,calc(100dvh-3rem))] md:w-[min(1180px,calc(100%-2rem))] md:grid-cols-[minmax(0,1.08fr)_minmax(26.25rem,0.92fr)] md:rounded-[2rem] md:border md:border-line md:shadow-[0_28px_80px_rgb(86_58_36_/_18%)]">
      <section className="auth-visual relative flex min-h-56 flex-col justify-between overflow-hidden bg-sidebar p-6 text-muted md:min-h-0 md:p-[clamp(2rem,4vw,3.5rem)]" aria-label="Nomo 产品介绍">
        <img className="auth-visual-image absolute inset-0 size-full object-cover" src="/landing/hero-home-v2.jpg" alt="" />
        <span className="auth-visual-shade absolute inset-0" aria-hidden="true" />
        <Link className="auth-brand relative z-10 flex w-fit items-center gap-2.5 text-2xl font-black tracking-[-0.05em] text-ink no-underline" to="/">
          <span className="grid size-11 place-items-center rounded-[0.9rem] bg-brand text-2xl font-black tracking-normal text-white shadow-soft" aria-hidden="true">N</span>
          Nomo
        </Link>
        <div className="auth-story relative z-10 max-w-[31rem] rounded-[1.6rem] border border-white/60 bg-[#fffaf2]/88 p-5 shadow-[0_18px_50px_rgb(62_39_22_/_16%)] backdrop-blur-xl md:p-7">
          <p className="mb-2 text-xs font-bold tracking-[0.18em] text-brand-strong">智能收纳清单</p>
          <h2 className="m-0 max-w-md text-[clamp(1.8rem,3.2vw,3.15rem)] leading-[1.08] font-extrabold tracking-[-0.055em] text-ink">让每件物品都有迹可循</h2>
          <p className="mt-4 mb-0 max-w-md leading-[1.75] text-muted max-md:hidden">为收纳箱生成二维码，扫码即可查看、搜索和维护箱内物品。</p>
        </div>
      </section>
      <div className="auth-form-panel relative grid place-items-center overflow-hidden bg-surface px-6 pt-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] md:p-[clamp(2.5rem,5vw,4.5rem)] [&_main]:w-full [&_main]:max-w-md [&_h1]:text-page-title [&_h1]:font-extrabold">
        <span className="auth-form-orbit absolute -top-40 -right-40 size-80 rounded-full border border-line/55" aria-hidden="true" />
        <div className="auth-form-frame relative z-10 w-full max-w-md bg-surface [&_h1]:text-page-title [&_h1]:font-extrabold">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

import { Link, Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="mx-auto grid min-h-dvh w-full overflow-hidden bg-surface md:min-h-[min(760px,calc(100dvh-3rem))] md:w-[min(1120px,calc(100%-2rem))] md:grid-cols-[minmax(0,1.05fr)_minmax(26.25rem,0.95fr)] md:rounded-shell md:border md:border-line md:shadow-float md:my-6">
      <section className="flex min-h-48 flex-col justify-between gap-9 bg-sidebar p-6 text-muted md:min-h-0 md:gap-20 md:p-[clamp(2rem,6vw,4.5rem)]" aria-label="Nomo 产品介绍">
        <Link className="flex w-fit items-center gap-2 text-2xl font-black tracking-[-0.05em] text-ink no-underline" to="/">
          <span className="grid size-10 place-items-center rounded-control bg-brand text-2xl font-black tracking-normal text-white" aria-hidden="true">N</span>
          Nomo
        </Link>
        <div>
          <p className="mb-1 text-xs font-extrabold tracking-[0.12em] text-brand uppercase">智能收纳清单</p>
          <h2 className="mb-2 max-w-md text-3xl font-black tracking-tight text-ink md:text-5xl">让每件物品都有迹可循</h2>
          <p className="max-w-lg max-md:hidden">为收纳箱生成二维码，扫码即可查看、搜索和维护箱内物品。</p>
        </div>
      </section>
      <div className="grid place-items-center bg-surface px-6 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] md:p-[clamp(2rem,6vw,4.5rem)] [&_main]:w-full [&_main]:max-w-md [&_h1]:mb-7 [&_h1]:text-2xl md:[&_h1]:text-4xl [&_h1]:font-black [&_form]:grid [&_form]:gap-3 [&_label]:font-bold [&_label]:text-ink [&_input]:min-h-12 [&_input]:w-full [&_input]:rounded-control [&_input]:border [&_input]:border-line [&_input]:bg-surface [&_input]:px-3 [&_input]:text-ink [&_input:focus]:border-brand [&_button]:min-h-11 [&_button]:rounded-control [&_button]:border [&_button]:border-brand [&_button]:bg-brand [&_button]:px-4 [&_button]:py-2 [&_button]:font-bold [&_button]:text-white [&_nav]:mt-5 [&_nav]:flex [&_nav]:flex-wrap [&_nav]:gap-x-5 [&_nav]:gap-y-3 [&_main>a]:mt-5 [&_main>a]:inline-flex"><Outlet /></div>
    </div>
  )
}

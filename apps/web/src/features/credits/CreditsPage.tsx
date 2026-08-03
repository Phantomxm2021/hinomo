import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { getCreditSummary, listCreditTransactions, startCheckout, type CheckoutAction } from './credits.api'

const transactionLabels = {
  grant: '额度已到账', reserve: '识别处理中', consume: 'AI 识别', release: '额度已退回', expire: '额度已过期', refund: '退款额度', revoke: '额度已收回',
} as const

const packs: { action: CheckoutAction; credits: number; price: string; caption: string }[] = [
  { action: 'credits_20', credits: 20, price: 'HK$12', caption: '适合轻量整理' },
  { action: 'credits_100', credits: 100, price: 'HK$42', caption: '适合整屋收纳 · 省 30%' },
  { action: 'credits_500', credits: 500, price: 'HK$148', caption: '适合大量整理 · 省 51%' },
]

export function CreditsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const feedback = useMobileFeedback()
  const queryClient = useQueryClient()
  const summaryQuery = useQuery({ queryKey: ['credit-summary'], queryFn: getCreditSummary })
  const transactionsQuery = useQuery({ queryKey: ['credit-transactions'], queryFn: () => listCreditTransactions(20) })
  const checkoutMutation = useMutation({ mutationFn: (action: CheckoutAction) => startCheckout(action) })

  useEffect(() => {
    if (searchParams.get('checkout') !== 'success') return
    void queryClient.invalidateQueries({ queryKey: ['credit-summary'] })
    void queryClient.invalidateQueries({ queryKey: ['credit-transactions'] })
    feedback.notify('支付已完成，credits 正在到账')
  }, [feedback, queryClient, searchParams])

  const summary = summaryQuery.data
  return (
    <section className="mx-auto grid w-full max-w-5xl gap-5" aria-labelledby="credits-title">
      <nav className="mobile-detail-nav sticky top-0 z-20 -mx-4 grid min-h-14 grid-cols-[6rem_minmax(0,1fr)_6rem] items-end border-b border-line/70 bg-canvas/90 px-4 pt-[max(0.5rem,var(--safe-area-top))] pb-2 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5 lg:hidden" aria-label="AI credits 导航">
        <div className="flex justify-start"><button className="inline-flex size-11 items-center justify-center rounded-full text-ink active:bg-placeholder/70" type="button" aria-label="返回我的" onClick={() => navigate(-1)}><AppIcon className="rotate-180" name="chevron-right" size={22} /></button></div>
        <span className="truncate pb-2 text-center text-[1.0625rem] leading-none font-bold text-ink">AI Credits</span><span />
      </nav>
      <header className="hidden py-3 lg:block"><h1 className="m-0 text-page-title font-extrabold" id="credits-title">AI Credits</h1></header>

      {summaryQuery.isPending ? <SkeletonGroup className="grid gap-4 rounded-[1.75rem] bg-surface p-6 shadow-soft" label="正在加载额度"><Skeleton className="size-16 rounded-[1.2rem]" /><Skeleton className="h-8 w-40" /><Skeleton className="h-16 w-full rounded-control" /></SkeletonGroup> : null}
      {summaryQuery.isError ? <PageState state="error" message="额度信息加载失败" onRetry={() => void summaryQuery.refetch()} /> : null}

      {summary ? <>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,1.05fr)] lg:items-stretch">
        <section className="overflow-hidden rounded-[1.75rem] bg-[linear-gradient(145deg,#5f7869_0%,#334b40_100%)] p-6 text-white shadow-float lg:flex lg:min-h-[18rem] lg:flex-col lg:p-8" aria-label="AI 额度概览">
          <div className="flex items-start justify-between gap-4"><div className="grid size-16 place-items-center rounded-[1.2rem] bg-white/14 ring-1 ring-white/15 backdrop-blur"><AppIcon name="scan" size={30} /></div><span className="rounded-full bg-white/14 px-3 py-1 text-xs font-extrabold tracking-wide">不自动续费</span></div>
          <p className="mt-8 text-sm font-semibold text-white/70 lg:mt-auto">可用识别额度</p>
          <p className="mt-1 text-[3.25rem] leading-none font-black tracking-[-0.05em]">{summary.credits_available}<span className="ml-2 text-base tracking-normal text-white/70">credits</span></p>
          <p className="mt-4 text-sm text-white/70">1 张提交分析的照片使用 1 credit{summary.credits_reserved ? ` · ${summary.credits_reserved} 处理中` : ''}</p>
        </section>

        <section className="grid content-start gap-2">
          <h2 className="m-0 px-4 text-meta font-medium text-muted">购买额度</h2>
          <div className="overflow-hidden rounded-card bg-surface shadow-soft lg:border lg:border-line">
            {packs.map((pack) => <button className="flex min-h-17 w-full items-center gap-3 border-b border-line/60 px-4 text-left last:border-b-0 disabled:opacity-50" type="button" disabled={checkoutMutation.isPending} onClick={() => checkoutMutation.mutate(pack.action)} key={pack.action}><span className="grid size-10 place-items-center rounded-[0.8rem] bg-brand/10 font-extrabold text-brand">{pack.credits}</span><span className="min-w-0 flex-1"><strong className="block">购买 {pack.credits} credits</strong><span className="text-sm text-muted">{pack.caption} · 长期有效</span></span><strong className="shrink-0 text-sm text-ink">{pack.price}</strong><AppIcon name="chevron-right" className="text-muted" /></button>)}
          </div>
        </section>
        </div>

        <section className="grid gap-2">
          <h2 className="m-0 px-4 text-meta font-medium text-muted">最近记录</h2>
          <div className="overflow-hidden rounded-card bg-surface shadow-soft lg:border lg:border-line">
            {transactionsQuery.data?.length ? transactionsQuery.data.map((transaction) => {
              const positive = ['grant', 'release', 'refund'].includes(transaction.kind)
              return <div className="flex min-h-16 items-center gap-3 border-b border-line/60 px-4 last:border-b-0" key={transaction.id}><span className="grid size-9 place-items-center rounded-full bg-placeholder text-muted"><AppIcon name={positive ? 'plus' : 'minus'} /></span><span className="min-w-0 flex-1"><strong className="block text-sm">{transaction.description || transactionLabels[transaction.kind]}</strong><span className="text-xs text-muted">{new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(transaction.created_at))}</span></span><strong className={positive ? 'text-brand' : 'text-ink'}>{positive ? '+' : '−'}{transaction.credit_amount}</strong></div>
            }) : <p className="p-5 text-center text-sm font-semibold text-muted">还没有额度记录</p>}
          </div>
        </section>
      </> : null}
      {checkoutMutation.isError ? <ResponsiveOperationError message="暂时无法连接支付服务，请稍后重试" /> : null}
      <p className="px-4 text-center text-xs leading-5 text-muted">Credits 为一次性购买，由 Stripe 安全处理；不会订阅或自动续费。</p>
    </section>
  )
}

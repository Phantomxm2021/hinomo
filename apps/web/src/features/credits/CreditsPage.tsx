import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { useI18n } from '../../i18n/I18nProvider'
import { captureGrowthEvent, type CheckoutProduct } from '../../lib/analytics'
import { startBoxUnlimitedCheckout } from '../boxes/box-entitlements.api'
import { getCreditSummary, listCreditTransactions, startCheckout, type CheckoutAction } from './credits.api'

const packs: { action: CheckoutAction; credits: number; price: string; captionKey: 'packLight' | 'packHome' | 'packLarge' }[] = [
  { action: 'credits_20', credits: 20, price: 'US$2.99', captionKey: 'packLight' },
  { action: 'credits_100', credits: 100, price: 'US$9.99', captionKey: 'packHome' },
  { action: 'credits_500', credits: 500, price: 'US$34.99', captionKey: 'packLarge' },
]

function checkoutProduct(value: string | null): CheckoutProduct | null {
  return value === 'credits_20' || value === 'credits_100' || value === 'credits_500' ? value : null
}

export function CreditsPage() {
  const navigate = useNavigate()
  const { t, locale } = useI18n()
  const [searchParams] = useSearchParams()
  const feedback = useMobileFeedback()
  const queryClient = useQueryClient()
  const summaryQuery = useQuery({ queryKey: ['credit-summary'], queryFn: getCreditSummary })
  const transactionsQuery = useQuery({ queryKey: ['credit-transactions'], queryFn: () => listCreditTransactions(20) })
  const checkoutMutation = useMutation({ mutationFn: (action: CheckoutAction) => startCheckout(action) })
  const unlimitedCheckoutMutation = useMutation({ mutationFn: startBoxUnlimitedCheckout })
  const completedCheckoutRef = useRef<string | null>(null)

  useEffect(() => {
    if (searchParams.get('checkout') !== 'success') return
    const product = checkoutProduct(searchParams.get('checkout_product'))
    if (product && completedCheckoutRef.current !== product) {
      completedCheckoutRef.current = product
      captureGrowthEvent('purchase_completed', { product, confirmation: 'checkout_return' })
    }
    void queryClient.invalidateQueries({ queryKey: ['credit-summary'] })
    void queryClient.invalidateQueries({ queryKey: ['credit-transactions'] })
    feedback.notify(t('credits.paymentComplete'))
  }, [feedback, queryClient, searchParams, t])

  const summary = summaryQuery.data
  return (
    <section className="mx-auto grid w-full max-w-5xl gap-5" aria-labelledby="credits-title">
      <nav className="mobile-detail-nav sticky top-0 z-20 -mx-4 grid min-h-14 grid-cols-[6rem_minmax(0,1fr)_6rem] items-end border-b border-line/70 bg-canvas/90 px-4 pt-[max(0.5rem,var(--safe-area-top))] pb-2 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5 lg:hidden" aria-label={t('credits.nav')}>
        <div className="flex justify-start"><button className="inline-flex size-11 items-center justify-center rounded-full text-ink active:bg-placeholder/70" type="button" aria-label={t('credits.back')} onClick={() => navigate(-1)}><AppIcon className="rotate-180" name="chevron-right" size={22} /></button></div>
        <span className="truncate pb-2 text-center text-[1.0625rem] leading-none font-bold text-ink">{t('credits.title')}</span><span />
      </nav>
      <header className="hidden py-3 lg:block"><h1 className="m-0 text-page-title font-extrabold" id="credits-title">{t('credits.title')}</h1></header>

      {summaryQuery.isPending ? <SkeletonGroup className="grid gap-4 rounded-[1.75rem] bg-surface p-6 shadow-soft" label={t('credits.loading')}><Skeleton className="size-16 rounded-[1.2rem]" /><Skeleton className="h-8 w-40" /><Skeleton className="h-16 w-full rounded-control" /></SkeletonGroup> : null}
      {summaryQuery.isError ? <PageState state="error" message={t('credits.loadError')} onRetry={() => void summaryQuery.refetch()} /> : null}

      {summary ? <>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,1.05fr)] lg:items-stretch">
        <section className="overflow-hidden rounded-[1.75rem] bg-[linear-gradient(145deg,#5f7869_0%,#334b40_100%)] p-6 text-white shadow-float lg:flex lg:min-h-[18rem] lg:flex-col lg:p-8" aria-label={t('credits.overview')}>
          <div className="flex items-start justify-between gap-4"><div className="grid size-16 place-items-center rounded-[1.2rem] bg-white/14 ring-1 ring-white/15 backdrop-blur"><AppIcon name="scan" size={30} /></div><span className="rounded-full bg-white/14 px-3 py-1 text-xs font-extrabold tracking-wide">{t('credits.noRenewal')}</span></div>
          <p className="mt-8 text-sm font-semibold text-white/70 lg:mt-auto">{t('credits.available')}</p>
          <p className="mt-1 text-[3.25rem] leading-none font-black tracking-[-0.05em]">{summary.credits_available}<span className="ml-2 text-base tracking-normal text-white/70">{t('credits.unit')}</span></p>
          <p className="mt-4 text-sm text-white/70">{summary.credits_reserved ? t('credits.usage', { count: summary.credits_reserved }) : t('credits.usageBase')}</p>
        </section>

        <section className="grid content-start gap-2">
          <h2 className="m-0 px-4 text-meta font-medium text-muted">{t('credits.purchase')}</h2>
          <div className="overflow-hidden rounded-card bg-surface shadow-soft lg:border lg:border-line">
            {packs.map((pack) => <button className="flex min-h-17 w-full items-center gap-3 border-b border-line/60 px-4 text-left last:border-b-0 disabled:opacity-50" type="button" disabled={checkoutMutation.isPending || unlimitedCheckoutMutation.isPending} onClick={() => checkoutMutation.mutate(pack.action)} key={pack.action}><span className="grid size-10 place-items-center rounded-[0.8rem] bg-brand/10 font-extrabold text-brand">{pack.credits}</span><span className="min-w-0 flex-1"><strong className="block">{t('credits.purchasePack', { count: pack.credits })}</strong><span className="text-sm text-muted">{t(`credits.${pack.captionKey}`)} · {t('credits.validForever')}</span></span><strong className="shrink-0 text-sm text-ink">{pack.price}</strong><AppIcon name="chevron-right" className="text-muted" /></button>)}
            <div className="grid gap-3 border-t border-line/60 bg-brand/5 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <strong className="block text-base text-ink">{t('credits.unlimitedTitle')}</strong>
                <p className="m-0 mt-1 text-sm text-muted">
                  <span>{t('credits.unlimitedBody')}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{t('credits.unlimitedNoRenewal')}</span>
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <strong className="shrink-0 text-sm text-ink">{t('credits.unlimitedPrice')}</strong>
                <button className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-control bg-brand px-4 text-sm font-bold text-white shadow-soft disabled:opacity-50" type="button" disabled={checkoutMutation.isPending || unlimitedCheckoutMutation.isPending} onClick={() => unlimitedCheckoutMutation.mutate()}>{t('credits.unlimitedButton')}<AppIcon name="chevron-right" size={18} /></button>
              </div>
            </div>
          </div>
        </section>
        </div>

        <section className="grid gap-2">
          <h2 className="m-0 px-4 text-meta font-medium text-muted">{t('credits.recent')}</h2>
          <div className="overflow-hidden rounded-card bg-surface shadow-soft lg:border lg:border-line">
            {transactionsQuery.data?.length ? transactionsQuery.data.map((transaction) => {
              const positive = ['grant', 'release', 'refund'].includes(transaction.kind)
              return <div className="flex min-h-16 items-center gap-3 border-b border-line/60 px-4 last:border-b-0" key={transaction.id}><span className="grid size-9 place-items-center rounded-full bg-placeholder text-muted"><AppIcon name={positive ? 'plus' : 'minus'} /></span><span className="min-w-0 flex-1"><strong className="block text-sm">{transaction.description || t(`credits.activity.${transaction.kind}`)}</strong><span className="text-xs text-muted">{new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(transaction.created_at))}</span></span><strong className={positive ? 'text-brand' : 'text-ink'}>{positive ? '+' : '−'}{transaction.credit_amount}</strong></div>
            }) : <p className="p-5 text-center text-sm font-semibold text-muted">{t('credits.empty')}</p>}
          </div>
        </section>
      </> : null}
      {checkoutMutation.isError || unlimitedCheckoutMutation.isError ? <ResponsiveOperationError message={t('credits.paymentFailed')} error={checkoutMutation.error ?? unlimitedCheckoutMutation.error} /> : null}
      <p className="px-4 text-center text-xs leading-5 text-muted">{t('credits.legal')}</p>
    </section>
  )
}

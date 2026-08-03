import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Skeleton } from '../../components/Skeleton'
import { publicAppOrigin } from '../../lib/env'
import { boxQrPng, boxQrUrl } from '../qr-print/qr'
import type { CreatedBox } from './boxes.api'

export function BoxCreationNextStep({ box }: { box: CreatedBox }) {
  const captureUrl = `${boxQrUrl(publicAppOrigin(), box.public_id)}?capture=1`
  const qrQuery = useQuery({
    queryKey: ['box-capture-qr', box.public_id],
    queryFn: () => boxQrPng(captureUrl),
    staleTime: Infinity,
  })

  return (
    <section className="grid gap-4 rounded-card border border-brand/25 bg-brand/10 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" role="status" aria-label="箱子已创建">
      <div className="min-w-0">
        <p className="m-0 font-bold text-ink">“{box.name}”已创建</p>
        <p className="mt-1 mb-0 text-sm text-muted">接下来记录箱内物品，以后就能直接搜索找到。</p>
        <Link className="mt-3 inline-flex min-h-11 items-center justify-center rounded-control bg-brand px-4 py-2 font-bold text-white no-underline hover:bg-brand-strong" to={`/b/${box.public_id}`}>
          记录箱内物品
        </Link>
      </div>
      <div className="hidden items-center gap-3 rounded-control border border-line/70 bg-surface/80 p-3 lg:flex" aria-label="用手机继续记录">
        {qrQuery.data ? (
          <img className="size-24 rounded-lg bg-white" src={qrQuery.data} alt="手机录入接力二维码" />
        ) : (
          <Skeleton className="size-24 rounded-lg" />
        )}
        <p className="m-0 max-w-32 text-sm font-semibold leading-relaxed text-ink">用手机扫码，直接拍摄箱内物品</p>
      </div>
    </section>
  )
}

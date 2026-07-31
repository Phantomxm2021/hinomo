import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { PageState } from '../../components/PageState'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { getBox } from './boxes.api'

export function BoxDetailPage() {
  const { boxId = '' } = useParams<{ boxId: string }>()
  const query = useQuery({ queryKey: ['box-id', boxId], queryFn: () => getBox(boxId) })
  if (query.isPending && query.data === undefined) {
    return (
      <SkeletonGroup className="mx-auto grid min-w-0 w-full max-w-4xl gap-5 py-6" label="正在加载箱子详情">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
      </SkeletonGroup>
    )
  }
  if ((query.isError && query.data === undefined) || !query.data) return <PageState state="error" message="无权限或内容不存在" onRetry={() => void query.refetch()} />
  if (query.isError) {
    return (
      <section className="mx-auto grid min-w-0 w-full max-w-4xl gap-4 py-6" aria-labelledby="cached-box-title">
        <div className="grid gap-3 rounded-card border border-danger/25 bg-danger/5 p-5 text-danger" role="alert">
          <div>
            <p className="mb-1 text-sm font-bold">箱子刷新失败，缓存内容仍可使用</p>
            <h1 className="m-0 text-section-title font-bold text-ink" id="cached-box-title">{query.data.name}</h1>
            <p className="mt-1 font-mono text-sm font-bold">{query.data.box_code}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="min-h-11 rounded-control border border-danger/30 bg-surface px-4 py-2 font-bold" type="button" disabled={query.isFetching} aria-busy={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? '重试中…' : '重试'}</button>
            <Link className="inline-flex min-h-11 items-center rounded-control border border-line bg-surface px-4 py-2 font-bold text-ink no-underline" to={`/b/${query.data.public_id}`}>继续打开箱子</Link>
          </div>
        </div>
      </section>
    )
  }
  return <Navigate replace to={`/b/${query.data.public_id}`} />
}

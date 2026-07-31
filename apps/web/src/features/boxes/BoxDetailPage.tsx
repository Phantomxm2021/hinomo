import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
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
  return <Navigate replace to={`/b/${query.data.public_id}`} />
}

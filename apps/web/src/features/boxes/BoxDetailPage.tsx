import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
import { PageState } from '../../components/PageState'
import { getBox } from './boxes.api'

export function BoxDetailPage() {
  const { boxId = '' } = useParams<{ boxId: string }>()
  const query = useQuery({ queryKey: ['box-id', boxId], queryFn: () => getBox(boxId) })
  if (query.isPending) return <PageState state="loading" label="正在加载箱子…" />
  if (query.isError || !query.data) return <PageState state="error" message="无权限或内容不存在" onRetry={() => void query.refetch()} />
  return <Navigate replace to={`/b/${query.data.public_id}`} />
}

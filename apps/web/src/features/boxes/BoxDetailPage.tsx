import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
import { getBox } from './boxes.api'

export function BoxDetailPage() {
  const { boxId = '' } = useParams<{ boxId: string }>()
  const query = useQuery({ queryKey: ['box-id', boxId], queryFn: () => getBox(boxId) })
  if (query.isPending) return <p role="status">正在加载箱子…</p>
  if (query.isError || !query.data) return <h1>无权限或内容不存在</h1>
  return <Navigate replace to={`/b/${query.data.public_id}`} />
}

import { Navigate, useParams } from 'react-router-dom'

export function BoxFormPage() {
  const { boxId = '' } = useParams<{ boxId: string }>()
  return <Navigate replace to={`/app/boxes?edit=${encodeURIComponent(boxId)}`} />
}

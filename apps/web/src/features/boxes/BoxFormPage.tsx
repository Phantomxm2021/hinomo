import { useParams } from 'react-router-dom'
import { BoxForm } from './BoxForm'

export function BoxFormPage() {
  const { boxId } = useParams<{ boxId: string }>()
  return <BoxForm boxId={boxId} presentation="page" />
}

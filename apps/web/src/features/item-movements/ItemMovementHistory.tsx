import type { ItemMovementHistory as ItemMovementHistoryRecord } from './item-movements.api'

const actionLabels = {
  take_out: '取出',
  return: '放回',
  move: '移动',
} as const

function movementPath(movement: ItemMovementHistoryRecord) {
  const from = movement.from_box?.name ?? '已删除箱子'
  const to = movement.to_box?.name ?? '已删除箱子'
  if (movement.action === 'take_out') return `从 ${from} 取出`
  if (movement.action === 'return') return `放回 ${to}`
  return `${from} → ${to}`
}

export function ItemMovementHistory({ movements, loading }: {
  movements: ItemMovementHistoryRecord[]
  loading: boolean
}) {
  if (loading) return <p className="py-8 text-center text-sm text-muted" role="status">正在读取流转记录…</p>
  if (movements.length === 0) return <p className="py-8 text-center text-sm text-muted">还没有流转记录</p>

  return (
    <ol className="max-h-[min(28rem,55dvh)] overflow-y-auto rounded-control bg-canvas px-4" aria-label="物品流转记录">
      {movements.map((movement) => (
        <li className="relative grid gap-1 border-b border-line/70 py-4 pl-5 last:border-b-0" key={movement.id}>
          <span className="absolute top-[1.35rem] left-0 size-2 rounded-full bg-brand" aria-hidden="true" />
          <div className="flex items-baseline justify-between gap-3">
            <strong className="text-ink">{actionLabels[movement.action]} {movement.quantity} 件</strong>
            <time className="shrink-0 text-xs text-muted" dateTime={movement.created_at}>
              {new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(movement.created_at))}
            </time>
          </div>
          <p className="text-sm text-muted">{movementPath(movement)}</p>
          {movement.handler_label ? <p className="text-sm text-ink">经手人或用途：{movement.handler_label}</p> : null}
          {movement.note ? <p className="text-sm text-muted">备注：{movement.note}</p> : null}
        </li>
      ))}
    </ol>
  )
}

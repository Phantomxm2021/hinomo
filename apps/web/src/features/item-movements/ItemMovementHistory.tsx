import { useI18n } from '../../i18n/I18nProvider'
import type { ItemMovementHistory as ItemMovementHistoryRecord } from './item-movements.api'

export function ItemMovementHistory({ movements, loading }: {
  movements: ItemMovementHistoryRecord[]
  loading: boolean
}) {
  const { locale, t } = useI18n()
  if (loading) return <p className="py-8 text-center text-sm text-muted" role="status">{t('itemMovement.historyLoading')}</p>
  if (movements.length === 0) return <p className="py-8 text-center text-sm text-muted">{t('itemMovement.historyEmpty')}</p>

  return (
    <ol className="max-h-[min(28rem,55dvh)] overflow-y-auto rounded-control bg-canvas px-4" aria-label={t('itemMovement.historyAria')}>
      {movements.map((movement) => (
        <li className="relative grid gap-1 border-b border-line/70 py-4 pl-5 last:border-b-0" key={movement.id}>
          <span className="absolute top-[1.35rem] left-0 size-2 rounded-full bg-brand" aria-hidden="true" />
          <div className="flex items-baseline justify-between gap-3">
            <strong className="text-ink">{t(`itemMovement.action${movement.action === 'take_out' ? 'TakeOut' : movement.action === 'return' ? 'Return' : 'Move'}`)} {movement.quantity} {t('itemMovement.quantityUnit')}</strong>
            <time className="shrink-0 text-xs text-muted" dateTime={movement.created_at}>
              {new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(movement.created_at))}
            </time>
          </div>
          <p className="text-sm text-muted">{movement.action === 'take_out'
            ? t('itemMovement.pathTakeOut', { box: movement.from_box?.name ?? t('itemMovement.deletedBox') })
            : movement.action === 'return'
              ? t('itemMovement.pathReturn', { box: movement.to_box?.name ?? t('itemMovement.deletedBox') })
              : t('itemMovement.pathMove', {
                from: movement.from_box?.name ?? t('itemMovement.deletedBox'),
                to: movement.to_box?.name ?? t('itemMovement.deletedBox'),
              })}</p>
          {movement.handler_label ? <p className="text-sm text-ink">{t('itemMovement.handlerNote', { value: movement.handler_label })}</p> : null}
          {movement.note ? <p className="text-sm text-muted">{t('itemMovement.movementNote', { value: movement.note })}</p> : null}
        </li>
      ))}
    </ol>
  )
}

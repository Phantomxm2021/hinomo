import { useEffect, useMemo, useRef, useState } from 'react'
import { Skeleton } from '../../components/Skeleton'
import { useI18n } from '../../i18n/I18nProvider'
import { publicAppOrigin } from '../../lib/env'
import type { BoxSummary } from '../boxes/boxes.api'
import { paginatePrintBoxes } from './print-model'
import { PRINT_LABEL_COLORS, PRINT_SHEET_MM, labelPlacementPercent } from './print-label-layout'
import { boxQrPng, boxQrUrl } from './qr'

type Props = {
  boxes: readonly BoxSummary[]
  mode: 'a4' | 'single'
}

type QrState =
  | { status: 'loading' }
  | { status: 'ready'; image: string }
  | { status: 'error' }

function qrIdentity(box: BoxSummary): string {
  return JSON.stringify([box.id, box.public_id])
}

function PrintLabel({ box, density, qr, placement }: {
  box: BoxSummary
  density: 'compact' | 'comfortable'
  qr: QrState
  placement?: ReturnType<typeof labelPlacementPercent>
}) {
  const { t } = useI18n()
  const location = box.location || t('print.locationUnset')
  const compact = density === 'compact'

  return (
    <article
      className={`${placement ? 'absolute ' : ''}${compact
        ? 'min-w-0 overflow-hidden border p-1.5 xl:p-3'
        : 'min-w-0 overflow-hidden border border-line bg-surface p-3'}`}
      style={{
        ...placement,
        backgroundColor: PRINT_LABEL_COLORS.surface,
        borderColor: PRINT_LABEL_COLORS.line,
      }}
      role="group"
      aria-label={`${box.name}${t('print.labelSuffix')}`}
    >
      <div className={compact
        ? 'grid min-w-0 grid-cols-[minmax(2.75rem,0.65fr)_minmax(0,1.35fr)] items-center gap-1.5 xl:grid-cols-[minmax(4.5rem,0.8fr)_minmax(0,1.2fr)] xl:gap-3'
        : 'grid min-w-0 grid-cols-[minmax(4.5rem,0.8fr)_minmax(0,1.2fr)] items-center gap-3'}>
        <div className={compact
          ? 'grid aspect-square min-w-0 place-items-center overflow-hidden bg-canvas p-1 text-center text-[0.5rem] text-muted xl:p-2 xl:text-xs'
          : 'grid aspect-square min-w-0 place-items-center overflow-hidden bg-canvas p-2 text-center text-xs text-muted'}>
          {qr.status === 'ready' ? (
            <img className="size-full object-contain" src={qr.image} alt={t('print.qrAlt', { name: box.name })} />
          ) : qr.status === 'error' ? (
            <span>{t('print.qrPreviewError')}</span>
          ) : (
            <Skeleton className="aspect-square size-full rounded-none" />
          )}
        </div>
        <div className="min-w-0 overflow-hidden">
          <h3 className={compact
            ? 'truncate text-[0.625rem] leading-tight font-bold xl:text-base xl:leading-normal'
            : 'truncate text-base font-bold'} style={{ color: PRINT_LABEL_COLORS.ink }}>{box.name}</h3>
          <p className={compact
            ? 'mt-0.5 truncate text-[0.5625rem] leading-tight font-semibold tracking-wide xl:mt-1 xl:text-sm xl:leading-normal'
            : 'mt-1 truncate text-sm font-semibold tracking-wide'} style={{ color: PRINT_LABEL_COLORS.brand }}>{box.box_code}</p>
          <p className={compact
            ? 'mt-0.5 truncate text-[0.5rem] leading-tight xl:mt-1 xl:text-xs xl:leading-normal'
            : 'mt-1 truncate text-xs'} style={{ color: PRINT_LABEL_COLORS.ink }}>{t('print.spaceLabel', { space: box.space_name })}</p>
          <p className={compact
            ? 'truncate text-[0.5rem] leading-tight xl:mt-1 xl:text-xs xl:leading-normal'
            : 'mt-1 truncate text-xs'} style={{ color: PRINT_LABEL_COLORS.ink }}>{t('print.locationLabel', { location })}</p>
          <p className={compact
            ? 'truncate text-[0.4375rem] leading-tight font-semibold xl:mt-2 xl:text-xs'
            : 'mt-2 truncate text-xs font-semibold'} style={{ color: PRINT_LABEL_COLORS.muted }}>{t('print.scanToView')}</p>
        </div>
      </div>
    </article>
  )
}

export function PrintSheetPreview({ boxes, mode }: Props) {
  const { t } = useI18n()
  const qrCache = useRef(new Map<string, QrState>())
  const visibleIdentities = useRef(new Set<string>())
  const mounted = useRef(false)
  const [, setRevision] = useState(0)
  const visibleBoxes = useMemo(
    () => mode === 'single' ? boxes.slice(0, 1) : boxes,
    [boxes, mode],
  )
  const currentIdentities = useMemo(
    () => new Set(visibleBoxes.map(qrIdentity)),
    [visibleBoxes],
  )
  const loadingQrCount = visibleBoxes.filter((box) => (
    (qrCache.current.get(qrIdentity(box)) ?? { status: 'loading' }).status === 'loading'
  )).length
  const loadingLabel = t('print.qrGenerating', { count: loadingQrCount })
  const loadingStatus = loadingQrCount > 0 ? (
    <p className="sr-only" role="status" aria-label={loadingLabel} aria-live="polite">{loadingLabel}</p>
  ) : null

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      visibleIdentities.current = new Set()
    }
  }, [])

  useEffect(() => {
    visibleIdentities.current = currentIdentities
    for (const identity of qrCache.current.keys()) {
      if (!currentIdentities.has(identity)) qrCache.current.delete(identity)
    }

    for (const box of visibleBoxes) {
      const identity = qrIdentity(box)
      if (qrCache.current.has(identity)) continue

      const loading: QrState = { status: 'loading' }
      qrCache.current.set(identity, loading)
      const url = boxQrUrl(publicAppOrigin(), box.public_id)

      void boxQrPng(url)
        .then((image) => {
          if (!visibleIdentities.current.has(identity) || qrCache.current.get(identity) !== loading) return
          qrCache.current.set(identity, { status: 'ready', image })
          if (mounted.current) setRevision((revision) => revision + 1)
        })
        .catch(() => {
          if (!visibleIdentities.current.has(identity) || qrCache.current.get(identity) !== loading) return
          qrCache.current.set(identity, { status: 'error' })
          if (mounted.current) setRevision((revision) => revision + 1)
        })
    }
  }, [currentIdentities, visibleBoxes])

  if (mode === 'single') {
    const box = boxes[0]
    if (!box) return null

    return (
      <section className="min-w-0 overflow-hidden rounded-card border border-line bg-surface" aria-label={t('print.singlePreview')}>
        {loadingStatus}
        <header className="border-b border-line px-4 py-3">
          <h2 className="text-lg font-bold text-ink">{t('print.singlePreview')}</h2>
        </header>
        <div className="min-w-0 overflow-auto bg-canvas p-4">
          <PrintLabel box={box} density="comfortable" qr={qrCache.current.get(qrIdentity(box)) ?? { status: 'loading' }} />
        </div>
      </section>
    )
  }

  const pages = paginatePrintBoxes(boxes)

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface" aria-label={t('print.a4Preview')}>
      {loadingStatus}
      <header className="flex min-w-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="min-w-0 truncate text-lg font-bold text-ink">{t('print.a4Preview')}</h2>
        <p className="shrink-0 text-sm text-muted">{t('print.pageSummary', { pages: pages.length, labels: boxes.length })}</p>
      </header>
      <div className="max-h-[70dvh] min-h-0 overflow-auto bg-canvas p-3 sm:p-5">
        {pages.length === 0 ? (
          <div
            className="mx-auto grid w-full max-w-[42rem] place-items-center border border-line bg-surface p-6 text-center text-sm text-muted shadow-soft"
            data-testid="a4-sheet"
            style={{ aspectRatio: `${PRINT_SHEET_MM.width}/${PRINT_SHEET_MM.height}` }}
          >
            {t('print.emptyPreview')}
          </div>
        ) : (
          <div className="grid w-full gap-5">
            {pages.map((page, pageIndex) => (
              <div
                className="relative mx-auto w-full max-w-[42rem] overflow-hidden border border-line bg-surface shadow-soft"
                data-testid="a4-sheet"
                key={pageIndex}
                style={{ aspectRatio: `${PRINT_SHEET_MM.width}/${PRINT_SHEET_MM.height}` }}
              >
                {page.map((box, labelIndex) => (
                  <PrintLabel
                    box={box}
                    density="compact"
                    key={qrIdentity(box)}
                    placement={labelPlacementPercent(labelIndex)}
                    qr={qrCache.current.get(qrIdentity(box)) ?? { status: 'loading' }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

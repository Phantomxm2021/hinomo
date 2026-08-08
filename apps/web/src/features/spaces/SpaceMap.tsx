import {
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/I18nProvider'
import type { SpaceLayout, SpacePosition, SpaceSummary } from './spaces.api'
import { autoSpaceLayout, constrainResize } from './space-layout'
import { spaceEmoji, spaceTone } from './space-visuals'

type Positions = Record<string, SpacePosition>
type InteractionState = {
  kind: 'move' | 'resize'
  id: string
  startX: number
  startY: number
  position: SpacePosition
  canvasWidth: number
  canvasHeight: number
}

const snap = (value: number) => Math.round(value / 2) * 2
const clamp = (value: number, maximum: number) => Math.max(0, Math.min(maximum, snap(value)))

function buildPositions(spaces: SpaceSummary[], layouts: SpaceLayout[]): Positions {
  const persisted = new Map(layouts.map((layout) => [layout.space_id, layout]))
  return Object.fromEntries(spaces.map((space, index) => {
    const layout = persisted.get(space.id)
    return [space.id, layout
      ? { x: layout.x, y: layout.y, width: layout.width, height: layout.height }
      : autoSpaceLayout(index, spaces.length)]
  }))
}

export function SpaceMap({
  spaces,
  layouts,
  editMode,
  onLayoutChange,
}: {
  spaces: SpaceSummary[]
  layouts: SpaceLayout[]
  editMode: boolean
  onLayoutChange: (spaceId: string, position: SpacePosition) => void
}) {
  const { t } = useI18n()
  const [positions, setPositions] = useState<Positions>(() => buildPositions(spaces, layouts))
  const positionsRef = useRef(positions)
  const interactionRef = useRef<InteractionState | null>(null)

  useEffect(() => {
    const next = buildPositions(spaces, layouts)
    positionsRef.current = next
    setPositions(next)
  }, [spaces, layouts])

  function updateLocalPosition(id: string, position: SpacePosition) {
    const next = { ...positionsRef.current, [id]: position }
    positionsRef.current = next
    setPositions(next)
  }

  function commit(id: string, position: SpacePosition) {
    updateLocalPosition(id, position)
    onLayoutChange(id, position)
  }

  function moveWithKeyboard(id: string, key: string) {
    const position = positions[id]
    if (!position) return
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2],
    }
    const delta = deltas[key]
    if (!delta) return
    commit(id, {
      ...position,
      x: delta[0] === 0 ? position.x : clamp(position.x + delta[0], 100 - position.width),
      y: delta[1] === 0 ? position.y : clamp(position.y + delta[1], 100 - position.height),
    })
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>, id: string) {
    if (!editMode) return
    const position = positions[id]
    const canvas = event.currentTarget.parentElement
    if (!position || !canvas) return
    const canvasRect = canvas.getBoundingClientRect()
    const cardRect = event.currentTarget.getBoundingClientRect()
    const isResizeCorner = cardRect.width > 44
      && cardRect.height > 44
      && event.clientX >= cardRect.right - 44
      && event.clientY >= cardRect.bottom - 44
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    interactionRef.current = {
      kind: isResizeCorner ? 'resize' : 'move',
      id,
      startX: event.clientX,
      startY: event.clientY,
      position,
      canvasWidth: canvasRect.width,
      canvasHeight: canvasRect.height,
    }
  }

  function continueDrag(event: ReactPointerEvent<HTMLDivElement>, id: string) {
    const interaction = interactionRef.current
    if (!interaction || interaction.id !== id || interaction.canvasWidth <= 0 || interaction.canvasHeight <= 0) return
    const next = interaction.kind === 'move'
      ? {
          ...interaction.position,
          x: clamp(interaction.position.x + ((event.clientX - interaction.startX) / interaction.canvasWidth) * 100, 100 - interaction.position.width),
          y: clamp(interaction.position.y + ((event.clientY - interaction.startY) / interaction.canvasHeight) * 100, 100 - interaction.position.height),
        }
      : constrainResize(
          interaction.position,
          ((event.clientX - interaction.startX) / interaction.canvasWidth) * 100,
          ((event.clientY - interaction.startY) / interaction.canvasHeight) * 100,
        )
    updateLocalPosition(id, next)
  }

  function finishInteraction(id: string) {
    const interaction = interactionRef.current
    if (!interaction || interaction.id !== id) return
    const position = positionsRef.current[id]
    interactionRef.current = null
    if (position) onLayoutChange(id, position)
  }

  function cancelInteraction(id: string) {
    const interaction = interactionRef.current
    if (!interaction || interaction.id !== id) return
    updateLocalPosition(id, interaction.position)
    interactionRef.current = null
  }

  const minimumHeight = Math.max(544, Math.ceil(spaces.length / 2) * 144 + 64)
  return (
    <section className="relative overflow-hidden rounded-shell border border-line bg-surface shadow-soft" style={{ minHeight: `${minimumHeight}px` }} role="region" aria-label={t('spaces.planOverview')}>
      <div className="pointer-events-none absolute inset-0 opacity-55" style={{ backgroundImage: 'linear-gradient(#e3d5c5 1px, transparent 1px), linear-gradient(90deg, #e3d5c5 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      {spaces.map((space, index) => {
        const position = positions[space.id] ?? autoSpaceLayout(index, spaces.length)
        return (
          <div
            key={space.id}
            className={`absolute rounded-card border border-line text-ink shadow-soft ${spaceTone(index)} ${editMode ? 'touch-none cursor-move ring-2 ring-brand/20' : 'hover:-translate-y-0.5'}`}
            style={{ left: `${position.x}%`, top: `${position.y}%`, width: `${position.width}%`, height: `${position.height}%` }}
            role={editMode ? 'button' : undefined}
            aria-label={editMode ? t('spaces.adjustRoom', { name: space.name }) : undefined}
            tabIndex={editMode ? 0 : undefined}
            onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
              if (editMode && event.key.startsWith('Arrow')) {
                event.preventDefault()
                moveWithKeyboard(space.id, event.key)
              }
            }}
            onPointerDown={(event) => beginDrag(event, space.id)}
            onPointerMove={(event) => continueDrag(event, space.id)}
            onPointerUp={() => finishInteraction(space.id)}
            onPointerCancel={() => cancelInteraction(space.id)}
          >
            <Link
              draggable={false}
              tabIndex={editMode ? -1 : undefined}
              className={`flex size-full flex-col justify-between overflow-hidden rounded-[inherit] p-3 text-inherit no-underline focus:outline-none focus:ring-2 focus:ring-brand sm:p-4 ${editMode ? 'pointer-events-none' : 'touch-pan-y'}`}
              to={`/app/boxes?space=${encodeURIComponent(space.id)}`}
              onDragStart={(event: ReactDragEvent<HTMLAnchorElement>) => event.preventDefault()}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-3xl leading-none" role="img" aria-label={t('spaces.iconAlt', { name: space.name })}>{spaceEmoji(space.name)}</span>
                <span className="text-meta font-bold">{t('spaces.boxUnit', { count: space.box_count })}</span>
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-card-title">{space.name}</strong>
                <small className="text-meta text-muted">{t('spaces.itemCount', { count: space.item_count })}</small>
              </span>
            </Link>
          </div>
        )
      })}
    </section>
  )
}

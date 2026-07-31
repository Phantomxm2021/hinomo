import {
  useEffect,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Link } from 'react-router-dom'
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
  const [positions, setPositions] = useState<Positions>(() => buildPositions(spaces, layouts))
  const [interaction, setInteraction] = useState<InteractionState | null>(null)

  useEffect(() => setPositions(buildPositions(spaces, layouts)), [spaces, layouts])

  function commit(id: string, position: SpacePosition) {
    setPositions((current) => ({ ...current, [id]: position }))
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

  function resizeWithKeyboard(id: string, key: string) {
    const position = positions[id]
    if (!position) return
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2],
    }
    const delta = deltas[key]
    if (!delta) return
    commit(id, constrainResize(position, delta[0], delta[1]))
  }

  function beginDrag(event: ReactPointerEvent<HTMLAnchorElement>, id: string) {
    if (!editMode) return
    const position = positions[id]
    const canvas = event.currentTarget.parentElement?.parentElement
    if (!position || !canvas) return
    const rect = canvas.getBoundingClientRect()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setInteraction({ kind: 'move', id, startX: event.clientX, startY: event.clientY, position, canvasWidth: rect.width, canvasHeight: rect.height })
  }

  function continueDrag(event: ReactPointerEvent<HTMLAnchorElement>, id: string) {
    if (!interaction || interaction.kind !== 'move' || interaction.id !== id || interaction.canvasWidth <= 0 || interaction.canvasHeight <= 0) return
    const next = {
      ...interaction.position,
      x: clamp(interaction.position.x + ((event.clientX - interaction.startX) / interaction.canvasWidth) * 100, 100 - interaction.position.width),
      y: clamp(interaction.position.y + ((event.clientY - interaction.startY) / interaction.canvasHeight) * 100, 100 - interaction.position.height),
    }
    setPositions((current) => ({ ...current, [id]: next }))
  }

  function finishInteraction(id: string) {
    if (!interaction || interaction.id !== id) return
    const position = positions[id]
    setInteraction(null)
    if (position) onLayoutChange(id, position)
  }

  function cancelInteraction(id: string) {
    if (!interaction || interaction.id !== id) return
    setPositions((current) => ({ ...current, [id]: interaction.position }))
    setInteraction(null)
  }

  function beginResize(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    const position = positions[id]
    const canvas = event.currentTarget.parentElement?.parentElement
    if (!position || !canvas) return
    const rect = canvas.getBoundingClientRect()
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setInteraction({ kind: 'resize', id, startX: event.clientX, startY: event.clientY, position, canvasWidth: rect.width, canvasHeight: rect.height })
  }

  function continueResize(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (!interaction || interaction.kind !== 'resize' || interaction.id !== id || interaction.canvasWidth <= 0 || interaction.canvasHeight <= 0) return
    const next = constrainResize(
      interaction.position,
      ((event.clientX - interaction.startX) / interaction.canvasWidth) * 100,
      ((event.clientY - interaction.startY) / interaction.canvasHeight) * 100,
    )
    setPositions((current) => ({ ...current, [id]: next }))
  }

  const minimumHeight = Math.max(544, Math.ceil(spaces.length / 2) * 144 + 64)

  return (
    <section className="relative overflow-hidden rounded-shell border border-line bg-surface shadow-soft" style={{ minHeight: `${minimumHeight}px` }} role="region" aria-label="空间平面总览">
      <div className="pointer-events-none absolute inset-0 opacity-55" style={{ backgroundImage: 'linear-gradient(#e3d5c5 1px, transparent 1px), linear-gradient(90deg, #e3d5c5 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      {spaces.map((space, index) => {
        const position = positions[space.id] ?? autoSpaceLayout(index, spaces.length)
        return (
          <div
            key={space.id}
            className={`absolute rounded-card border border-line text-ink shadow-soft ${spaceTone(index)} ${editMode ? 'ring-2 ring-brand/20' : 'hover:-translate-y-0.5'}`}
            style={{ left: `${position.x}%`, top: `${position.y}%`, width: `${position.width}%`, height: `${position.height}%` }}
          >
            <Link
              draggable={false}
              className={`flex size-full flex-col justify-between overflow-hidden rounded-[inherit] p-3 text-inherit no-underline focus:outline-none focus:ring-2 focus:ring-brand sm:p-4 ${editMode ? 'touch-none cursor-move' : 'touch-pan-y'}`}
              to={`/app/boxes?space=${encodeURIComponent(space.id)}`}
              onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => { if (editMode) event.preventDefault() }}
              onKeyDown={(event: ReactKeyboardEvent<HTMLAnchorElement>) => {
                if (editMode && event.key.startsWith('Arrow')) {
                  event.preventDefault()
                  moveWithKeyboard(space.id, event.key)
                }
              }}
              onPointerDown={(event: ReactPointerEvent<HTMLAnchorElement>) => beginDrag(event, space.id)}
              onPointerMove={(event: ReactPointerEvent<HTMLAnchorElement>) => continueDrag(event, space.id)}
              onPointerUp={() => finishInteraction(space.id)}
              onPointerCancel={() => cancelInteraction(space.id)}
              onDragStart={(event: ReactDragEvent<HTMLAnchorElement>) => event.preventDefault()}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-3xl leading-none" role="img" aria-label={`${space.name}图标`}>{spaceEmoji(space.name)}</span>
                <span className="text-meta font-bold">{space.box_count} 箱</span>
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-card-title">{space.name}</strong>
                <small className="text-meta text-muted">{space.item_count} 件物品</small>
              </span>
            </Link>
            {editMode ? (
              <button
                className="absolute bottom-1.5 right-1.5 z-10 grid size-9 touch-none cursor-nwse-resize place-items-center rounded-control border border-brand/40 bg-surface/90 text-brand shadow-soft"
                type="button"
                aria-label={`调整${space.name}大小`}
                title="拖动或使用方向键调整大小"
                onKeyDown={(event) => {
                  if (event.key.startsWith('Arrow')) {
                    event.preventDefault()
                    resizeWithKeyboard(space.id, event.key)
                  }
                }}
                onPointerDown={(event) => beginResize(event, space.id)}
                onPointerMove={(event) => continueResize(event, space.id)}
                onPointerUp={() => finishInteraction(space.id)}
                onPointerCancel={() => cancelInteraction(space.id)}
              >
                <span aria-hidden="true" className="text-lg leading-none">↘</span>
              </button>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}

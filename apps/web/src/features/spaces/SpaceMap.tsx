import {
  useEffect,
  useRef,
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
  kind: 'move'
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
  const positionsRef = useRef(positions)
  const [interaction, setInteraction] = useState<InteractionState | null>(null)
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(() => spaces[0]?.id ?? null)

  useEffect(() => {
    const next = buildPositions(spaces, layouts)
    positionsRef.current = next
    setPositions(next)
  }, [spaces, layouts])

  useEffect(() => {
    if (selectedSpaceId && spaces.some((space) => space.id === selectedSpaceId)) return
    setSelectedSpaceId(spaces[0]?.id ?? null)
  }, [selectedSpaceId, spaces])

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
    const rect = canvas.getBoundingClientRect()
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setSelectedSpaceId(id)
    setInteraction({ kind: 'move', id, startX: event.clientX, startY: event.clientY, position, canvasWidth: rect.width, canvasHeight: rect.height })
  }

  function continueDrag(event: ReactPointerEvent<HTMLDivElement>, id: string) {
    if (!interaction || interaction.kind !== 'move' || interaction.id !== id || interaction.canvasWidth <= 0 || interaction.canvasHeight <= 0) return
    const next = {
      ...interaction.position,
      x: clamp(interaction.position.x + ((event.clientX - interaction.startX) / interaction.canvasWidth) * 100, 100 - interaction.position.width),
      y: clamp(interaction.position.y + ((event.clientY - interaction.startY) / interaction.canvasHeight) * 100, 100 - interaction.position.height),
    }
    updateLocalPosition(id, next)
  }

  function finishInteraction(id: string) {
    if (!interaction || interaction.id !== id) return
    const position = positionsRef.current[id]
    setInteraction(null)
    if (position) onLayoutChange(id, position)
  }

  function cancelInteraction(id: string) {
    if (!interaction || interaction.id !== id) return
    updateLocalPosition(id, interaction.position)
    setInteraction(null)
  }

  const minimumHeight = Math.max(544, Math.ceil(spaces.length / 2) * 144 + 64)
  const selectedSpace = spaces.find((space) => space.id === selectedSpaceId) ?? spaces[0]
  const selectedPosition = selectedSpace ? positions[selectedSpace.id] : undefined

  return (
    <>
    <section className="relative overflow-hidden rounded-shell border border-line bg-surface shadow-soft" style={{ minHeight: `${minimumHeight}px` }} role="region" aria-label="空间平面总览">
      <div className="pointer-events-none absolute inset-0 opacity-55" style={{ backgroundImage: 'linear-gradient(#e3d5c5 1px, transparent 1px), linear-gradient(90deg, #e3d5c5 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      {spaces.map((space, index) => {
        const position = positions[space.id] ?? autoSpaceLayout(index, spaces.length)
        return (
          <div
            key={space.id}
            className={`absolute rounded-card border border-line text-ink shadow-soft ${spaceTone(index)} ${editMode ? 'touch-none cursor-move ring-2 ring-brand/20' : 'hover:-translate-y-0.5'}`}
            style={{ left: `${position.x}%`, top: `${position.y}%`, width: `${position.width}%`, height: `${position.height}%` }}
            role={editMode ? 'button' : undefined}
            aria-label={editMode ? `调整${space.name}位置` : undefined}
            tabIndex={editMode ? 0 : undefined}
            onClick={() => { if (editMode) setSelectedSpaceId(space.id) }}
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
              onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => {
                if (!editMode) return
                event.preventDefault()
              }}
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
          </div>
        )
      })}
    </section>
    {editMode && selectedSpace && selectedPosition ? (
      <section className="mt-3 grid gap-4 rounded-card bg-surface p-4 shadow-soft lg:grid-cols-2" role="region" aria-label={`调整${selectedSpace.name}尺寸`}>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span className="flex items-center justify-between"><span>宽度</span><output>{selectedPosition.width}%</output></span>
          <input
            className="h-11 w-full accent-brand"
            type="range"
            min="8"
            max={100 - selectedPosition.x}
            step="1"
            value={selectedPosition.width}
            aria-label={`${selectedSpace.name}宽度`}
            onChange={(event) => commit(selectedSpace.id, constrainResize(selectedPosition, Number(event.target.value) - selectedPosition.width, 0))}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span className="flex items-center justify-between"><span>长度</span><output>{selectedPosition.height}%</output></span>
          <input
            className="h-11 w-full accent-brand"
            type="range"
            min="8"
            max={100 - selectedPosition.y}
            step="1"
            value={selectedPosition.height}
            aria-label={`${selectedSpace.name}长度`}
            onChange={(event) => commit(selectedSpace.id, constrainResize(selectedPosition, 0, Number(event.target.value) - selectedPosition.height))}
          />
        </label>
      </section>
    ) : null}
    </>
  )
}

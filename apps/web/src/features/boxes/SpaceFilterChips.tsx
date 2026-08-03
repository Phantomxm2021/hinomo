type Space = {
  id: string
  name: string
  count: number
}

type SpaceFilterChipsProps = {
  spaces: ReadonlyArray<Space>
  selectedSpace: string
  totalCount: number
  onChange: (spaceId: string) => void
}

const chipClassName = (selected: boolean) => `min-h-11 shrink-0 rounded-full border px-4 py-2 font-bold transition ${selected
  ? 'border-ink bg-ink text-white'
  : 'border-line bg-surface text-muted hover:border-ink/35 hover:text-ink'
}`

export function SpaceFilterChips({ spaces, selectedSpace, totalCount, onChange }: SpaceFilterChipsProps) {
  return (
    <div className="space-filter-scroll flex flex-nowrap gap-2 overflow-x-auto pb-1" role="group" aria-label="按空间筛选">
      <button
        className={chipClassName(selectedSpace === '')}
        type="button"
        aria-pressed={selectedSpace === ''}
        onClick={() => onChange('')}
      >
        全部空间 {totalCount}
      </button>
      {spaces.map((space) => (
        <button
          className={chipClassName(selectedSpace === space.id)}
          type="button"
          aria-pressed={selectedSpace === space.id}
          onClick={() => onChange(space.id)}
          key={space.id}
        >
          {space.name} {space.count}
        </button>
      ))}
    </div>
  )
}

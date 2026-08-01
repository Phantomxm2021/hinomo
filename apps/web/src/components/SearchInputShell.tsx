import { useRef, type InputHTMLAttributes } from 'react'
import { AppIcon } from './AppIcon'

type SearchInputShellProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'> & {
  onClear?: () => void
}

export function SearchInputShell({ onClear, value, ...props }: SearchInputShellProps) {
  const inputElementRef = useRef<HTMLInputElement | null>(null)
  const hasValue = typeof value === 'string' && value.length > 0

  return (
    <div
      className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 overflow-hidden rounded-control border border-line bg-surface pl-3 pr-1.5 text-muted focus-within:border-brand sm:pl-4"
      data-testid="search-input-shell"
    >
      <AppIcon name="search" size={20} />
      <input
        {...props}
        ref={inputElementRef}
        className="h-11 min-w-0 flex-1 appearance-none border-0 bg-transparent text-body font-normal text-ink placeholder:text-muted focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
        type="search"
        value={value}
      />
      {onClear && hasValue ? (
        <button
          className="grid size-9 shrink-0 place-items-center self-center rounded-full text-muted active:bg-placeholder/70 active:text-ink"
          type="button"
          aria-label="清除搜索"
          onClick={() => {
            onClear()
            inputElementRef.current?.focus()
          }}
        >
          <AppIcon name="close" size={18} />
        </button>
      ) : null}
    </div>
  )
}

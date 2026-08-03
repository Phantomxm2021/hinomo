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
      className="relative min-h-12 min-w-0 flex-1 overflow-hidden rounded-control border border-line bg-surface text-muted focus-within:border-brand"
      data-testid="search-input-shell"
    >
      <AppIcon className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 sm:left-4" name="search" size={20} />
      <input
        {...props}
        ref={inputElementRef}
        className="block h-11 w-full min-w-0 appearance-none border-0 bg-transparent pr-11 pl-10 text-body font-normal text-ink placeholder:text-muted focus-visible:outline-none sm:pl-12 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
        type="search"
        value={value}
      />
      {onClear && hasValue ? (
        <button
          className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted active:bg-placeholder/70 active:text-ink"
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

import type { InputHTMLAttributes } from 'react'
import { AppIcon } from './AppIcon'

type SearchInputShellProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'>

export function SearchInputShell(props: SearchInputShellProps) {
  return (
    <div
      className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 overflow-hidden rounded-control border border-line bg-surface pl-3 text-muted focus-within:border-brand sm:pl-4"
      data-testid="search-input-shell"
    >
      <AppIcon name="search" size={20} />
      <input
        {...props}
        className="h-11 min-w-0 flex-1 border-0 bg-transparent text-body font-normal text-ink placeholder:text-muted focus-visible:outline-none"
        type="search"
      />
    </div>
  )
}

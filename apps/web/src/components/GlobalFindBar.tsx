import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppIcon } from './AppIcon'
import { SearchInputShell } from './SearchInputShell'

export function GlobalFindBar() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return
    navigate(`/app/search?q=${encodeURIComponent(trimmedQuery)}`)
  }

  return (
    <form className="flex w-full max-w-3xl items-stretch gap-2.5" role="search" onSubmit={handleSubmit}>
      <SearchInputShell
        name="q"
        enterKeyHint="search"
        autoComplete="off"
        aria-label="搜索物品或箱子"
        placeholder="搜索物品或箱子"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <button className="grid size-12 shrink-0 place-items-center rounded-control bg-brand text-white shadow-soft transition hover:bg-brand-strong focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand/45 lg:hidden" type="submit" aria-label="搜索">
        <AppIcon name="search" size={20} />
      </button>
      <Link className="scan-icon-button hidden size-[46px] shrink-0 items-center justify-center rounded-control bg-brand text-white no-underline shadow-soft transition hover:bg-brand-strong focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand/45 lg:inline-flex" to="/app/scan" aria-label="扫码查看" title="扫码查看">
        <AppIcon name="scan" size={22} />
      </Link>
    </form>
  )
}

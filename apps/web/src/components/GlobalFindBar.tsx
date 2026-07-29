import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppIcon } from './AppIcon'

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
      <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 overflow-hidden rounded-control border border-line bg-surface pl-3 text-muted focus-within:border-brand sm:pl-4">
        <AppIcon name="search" size={20} />
        <input
          className="h-11 min-w-0 flex-1 border-0 bg-transparent text-ink placeholder:text-muted focus-visible:-outline-offset-4 focus-visible:outline-3 focus-visible:outline-brand/45"
          type="search"
          aria-label="搜索物品或箱子"
          placeholder="搜索物品或箱子"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="min-h-12 border-0 bg-brand px-3.5 font-bold text-white hover:bg-brand-strong sm:px-5" type="submit">搜索</button>
      </div>
      <Link className="scan-icon-button hidden h-[46px] w-[46px] flex-none items-center justify-center rounded-control bg-brand text-white no-underline hover:bg-brand-strong lg:inline-flex" to="/app/scan" aria-label="扫码查看" title="扫码查看">
        <AppIcon name="scan" size={22} />
      </Link>
    </form>
  )
}

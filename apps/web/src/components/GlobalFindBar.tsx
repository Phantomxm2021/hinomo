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
    <form className="global-find-bar" role="search" onSubmit={handleSubmit}>
      <div className="global-find-field">
        <AppIcon name="search" size={20} />
        <input
          className="global-find-input"
          type="search"
          aria-label="搜索物品或箱子"
          placeholder="搜索物品或箱子"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit">搜索</button>
      </div>
      <Link className="scan-icon-button" to="/app/scan" aria-label="扫码查看" title="扫码查看">
        <AppIcon name="scan" size={22} />
      </Link>
    </form>
  )
}

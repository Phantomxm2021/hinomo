import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import { AppIcon } from './AppIcon'
import { SearchInputShell } from './SearchInputShell'

export function GlobalFindBar() {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return
    navigate(`/app/search?q=${encodeURIComponent(trimmedQuery)}`)
  }

  return (
    <form className="flex w-full max-w-3xl items-stretch gap-2.5" role="search" aria-label={t('search.globalPlaceholder')} onSubmit={handleSubmit}>
      <SearchInputShell
        name="q"
        enterKeyHint="search"
        autoComplete="off"
        aria-label={t('search.globalPlaceholder')}
        placeholder={t('search.globalPlaceholder')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onClear={() => setQuery('')}
      />
      <button className="grid size-12 shrink-0 place-items-center rounded-control bg-brand text-white shadow-soft transition hover:bg-brand-strong focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand/45 lg:hidden" type="submit" aria-label={t('search.globalSubmit')}>
        <AppIcon name="search" size={20} />
      </button>
      <Link className="scan-icon-button hidden size-[46px] shrink-0 items-center justify-center rounded-control bg-brand text-white no-underline shadow-soft transition hover:bg-brand-strong focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand/45 lg:inline-flex" to="/app/scan" aria-label={t('search.scan')} title={t('search.scan')}>
        <AppIcon name="scan" size={22} />
      </Link>
    </form>
  )
}

import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { SearchInputShell } from '../../components/SearchInputShell'
import { useI18n } from '../../i18n/I18nProvider'
import { formatStoragePath } from '../../lib/format-storage-path'
import { listBoxes } from '../boxes/boxes.api'
import { deriveItemAvailability, formatItemAvailability } from '../item-movements/item-movement-status'
import { searchItems } from './search.api'

function searchQuantityLabel(result: { quantity: number | null; quantity_kind: string }, t: ReturnType<typeof useI18n>['t']): string {
  if (result.quantity === null || result.quantity_kind === 'unknown') return t('search.unknownQuantity')
  if (result.quantity_kind === 'at_least') return t('search.atLeast', { count: result.quantity })
  if (result.quantity_kind === 'approximate') return t('search.approximate', { count: result.quantity })
  return String(result.quantity)
}

export function SearchPage() {
  const { locale, t } = useI18n()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const [input, setInput] = useState(urlQuery)
  const [query, setQuery] = useState(urlQuery.trim())
  const [isComposing, setIsComposing] = useState(false)
  const inputRef = useRef(urlQuery)

  useEffect(() => {
    if (urlQuery === inputRef.current) return
    inputRef.current = urlQuery
    setInput(urlQuery)
    setQuery(urlQuery.trim())
  }, [urlQuery])

  useEffect(() => {
    if (isComposing) return
    const trimmed = input.trim()
    if (!trimmed) {
      setQuery('')
      if (urlQuery) setSearchParams({}, { replace: true })
      return
    }
    const timer = window.setTimeout(() => {
      inputRef.current = trimmed
      if (input !== trimmed) setInput(trimmed)
      setQuery(trimmed)
      if (urlQuery !== trimmed) setSearchParams({ q: trimmed }, { replace: true })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [input, isComposing, setSearchParams, urlQuery])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isComposing) return
    const trimmed = input.trim()
    if (!trimmed) {
      setQuery('')
      if (urlQuery) setSearchParams({}, { replace: true })
      return
    }
    inputRef.current = trimmed
    if (input !== trimmed) setInput(trimmed)
    setQuery(trimmed)
    if (urlQuery !== trimmed) setSearchParams({ q: trimmed }, { replace: true })
  }

  const boxesQuery = useQuery({ queryKey: ['boxes'], queryFn: listBoxes })
  const resultsQuery = useQuery({
    queryKey: ['search-items', query],
    queryFn: () => searchItems(query),
    enabled: query.length > 0,
  })
  const matchingBoxes = useMemo(() => {
    if (!query) return []
    const needle = query.toLocaleLowerCase()
    return (boxesQuery.data ?? []).filter((box) => (
      [box.name, box.box_code, box.venue_name, box.space_name, box.location]
        .some((value) => value?.toLocaleLowerCase().includes(needle))
    ))
  }, [boxesQuery.data, query])
  const items = resultsQuery.data ?? []
  const isLoading = Boolean(query) && (
    (resultsQuery.isPending && resultsQuery.data === undefined)
    || (boxesQuery.isPending && boxesQuery.data === undefined)
  )
  const boxesInitialError = boxesQuery.isError && boxesQuery.data === undefined
  const itemsInitialError = resultsQuery.isError && resultsQuery.data === undefined
  const bothInitialError = boxesInitialError && itemsInitialError
  const noResults = query && !isLoading && !boxesQuery.isError && !resultsQuery.isError
    && matchingBoxes.length === 0 && items.length === 0

  return (
    <section className="mx-auto flex min-w-0 w-full max-w-5xl flex-col gap-5 lg:gap-8" aria-labelledby="search-title">
      <nav className="sticky top-0 z-20 -mx-4 -mt-[max(1rem,var(--safe-area-top))] grid min-h-14 grid-cols-[6rem_minmax(0,1fr)_6rem] items-end border-b border-line/70 bg-canvas/90 px-4 pt-[max(0.5rem,var(--safe-area-top))] pb-2 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5 lg:hidden" aria-label={t('search.nav')}>
        <div className="flex justify-start">
          <button className="inline-flex size-11 items-center justify-center rounded-full text-ink active:bg-placeholder/70 active:opacity-70" type="button" aria-label={t('search.back')} onClick={() => navigate(-1)}>
            <AppIcon className="rotate-180" name="chevron-right" size={22} />
          </button>
        </div>
        <span className="truncate pb-2 text-center text-[1.0625rem] leading-none font-bold text-ink">{t('search.mobileTitle')}</span>
        <div aria-hidden="true" />
      </nav>
      <header className="hidden flex-col gap-2 py-3 lg:flex">
        <p className="mb-1 hidden text-meta font-medium tracking-eyebrow text-muted lg:block">{t('search.eyebrow')}</p>
        <h1 className="mb-0 text-page-title font-extrabold" id="search-title">{t('search.title')}</h1>
      </header>

      <form className="flex w-full items-stretch gap-2.5" role="search" aria-label={t('search.mobileTitle')} onSubmit={submitSearch}>
        <div className="flex min-w-0 flex-1">
          <label className="sr-only" htmlFor="global-search">{t('search.keyword')}</label>
          <SearchInputShell
            id="global-search"
            name="q"
            enterKeyHint="search"
            autoComplete="off"
            placeholder={t('search.placeholder')}
            value={input}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onChange={(event) => {
              inputRef.current = event.target.value
              setInput(event.target.value)
            }}
            onClear={() => {
              inputRef.current = ''
              setInput('')
              setQuery('')
              if (urlQuery) setSearchParams({}, { replace: true })
            }}
          />
        </div>
        <button className="grid size-12 shrink-0 place-items-center rounded-control bg-brand text-white shadow-soft transition hover:bg-brand-strong focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand/45" type="submit" aria-label={t('search.submit')}>
          <AppIcon name="search" />
        </button>
      </form>

      {!query ? (
        <PageState state="empty" icon="search" title={t('search.initialEmpty')} />
      ) : null}
      {isLoading ? (
        <SkeletonGroup className="grid gap-7" label={t('search.loading')}>
          {Array.from({ length: 2 }, (_, sectionIndex) => (
            <section className="grid gap-3" key={sectionIndex}>
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="overflow-hidden rounded-card border border-line bg-surface">
                {Array.from({ length: 2 }, (_, rowIndex) => (
                  <div className="flex min-h-20 items-center gap-4 border-b border-line px-4 py-3 last:border-b-0" key={rowIndex}>
                    <Skeleton className="size-12 shrink-0" />
                    <div className="grid min-w-0 flex-1 gap-2"><Skeleton className="h-5 w-2/5" /><Skeleton className="h-4 w-4/5" /></div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </SkeletonGroup>
      ) : null}
      {bothInitialError ? <PageState state="error" message={t('search.error')} onRetry={() => void Promise.all([boxesQuery.refetch(), resultsQuery.refetch()])} /> : null}
      {!bothInitialError && boxesQuery.isError ? (
        <ResponsiveOperationError message={boxesInitialError ? t('search.boxesErrorInitial') : t('search.boxesErrorRefresh')} busy={boxesQuery.isFetching} onRetry={() => void boxesQuery.refetch()} />
      ) : null}
      {!bothInitialError && resultsQuery.isError ? (
        <ResponsiveOperationError message={itemsInitialError ? t('search.itemsErrorInitial') : t('search.itemsErrorRefresh')} busy={resultsQuery.isFetching} onRetry={() => void resultsQuery.refetch()} />
      ) : null}

      {!isLoading && !boxesInitialError && matchingBoxes.length > 0 ? (
        <section aria-labelledby="box-results-title">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="mb-0 text-section-title font-bold" id="box-results-title">{t('search.boxResults')}</h2>
            <span className="text-sm text-muted">{t('search.resultCount', { count: matchingBoxes.length })}</span>
          </div>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {matchingBoxes.map((box) => (
              <Link className="group flex min-h-20 items-center gap-4 border-b border-line px-4 py-3 text-ink no-underline last:border-b-0 hover:bg-canvas" key={box.id} to={`/b/${box.public_id}`}>
                <span className="grid size-12 shrink-0 place-items-center rounded-control bg-placeholder text-brand"><AppIcon name="box" /></span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{box.name}</strong>
                  <span className="block truncate text-sm text-muted">{formatStoragePath([box.box_code, box.venue_name, box.space_name, box.location || t('boxes.locationUnset')])}</span>
                </span>
                <AppIcon className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" name="chevron-right" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {!isLoading && !itemsInitialError && items.length > 0 ? (
        <section aria-labelledby="item-results-title">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="mb-0 text-section-title font-bold" id="item-results-title">{t('search.itemResults')}</h2>
            <span className="text-sm text-muted">{t('search.resultCount', { count: items.length })}</span>
          </div>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {items.map((result) => (
              <Link className="group flex min-h-20 items-center gap-4 border-b border-line px-4 py-3 text-ink no-underline last:border-b-0 hover:bg-canvas" key={`${result.source ?? 'formal'}:${result.result_id ?? result.item_name}`} to={`/b/${result.box_public_id}`}>
                <span className="grid size-12 shrink-0 place-items-center rounded-control bg-brand/10 text-brand"><AppIcon name="search" /></span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{result.item_name} × {searchQuantityLabel(result, t)} {result.source === 'ai' ? <span className="ml-1 rounded-full bg-brand/10 px-2 py-0.5 text-[0.6875rem] text-brand">{t('search.aiRecognized')}</span> : null}</strong>
                  {result.source !== 'ai' && result.quantity !== null && result.stored_quantity !== null ? <span className="mt-0.5 block truncate text-xs font-bold text-brand">{formatItemAvailability(deriveItemAvailability(result.quantity, result.stored_quantity), locale === 'en-US' ? 'en' : 'zh-CN')}</span> : null}
                  <span className="block truncate text-sm text-muted">{formatStoragePath([result.venue_name, result.space_name, result.box_name, result.location || t('boxes.locationUnset')])}</span>
                </span>
                <AppIcon className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" name="chevron-right" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {noResults ? (
        <PageState
          state="empty"
          icon="search"
          title={t('search.empty')}
          description={t('search.noResultsDescription')}
          action={<Link to="/app/scan"><AppIcon name="scan" />{t('search.scanBox')}</Link>}
        />
      ) : null}
    </section>
  )
}

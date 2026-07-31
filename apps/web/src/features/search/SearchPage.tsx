import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { PageState } from '../../components/PageState'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { listBoxes } from '../boxes/boxes.api'
import { searchItems } from './search.api'

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const [input, setInput] = useState(urlQuery)
  const [query, setQuery] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const inputRef = useRef(urlQuery)

  useEffect(() => {
    if (urlQuery === inputRef.current) return
    inputRef.current = urlQuery
    setInput(urlQuery)
    setQuery('')
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
      [box.name, box.box_code, box.space_name, box.location]
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
      <header className="flex flex-col gap-2 py-3">
        <p className="mb-1 text-meta font-medium tracking-eyebrow text-muted">按名称、编号、空间或位置查找</p>
        <h1 className="mb-0 text-page-title font-extrabold" id="search-title">查找收纳</h1>
      </header>

      <form className="relative block" role="search" aria-label="查找收纳" onSubmit={submitSearch}>
        <label htmlFor="global-search">
          <span className="sr-only">关键词</span>
          <AppIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" name="search" />
          <input
            className="min-h-14 w-full rounded-control border border-line bg-surface py-3 pr-16 pl-12 text-lg text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-3 focus:ring-brand/15"
            id="global-search"
            name="q"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="搜索物品、箱子或编号"
            value={input}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onChange={(event) => {
              inputRef.current = event.target.value
              setInput(event.target.value)
            }}
          />
        </label>
        <button className="absolute top-1/2 right-1.5 grid size-11 -translate-y-1/2 place-items-center rounded-control text-brand hover:bg-brand/10 focus-visible:outline-3 focus-visible:outline-brand/35" type="submit" aria-label="提交搜索">
          <AppIcon name="search" />
        </button>
      </form>

      {!query ? (
        <p className="rounded-card border border-dashed border-line bg-surface/70 p-8 text-center text-muted">输入关键词，快速找到物品所在的箱子。</p>
      ) : null}
      {isLoading ? (
        <SkeletonGroup className="grid gap-7" label="正在搜索收纳内容">
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
      {bothInitialError ? <PageState state="error" message="搜索失败，请重试" onRetry={() => void Promise.all([boxesQuery.refetch(), resultsQuery.refetch()])} /> : null}
      {!bothInitialError && boxesQuery.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
          <p className="m-0 font-medium">{boxesInitialError ? '箱子结果加载失败' : '箱子结果刷新失败，正在显示上次结果'}</p>
          <button className="min-h-11 rounded-control border border-danger/30 bg-surface px-4 py-2 font-bold" type="button" disabled={boxesQuery.isFetching} aria-busy={boxesQuery.isFetching} onClick={() => void boxesQuery.refetch()}>{boxesQuery.isFetching ? '重试中…' : '重试'}</button>
        </div>
      ) : null}
      {!bothInitialError && resultsQuery.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
          <p className="m-0 font-medium">{itemsInitialError ? '物品结果加载失败' : '物品结果刷新失败，正在显示上次结果'}</p>
          <button className="min-h-11 rounded-control border border-danger/30 bg-surface px-4 py-2 font-bold" type="button" disabled={resultsQuery.isFetching} aria-busy={resultsQuery.isFetching} onClick={() => void resultsQuery.refetch()}>{resultsQuery.isFetching ? '重试中…' : '重试'}</button>
        </div>
      ) : null}

      {!isLoading && !boxesInitialError && matchingBoxes.length > 0 ? (
        <section aria-labelledby="box-results-title">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="mb-0 text-section-title font-bold" id="box-results-title">箱子</h2>
            <span className="text-sm text-muted">{matchingBoxes.length} 个结果</span>
          </div>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {matchingBoxes.map((box) => (
              <Link className="group flex min-h-20 items-center gap-4 border-b border-line px-4 py-3 text-ink no-underline last:border-b-0 hover:bg-canvas" key={box.id} to={`/b/${box.public_id}`}>
                <span className="grid size-12 shrink-0 place-items-center rounded-control bg-placeholder text-brand"><AppIcon name="box" /></span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{box.name}</strong>
                  <span className="block truncate text-sm text-muted">{box.box_code} · {box.space_name} · {box.location || '未填写位置'}</span>
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
            <h2 className="mb-0 text-section-title font-bold" id="item-results-title">物品</h2>
            <span className="text-sm text-muted">{items.length} 个结果</span>
          </div>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {items.map((result) => (
              <Link className="group flex min-h-20 items-center gap-4 border-b border-line px-4 py-3 text-ink no-underline last:border-b-0 hover:bg-canvas" key={result.item_id} to={`/b/${result.box_public_id}`}>
                <span className="grid size-12 shrink-0 place-items-center rounded-control bg-brand/10 text-brand"><AppIcon name="search" /></span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{result.item_name} × {result.quantity}</strong>
                  <span className="block truncate text-sm text-muted">{result.space_name} · {result.box_name} · {result.location || '未填写位置'}</span>
                </span>
                <AppIcon className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" name="chevron-right" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {noResults ? (
        <div className="grid min-h-52 place-content-center justify-items-center gap-4 rounded-card border border-dashed border-line bg-surface/70 p-8 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-brand/10 text-brand"><AppIcon name="scan" size={26} /></span>
          <div><h2 className="mb-1">没有找到相关内容</h2><p>也可以扫描箱子标签，直接打开清单。</p></div>
          <Link className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-brand px-4 py-2 font-bold text-white no-underline hover:bg-brand-strong sm:min-h-11 sm:w-auto" to="/app/scan"><AppIcon name="scan" />扫码查看箱子</Link>
        </div>
      ) : null}
    </section>
  )
}

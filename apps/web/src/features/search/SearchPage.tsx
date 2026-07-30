import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { PageState } from '../../components/PageState'
import { listBoxes } from '../boxes/boxes.api'
import { searchItems } from './search.api'

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const [input, setInput] = useState(urlQuery)
  const [query, setQuery] = useState('')
  const inputRef = useRef(urlQuery)

  useEffect(() => {
    if (urlQuery === inputRef.current) return
    inputRef.current = urlQuery
    setInput(urlQuery)
    setQuery('')
  }, [urlQuery])

  useEffect(() => {
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
  }, [input, setSearchParams, urlQuery])

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
  const isLoading = query && (resultsQuery.isPending || boxesQuery.isPending)
  const hasError = resultsQuery.isError || boxesQuery.isError
  const noResults = query && !isLoading && !hasError && matchingBoxes.length === 0 && items.length === 0

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8" aria-labelledby="search-title">
      <header className="flex flex-col gap-2 py-3">
        <p className="mb-1 text-meta font-medium tracking-eyebrow text-muted">按名称、编号、空间或位置查找</p>
        <h1 className="mb-0 text-page-title font-extrabold" id="search-title">查找收纳</h1>
      </header>

      <label className="relative block" htmlFor="global-search">
        <span className="sr-only">关键词</span>
        <AppIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" name="search" />
        <input
          className="min-h-14 w-full rounded-control border border-line bg-surface py-3 pr-4 pl-12 text-lg text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-3 focus:ring-brand/15"
          id="global-search"
          type="search"
          placeholder="搜索物品、箱子或编号"
          value={input}
          onChange={(event) => {
            inputRef.current = event.target.value
            setInput(event.target.value)
          }}
        />
      </label>

      {!query ? (
        <p className="rounded-card border border-dashed border-line bg-surface/70 p-8 text-center text-muted">输入关键词，快速找到物品所在的箱子。</p>
      ) : null}
      {isLoading ? <PageState state="loading" label="正在搜索…" /> : null}
      {hasError ? <PageState state="error" message="搜索失败，请重试" onRetry={() => void Promise.all([boxesQuery.refetch(), resultsQuery.refetch()])} /> : null}

      {!isLoading && !hasError && matchingBoxes.length > 0 ? (
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

      {!isLoading && !hasError && items.length > 0 ? (
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
          <Link className="inline-flex min-h-11 items-center gap-2 rounded-control bg-brand px-4 py-2 font-bold text-white no-underline hover:bg-brand-strong" to="/app/scan"><AppIcon name="scan" />扫码查看箱子</Link>
        </div>
      ) : null}
    </section>
  )
}

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { searchItems } from './search.api'

export function SearchPage() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const trimmed = input.trim()
    if (!trimmed) {
      setQuery('')
      return
    }
    const timer = window.setTimeout(() => setQuery(trimmed), 250)
    return () => window.clearTimeout(timer)
  }, [input])

  const resultsQuery = useQuery({
    queryKey: ['search-items', query],
    queryFn: () => searchItems(query),
    enabled: query.length > 0,
  })

  return (
    <section className="page-stack" aria-labelledby="search-title">
      <header className="page-heading">
        <p className="eyebrow">按名称、分类或描述查找</p>
        <h1 id="search-title">搜索物品</h1>
      </header>
      <label htmlFor="global-search">关键词</label>
      <input
        id="global-search"
        type="search"
        placeholder="例如：充电器"
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />

      {!query ? <p className="empty-state">请输入关键词</p> : null}
      {resultsQuery.isPending && query ? <p role="status">正在搜索…</p> : null}
      {resultsQuery.isError ? <p role="alert">搜索失败，请重试</p> : null}
      {resultsQuery.data?.length === 0 ? <p className="empty-state">没有找到物品</p> : null}

      <div className="card-grid">
        {resultsQuery.data?.map((result) => (
          <Link
            className="panel search-result"
            key={result.item_id}
            to={`/b/${result.box_public_id}`}
          >
            <strong>{result.item_name} × {result.quantity}</strong>
            <span>{result.space_name} · {result.box_name} · {result.location || '未填写位置'}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

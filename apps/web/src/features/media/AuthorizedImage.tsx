import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Skeleton } from '../../components/Skeleton'
import { createMediaDownload } from './media.api'

type AuthorizedImageProps = {
  objectKey: string
  alt: string
  className?: string
}

export function AuthorizedImage({ objectKey, alt, className }: AuthorizedImageProps) {
  const [loadFailed, setLoadFailed] = useState(false)
  const query = useQuery({
    queryKey: ['media-url', objectKey],
    queryFn: () => createMediaDownload(objectKey),
    staleTime: 4 * 60 * 1000,
    retry: 1,
  })

  if (query.isPending && query.data === undefined) {
    return (
      <span className={`inline-block ${className ?? ''}`.trim()} role="status" aria-label="正在加载授权图片">
        <span className="sr-only">正在加载授权图片</span>
        <Skeleton as="span" className="block min-h-16 h-full w-full" />
      </span>
    )
  }
  if ((query.isError && query.data === undefined) || !query.data || loadFailed) return <span className={className}>图片暂不可用</span>
  return (
    <span className={`relative inline-block ${className ?? ''}`.trim()}>
      <img
        className={className}
        src={query.data.download_url}
        alt={alt}
        onError={() => setLoadFailed(true)}
      />
      {query.isError ? (
        <span className="absolute right-1 bottom-1 z-20 rounded-control bg-surface/95 p-1 text-xs text-danger shadow-sm" role="alert">
          <span className="sr-only">图片刷新失败，正在显示缓存图片</span>
          <button className="min-h-8 rounded-control border border-danger/30 px-2 font-bold" type="button" disabled={query.isFetching} aria-busy={query.isFetching} aria-label={query.isFetching ? '重试中…' : '重试加载图片'} onClick={() => void query.refetch()}>{query.isFetching ? '重试中…' : '重试'}</button>
        </span>
      ) : null}
    </span>
  )
}

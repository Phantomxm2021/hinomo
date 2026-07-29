import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
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

  if (query.isPending) return <span role="status">图片加载中…</span>
  if (query.isError || loadFailed) return <span className={className}>图片暂不可用</span>
  return (
    <img
      className={className}
      src={query.data.download_url}
      alt={alt}
      onError={() => setLoadFailed(true)}
    />
  )
}

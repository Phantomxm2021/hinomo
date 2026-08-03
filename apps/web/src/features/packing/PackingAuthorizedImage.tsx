import { useQuery } from '@tanstack/react-query'
import { createPackingMediaDownload } from './packing.api'

export function PackingAuthorizedImage(props: { objectKey: string; alt: string; className?: string }) {
  const query = useQuery({
    queryKey: ['packing-media-url', props.objectKey],
    queryFn: () => createPackingMediaDownload(props.objectKey),
    staleTime: 4 * 60 * 1000,
    retry: 1,
  })
  if (!query.data) return <span className={props.className} aria-label={query.isError ? '照片暂不可用' : '正在加载照片'} />
  return <img className={props.className} src={query.data.download_url} alt={props.alt} />
}

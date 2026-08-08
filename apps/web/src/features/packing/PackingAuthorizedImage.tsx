import { useQuery } from '@tanstack/react-query'
import { useI18n } from '../../i18n/I18nProvider'
import { createPackingMediaDownload } from './packing.api'

export function PackingAuthorizedImage(props: { objectKey: string; alt: string; className?: string }) {
  const { t } = useI18n()
  const query = useQuery({
    queryKey: ['packing-media-url', props.objectKey],
    queryFn: () => createPackingMediaDownload(props.objectKey),
    staleTime: 4 * 60 * 1000,
    retry: 1,
  })
  if (!query.data) return <span className={props.className} aria-label={query.isError ? t('packing.photoUnavailable') : t('packing.photoLoading')} />
  return <img className={props.className} src={query.data.download_url} alt={props.alt} />
}

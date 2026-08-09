import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AppIcon } from '../../components/AppIcon'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { useI18n } from '../../i18n/I18nProvider'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { AuthorizedImage } from '../media/AuthorizedImage'
import { isUploadPending, uploadStageLabel } from '../media/media-ui'
import { useMediaUpload } from '../media/useMediaUpload'
import { createItemSchema, type ItemFormValues } from './item.schema'
import { createItem, type ItemRecord, updateItem } from './items.api'

export type ItemFormProps = {
  boxId: string
  item?: ItemRecord | null
  onSaved: () => void
  onCancel?: () => void
  onDelete?: () => void
  onBusyChange?: (busy: boolean) => void
  showHeading?: boolean
  onVenueAccessDenied?: (error: unknown) => void
}

export function ItemForm({ boxId, item, onSaved, onCancel, onDelete, onBusyChange, showHeading = true, onVenueAccessDenied }: ItemFormProps) {
  const { locale, t } = useI18n()
  const feedback = useMobileFeedback()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [existingImageRemoved, setExistingImageRemoved] = useState(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)
  const [mediaError, setMediaError] = useState(false)
  const mediaUpload = useMediaUpload()
  const mediaStatus = uploadStageLabel(mediaUpload.stage)

  useEffect(() => () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
  }, [imagePreviewUrl])
  const mutation = useMutation({
    mutationFn: async (values: ItemFormValues) => {
      const input = {
        box_id: boxId,
        name: values.name,
        category: values.category || null,
        quantity: values.quantity,
        description: values.description || null,
        ...(item && existingImageRemoved ? { image_object_key: null } : {}),
      }
      if (item) {
        const { box_id: _boxId, ...changes } = input
        await updateItem(item.id, changes)
        return item.id
      }
      const created = await createItem(input)
      return created.id
    },
  })
  const busy = mutation.isPending || isUploadPending(mediaUpload.stage)
  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])
  useEffect(() => () => onBusyChange?.(false), [onBusyChange])
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(createItemSchema(t)),
    defaultValues: {
      name: item?.name ?? '',
      category: item?.category ?? '',
      quantity: item?.quantity ?? 1,
      description: item?.description ?? '',
    },
  })
  const previousLocaleRef = useRef(locale)
  useEffect(() => {
    if (previousLocaleRef.current !== locale && Object.keys(errors).length > 0) void trigger()
    previousLocaleRef.current = locale
  }, [errors, locale, trigger])
  const quantity = watch('quantity')
  const setQuantity = (next: number) =>
    setValue('quantity', Math.max(1, next), { shouldDirty: true, shouldValidate: true })

  const selectImage = (file: File | null) => {
    setImageFile(file)
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return file ? URL.createObjectURL(file) : null
    })
    setMediaError(false)
    mediaUpload.reset()
    if (file) setExistingImageRemoved(false)
  }

  const clearSelectedImage = () => {
    selectImage(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const removeExistingImage = () => {
    setExistingImageRemoved(true)
    clearSelectedImage()
  }

  async function uploadImage(itemId: string) {
    if (!imageFile) return
    await mediaUpload.upload({ file: imageFile, boxId, itemId, kind: 'item' })
  }

  async function submit(values: ItemFormValues) {
    let recordSaved = false
    setMediaError(false)
    try {
      const itemId = await mutation.mutateAsync(values)
      recordSaved = true
      setPendingItemId(itemId)
      await uploadImage(itemId)
      feedback.notify(item ? t('itemForm.updated') : t('itemForm.created'))
      onSaved()
    } catch (error) {
      onVenueAccessDenied?.(error)
      if (recordSaved) setMediaError(true)
    }
  }

  async function retryImageUpload() {
    if (!pendingItemId) return
    setMediaError(false)
    try {
      await uploadImage(pendingItemId)
      feedback.notify(t('itemForm.uploaded'))
      onSaved()
    } catch {
      setMediaError(true)
    }
  }
  return (
    <form
      className="grid gap-5 border-0 bg-transparent p-5 pb-24 lg:rounded-shell lg:border lg:border-line lg:bg-surface lg:p-6 lg:pb-6"
      onSubmit={handleSubmit(submit)}
      noValidate
    >
      {showHeading ? (
        <h2 className="m-0 text-section-title font-bold text-ink" id="item-form-title">
          {item ? t('itemForm.editTitle') : t('itemForm.createTitle')}
        </h2>
      ) : null}
      <div className="relative overflow-hidden rounded-control bg-placeholder">
        <button className="group relative block aspect-[4/3] w-full overflow-hidden text-left" type="button" aria-label={imagePreviewUrl || (item?.image_object_key && !existingImageRemoved) ? t('itemForm.changeImage') : t('itemForm.addImage')} onClick={() => imageInputRef.current?.click()}>
          {imagePreviewUrl ? <img className="h-full w-full object-cover" src={imagePreviewUrl} alt={t('itemForm.pendingImageAlt')} /> : null}
          {!imagePreviewUrl && item?.image_object_key && !existingImageRemoved ? <AuthorizedImage objectKey={item.image_object_key} alt={t('itemForm.imagePreviewAlt', { name: item.name })} className="h-full w-full object-cover" /> : null}
          {!imagePreviewUrl && (!item?.image_object_key || existingImageRemoved) ? (
            <span className="grid h-full place-content-center justify-items-center gap-2 text-muted">
              <AppIcon name="plus" size={28} />
              <span className="text-sm font-bold">{t('itemForm.addImageLabel')}</span>
            </span>
          ) : null}
          <span className="absolute inset-0 grid place-content-center bg-ink/45 text-sm font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {t('itemForm.changeImage')}
          </span>
        </button>
        <input
          ref={imageInputRef}
          className="sr-only"
          id="item-image"
          aria-label={t('itemForm.chooseImage')}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            selectImage(event.target.files?.[0] ?? null)
          }}
        />
        {imagePreviewUrl ? <button className="absolute top-2 right-2 inline-flex size-9 items-center justify-center rounded-full bg-ink/65 text-white shadow-sm active:opacity-75" type="button" aria-label={t('itemForm.removePendingImage')} onClick={clearSelectedImage}><AppIcon name="trash" size={18} /></button> : null}
        {!imagePreviewUrl && item?.image_object_key && !existingImageRemoved ? <button className="absolute top-2 right-2 inline-flex size-9 items-center justify-center rounded-full bg-ink/65 text-white shadow-sm active:opacity-75" type="button" aria-label={t('itemForm.removeImage')} onClick={removeExistingImage}><AppIcon name="trash" size={18} /></button> : null}
      </div>
      <div className="grid gap-2">
        <label className="font-bold text-ink" htmlFor="item-name">{t('itemForm.name')}</label>
        <input className="min-h-12 w-full rounded-control border border-line bg-canvas px-3 text-ink focus:border-brand" id="item-name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'item-name-error' : undefined} {...register('name')} />
        {errors.name ? <p id="item-name-error" role="alert">{errors.name.message}</p> : null}
      </div>
      <div className="grid gap-2">
        <label className="font-bold text-ink" htmlFor="item-category">{t('itemForm.categoryOptional')}</label>
        <input className="min-h-12 w-full rounded-control border border-line bg-canvas px-3 text-ink focus:border-brand" id="item-category" {...register('category')} />
      </div>
      <div className="grid gap-2">
        <label className="font-bold text-ink" htmlFor="item-quantity">{t('itemForm.quantity')}</label>
        <div className="grid grid-cols-[2.75rem_minmax(5rem,8rem)_2.75rem] items-center gap-2">
          <button
            className="inline-flex size-11 items-center justify-center rounded-control border border-line bg-canvas text-ink"
            type="button"
            aria-label={t('itemForm.decreaseQuantity')}
            onClick={() => setQuantity(Number(quantity) - 1)}
          >
            <AppIcon name="minus" />
          </button>
          <input
            className="h-11 w-full rounded-control border border-line bg-canvas px-2 text-center font-bold text-ink focus:border-brand"
            id="item-quantity"
            type="number"
            min="1"
            aria-invalid={Boolean(errors.quantity)}
            aria-describedby={errors.quantity ? 'item-quantity-error' : undefined}
            {...register('quantity')}
          />
          <button
            className="inline-flex size-11 items-center justify-center rounded-control border border-line bg-canvas text-ink"
            type="button"
            aria-label={t('itemForm.increaseQuantity')}
            onClick={() => setQuantity(Number(quantity) + 1)}
          >
            <AppIcon name="plus" />
          </button>
        </div>
        {errors.quantity ? <p id="item-quantity-error" role="alert">{errors.quantity.message}</p> : null}
      </div>
      <div className="grid gap-2">
        <label className="font-bold text-ink" htmlFor="item-description">{t('itemForm.descriptionOptional')}</label>
        <textarea className="w-full rounded-control border border-line bg-canvas px-3 py-3 text-ink focus:border-brand" id="item-description" rows={3} {...register('description')} />
      </div>
      {mutation.isError ? <ResponsiveOperationError message={t('itemForm.saveError')} error={mutation.error} /> : null}
      {mediaStatus ? <p className="hidden lg:block" role="status">{t('boxes.mediaProcessing', { status: t(mediaStatus) })}</p> : null}
      {mediaError ? (
        <div className="hidden gap-3 rounded-control border border-danger/30 bg-danger/5 p-4 lg:grid" role="status">
          <p>{t('itemForm.imageUploadPartial')}</p>
          <button className="min-h-11 w-fit rounded-control border border-danger/30 bg-surface px-4 font-bold text-danger" type="button" onClick={() => void retryImageUpload()}>{t('itemForm.retryUpload')}</button>
        </div>
      ) : null}
      {mediaError ? <ResponsiveOperationError message={t('itemForm.imageUploadPartial')} onRetry={() => void retryImageUpload()} /> : null}
      <div className="fixed inset-x-4 bottom-[max(1rem,var(--safe-area-bottom))] z-20 flex flex-wrap justify-end gap-2 rounded-control border border-line bg-surface/95 p-2 shadow-float backdrop-blur min-[360px]:inset-x-5 lg:static lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
        {item && onDelete ? <button className="mr-auto min-h-11 rounded-control border border-danger/30 bg-danger/5 px-4 font-bold text-danger" type="button" disabled={busy} onClick={() => { if (!busy) onDelete() }}>{t('itemForm.delete')}</button> : null}
        {onCancel ? <button className="min-h-11 rounded-control border border-line bg-canvas px-4 font-bold text-ink" type="button" disabled={busy} onClick={() => { if (!busy) onCancel() }}>{t('itemForm.cancel')}</button> : null}
        <button className="min-h-12 rounded-control border border-brand bg-brand px-5 font-bold text-white" type="submit" disabled={busy}>{t('itemForm.save')}</button>
      </div>
    </form>
  )
}

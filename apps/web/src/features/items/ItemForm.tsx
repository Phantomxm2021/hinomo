import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { AppIcon } from '../../components/AppIcon'
import { isUploadPending, uploadStageLabel } from '../media/media-ui'
import { useMediaUpload } from '../media/useMediaUpload'
import { itemSchema, type ItemFormValues } from './item.schema'
import { createItem, type ItemRecord, updateItem } from './items.api'

type ItemFormProps = {
  boxId: string
  item?: ItemRecord | null
  onSaved: () => void
  onCancel?: () => void
}

export function ItemForm({ boxId, item, onSaved, onCancel }: ItemFormProps) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)
  const [mediaError, setMediaError] = useState(false)
  const mediaUpload = useMediaUpload()
  const mediaStatus = uploadStageLabel(mediaUpload.stage)
  const mutation = useMutation({
    mutationFn: async (values: ItemFormValues) => {
      const input = {
        box_id: boxId,
        name: values.name,
        category: values.category || null,
        quantity: values.quantity,
        description: values.description || null,
      }
      if (item) {
        await updateItem(item.id, input)
        return item.id
      }
      const created = await createItem(input)
      return created.id
    },
  })
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: item?.name ?? '',
      category: item?.category ?? '',
      quantity: item?.quantity ?? 1,
      description: item?.description ?? '',
    },
  })
  const quantity = watch('quantity')
  const setQuantity = (next: number) =>
    setValue('quantity', Math.max(1, next), { shouldDirty: true, shouldValidate: true })

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
      onSaved()
    } catch {
      if (recordSaved) setMediaError(true)
    }
  }

  async function retryImageUpload() {
    if (!pendingItemId) return
    setMediaError(false)
    try {
      await uploadImage(pendingItemId)
      onSaved()
    } catch {
      setMediaError(true)
    }
  }

  return (
    <form
      className="grid gap-5 rounded-shell border border-line bg-surface p-5 md:p-6"
      onSubmit={handleSubmit(submit)}
      noValidate
    >
      <h2 className="m-0 text-2xl font-extrabold tracking-tight text-ink">
        {item ? '编辑物品' : '新增物品'}
      </h2>
      <div className="grid gap-2">
        <label className="font-bold text-ink" htmlFor="item-image">物品图片（可选）</label>
        <input
          className="min-h-12 w-full rounded-control border border-line bg-canvas px-3 py-2 text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-placeholder file:px-3 file:py-2 file:font-bold file:text-ink"
          id="item-image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            setImageFile(event.target.files?.[0] ?? null)
            setMediaError(false)
            mediaUpload.reset()
          }}
        />
      </div>
      <div className="grid gap-2">
        <label className="font-bold text-ink" htmlFor="item-name">物品名称</label>
        <input className="min-h-12 w-full rounded-control border border-line bg-canvas px-3 text-ink focus:border-brand" id="item-name" {...register('name')} />
        {errors.name ? <p role="alert">{errors.name.message}</p> : null}
      </div>
      <div className="grid gap-2">
        <label className="font-bold text-ink" htmlFor="item-category">分类（可选）</label>
        <input className="min-h-12 w-full rounded-control border border-line bg-canvas px-3 text-ink focus:border-brand" id="item-category" {...register('category')} />
      </div>
      <div className="grid gap-2">
        <label className="font-bold text-ink" htmlFor="item-quantity">数量</label>
        <div className="grid grid-cols-[2.75rem_minmax(5rem,8rem)_2.75rem] items-center gap-2">
          <button
            className="inline-flex size-11 items-center justify-center rounded-control border border-line bg-canvas text-ink"
            type="button"
            aria-label="减少数量"
            onClick={() => setQuantity(Number(quantity) - 1)}
          >
            <AppIcon name="minus" />
          </button>
          <input
            className="h-11 w-full rounded-control border border-line bg-canvas px-2 text-center font-bold text-ink focus:border-brand"
            id="item-quantity"
            type="number"
            min="1"
            {...register('quantity')}
          />
          <button
            className="inline-flex size-11 items-center justify-center rounded-control border border-line bg-canvas text-ink"
            type="button"
            aria-label="增加数量"
            onClick={() => setQuantity(Number(quantity) + 1)}
          >
            <AppIcon name="plus" />
          </button>
        </div>
        {errors.quantity ? <p role="alert">{errors.quantity.message}</p> : null}
      </div>
      <div className="grid gap-2">
        <label className="font-bold text-ink" htmlFor="item-description">描述（可选）</label>
        <textarea className="w-full rounded-control border border-line bg-canvas px-3 py-3 text-ink focus:border-brand" id="item-description" rows={3} {...register('description')} />
      </div>
      {mutation.isError ? <p role="alert">保存失败，请稍后重试</p> : null}
      {mediaStatus ? <p role="status">图片处理中：{mediaStatus}</p> : null}
      {mediaError ? (
        <div className="grid gap-3 rounded-control border border-danger/30 bg-danger/5 p-4" role="alert">
          <p>图片上传失败，已保留填写内容。</p>
          <button className="min-h-11 w-fit rounded-control border border-danger/30 bg-surface px-4 font-bold text-danger" type="button" onClick={() => void retryImageUpload()}>重试上传</button>
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? <button className="min-h-11 rounded-control border border-line bg-canvas px-4 font-bold text-ink" type="button" onClick={onCancel}>取消</button> : null}
        <button className="min-h-11 rounded-control border border-brand bg-brand px-5 font-bold text-white" type="submit" disabled={mutation.isPending || isUploadPending(mediaUpload.stage)}>保存</button>
      </div>
    </form>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
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
    <form className="panel form-stack" onSubmit={handleSubmit(submit)} noValidate>
      <h2>{item ? '编辑物品' : '新增物品'}</h2>
      <label htmlFor="item-name">物品名称</label>
      <input id="item-name" {...register('name')} />
      {errors.name ? <p role="alert">{errors.name.message}</p> : null}
      <label htmlFor="item-category">分类（可选）</label>
      <input id="item-category" {...register('category')} />
      <label htmlFor="item-quantity">数量</label>
      <input id="item-quantity" type="number" min="1" {...register('quantity')} />
      {errors.quantity ? <p role="alert">{errors.quantity.message}</p> : null}
      <label htmlFor="item-description">描述（可选）</label>
      <textarea id="item-description" rows={3} {...register('description')} />
      <label htmlFor="item-image">物品图片（可选）</label>
      <input
        id="item-image"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          setImageFile(event.target.files?.[0] ?? null)
          setMediaError(false)
          mediaUpload.reset()
        }}
      />
      {mutation.isError ? <p role="alert">保存失败，请稍后重试</p> : null}
      {mediaStatus ? <p role="status">图片处理中：{mediaStatus}</p> : null}
      {mediaError ? (
        <div className="upload-error" role="alert">
          <p>图片上传失败，已保留填写内容。</p>
          <button type="button" onClick={() => void retryImageUpload()}>重试上传</button>
        </div>
      ) : null}
      <div className="card-actions">
        <button type="submit" disabled={mutation.isPending || isUploadPending(mediaUpload.stage)}>保存</button>
        {onCancel ? <button type="button" onClick={onCancel}>取消</button> : null}
      </div>
    </form>
  )
}

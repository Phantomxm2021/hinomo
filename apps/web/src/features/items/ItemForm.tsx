import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { itemSchema, type ItemFormValues } from './item.schema'
import { createItem, type ItemRecord, updateItem } from './items.api'

type ItemFormProps = {
  boxId: string
  item?: ItemRecord | null
  onSaved: () => void
  onCancel?: () => void
}

export function ItemForm({ boxId, item, onSaved, onCancel }: ItemFormProps) {
  const mutation = useMutation({
    mutationFn: async (values: ItemFormValues) => {
      const input = {
        box_id: boxId,
        name: values.name,
        category: values.category || null,
        quantity: values.quantity,
        description: values.description || null,
      }
      return item ? updateItem(item.id, input) : createItem(input)
    },
    onSuccess: onSaved,
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

  return (
    <form className="panel form-stack" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
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
      {mutation.isError ? <p role="alert">保存失败，请稍后重试</p> : null}
      <div className="card-actions">
        <button type="submit" disabled={mutation.isPending}>保存</button>
        {onCancel ? <button type="button" onClick={onCancel}>取消</button> : null}
      </div>
    </form>
  )
}

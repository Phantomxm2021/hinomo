import { z } from 'zod'

export type ItemSchemaTranslator = (key: string) => string

export function createItemSchema(t: ItemSchemaTranslator) {
  return z.object({
    name: z.string().trim().min(1, t('validation.itemNameRequired')).max(120, t('validation.itemNameMax')),
    category: z.string().trim().max(80, t('validation.categoryMax')).optional(),
    quantity: z.coerce.number().int(t('validation.quantityInteger')).positive(t('validation.quantityPositive')),
    description: z.string().trim().max(1000, t('validation.itemDescriptionMax')).optional(),
  })
}

export const itemSchema = createItemSchema((key) => ({
  'validation.itemNameRequired': '请输入物品名称',
  'validation.itemNameMax': '物品名称最多 120 字',
  'validation.categoryMax': '分类最多 80 字',
  'validation.quantityInteger': '数量必须是整数',
  'validation.quantityPositive': '数量必须大于 0',
  'validation.itemDescriptionMax': '描述最多 1000 字',
}[key] ?? key))

export type ItemFormValues = z.infer<typeof itemSchema>

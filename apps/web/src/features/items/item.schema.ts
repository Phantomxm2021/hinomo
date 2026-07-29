import { z } from 'zod'

export const itemSchema = z.object({
  name: z.string().trim().min(1, '请输入物品名称').max(120, '物品名称最多 120 字'),
  category: z.string().trim().max(80, '分类最多 80 字').optional(),
  quantity: z.coerce.number().int('数量必须是整数').positive('数量必须大于 0'),
  description: z.string().trim().max(1000, '描述最多 1000 字').optional(),
})

export type ItemFormValues = z.infer<typeof itemSchema>

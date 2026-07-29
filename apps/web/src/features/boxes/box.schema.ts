import { z } from 'zod'

export const boxSchema = z.object({
  space_id: z.string().min(1, '请选择空间'),
  name: z.string().trim().min(1, '请输入箱子名称').max(120, '箱子名称最多 120 字'),
  category: z.string().trim().max(80, '分类最多 80 字').optional(),
  location: z.string().trim().max(200, '具体位置最多 200 字').optional(),
  description: z.string().trim().max(1000, '备注最多 1000 字').optional(),
  visibility: z.enum(['public', 'private']),
})

export type BoxFormValues = z.infer<typeof boxSchema>

import { z } from 'zod'

export const spaceSchema = z.object({
  venue_id: z.string().min(1, '请选择场地'),
  name: z.string().trim().min(1, '请输入空间名称').max(80, '空间名称最多 80 字'),
  description: z.string().trim().max(500, '描述最多 500 字').optional(),
})

export type SpaceFormValues = z.infer<typeof spaceSchema>

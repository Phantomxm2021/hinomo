import { z } from 'zod'

export const venueSchema = z.object({
  name: z.string().trim().min(1, '请输入场地名称').max(80, '场地名称最多 80 字'),
  description: z.string().trim().max(500, '描述最多 500 字').optional(),
})

export type VenueFormValues = z.infer<typeof venueSchema>

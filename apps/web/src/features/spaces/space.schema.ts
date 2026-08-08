import { z } from 'zod'
import type { SchemaTranslator } from '../boxes/box.schema'

export function createSpaceSchema(t: SchemaTranslator) {
  return z.object({
    venue_id: z.string().min(1, t('validation.venueRequired')),
    name: z.string().trim().min(1, t('validation.spaceNameRequired')).max(80, t('validation.spaceNameMax')),
    description: z.string().trim().max(500, t('validation.descriptionMax')).optional(),
  })
}

export const spaceSchema = createSpaceSchema((key) => ({
  'validation.venueRequired': '请选择场地',
  'validation.spaceNameRequired': '请输入空间名称',
  'validation.spaceNameMax': '空间名称最多 80 字',
  'validation.descriptionMax': '描述最多 500 字',
}[key] ?? key))

export type SpaceFormValues = z.infer<typeof spaceSchema>

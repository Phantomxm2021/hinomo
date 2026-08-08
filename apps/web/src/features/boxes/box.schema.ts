import { z } from 'zod'

export type SchemaTranslator = (key: string) => string

export function createBoxSchema(t: SchemaTranslator) {
  return z.object({
    space_id: z.string().min(1, t('validation.spaceRequired')),
    name: z.string().trim().min(1, t('validation.boxNameRequired')).max(120, t('validation.boxNameMax')),
    category: z.string().trim().max(80, t('validation.categoryMax')).optional(),
    location: z.string().trim().max(200, t('validation.locationMax')).optional(),
    description: z.string().trim().max(1000, t('validation.noteMax')).optional(),
    visibility: z.enum(['public', 'private']),
  })
}

export const boxSchema = createBoxSchema((key) => ({
  'validation.spaceRequired': '请选择空间',
  'validation.boxNameRequired': '请输入箱子名称',
  'validation.boxNameMax': '箱子名称最多 120 字',
  'validation.categoryMax': '分类最多 80 字',
  'validation.locationMax': '具体位置最多 200 字',
  'validation.noteMax': '备注最多 1000 字',
}[key] ?? key))

export type BoxFormValues = z.infer<typeof boxSchema>

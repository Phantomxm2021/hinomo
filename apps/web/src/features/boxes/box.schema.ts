import { z } from 'zod'
import { messages } from '../../i18n/messages'

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

const defaultSchemaMessages: Record<string, string> = {
  'validation.spaceRequired': messages['zh-CN'].validation.spaceRequired,
  'validation.boxNameRequired': messages['zh-CN'].validation.boxNameRequired,
  'validation.boxNameMax': messages['zh-CN'].validation.boxNameMax,
  'validation.categoryMax': messages['zh-CN'].validation.categoryMax,
  'validation.locationMax': messages['zh-CN'].validation.locationMax,
  'validation.noteMax': messages['zh-CN'].validation.noteMax,
}

export const boxSchema = createBoxSchema((key) => defaultSchemaMessages[key] ?? key)

export type BoxFormValues = z.infer<typeof boxSchema>

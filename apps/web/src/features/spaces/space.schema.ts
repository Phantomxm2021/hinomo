import { z } from 'zod'
import type { SchemaTranslator } from '../boxes/box.schema'
import { messages } from '../../i18n/messages'

export function createSpaceSchema(t: SchemaTranslator) {
  return z.object({
    venue_id: z.string().min(1, t('validation.venueRequired')),
    name: z.string().trim().min(1, t('validation.spaceNameRequired')).max(80, t('validation.spaceNameMax')),
    description: z.string().trim().max(500, t('validation.descriptionMax')).optional(),
  })
}

const defaultSchemaMessages: Record<string, string> = {
  'validation.venueRequired': messages['zh-CN'].validation.venueRequired,
  'validation.spaceNameRequired': messages['zh-CN'].validation.spaceNameRequired,
  'validation.spaceNameMax': messages['zh-CN'].validation.spaceNameMax,
  'validation.descriptionMax': messages['zh-CN'].validation.descriptionMax,
}

export const spaceSchema = createSpaceSchema((key) => defaultSchemaMessages[key] ?? key)

export type SpaceFormValues = z.infer<typeof spaceSchema>

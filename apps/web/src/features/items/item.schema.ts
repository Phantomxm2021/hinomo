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

export const itemSchema = createItemSchema((key) => key)

export type ItemFormValues = z.infer<typeof itemSchema>

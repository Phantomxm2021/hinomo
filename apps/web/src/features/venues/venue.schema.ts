import { z } from 'zod'

type Translate = (key: string, params?: Record<string, string | number | boolean>) => string

export function createVenueSchema(t: Translate) {
  return z.object({
    name: z.string().trim().min(1, t('venues.nameRequired')).max(80, t('validation.venueNameMax')),
    description: z.string().trim().max(500, t('validation.descriptionMax')).optional(),
  })
}

export const venueSchema = createVenueSchema((key) => key)

export type VenueFormValues = z.infer<typeof venueSchema>

import { z } from 'zod'

export type Translate = (key: string, params?: Record<string, string | number | boolean>) => string

function fieldRequired(t: Translate, key: string) {
  return t('auth.validation.required', { field: t(key) })
}

export function createCredentialsSchema(t: Translate) {
  return z.object({
    email: z.string().trim().email(t('auth.validation.email')),
    password: z.string().min(8, t('auth.validation.passwordLength')),
  })
}

export function createEmailSchema(t: Translate) {
  return createCredentialsSchema(t).pick({ email: true })
}

export function createRegisterSchema(t: Translate) {
  return createCredentialsSchema(t).extend({
    displayName: z.string()
      .trim()
      .min(1, fieldRequired(t, 'auth.fields.nickname'))
      .max(40, t('auth.validation.nicknameTooLong')),
    acceptLegal: z.boolean().refine(
      (accepted) => accepted,
      t('auth.legal.legalRequired'),
    ),
  })
}

export function createResetPasswordSchema(t: Translate) {
  return z
    .object({
      password: z.string().min(8, t('auth.validation.passwordLength')),
      confirmPassword: z.string().min(1, fieldRequired(t, 'auth.fields.confirmPassword')),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: t('auth.validation.passwordMismatch'),
      path: ['confirmPassword'],
    })
}

// These schemas keep the public type surface stable for consumers that only need inference.
const fallbackTranslate: Translate = (key) => key
export const credentialsSchema = createCredentialsSchema(fallbackTranslate)
export const emailSchema = createEmailSchema(fallbackTranslate)
export const registerSchema = createRegisterSchema(fallbackTranslate)
export const resetPasswordSchema = createResetPasswordSchema(fallbackTranslate)

export type Credentials = z.infer<typeof credentialsSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type EmailValues = z.infer<typeof emailSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

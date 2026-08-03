import { z } from 'zod'

export const credentialsSchema = z.object({
  email: z.string().trim().email('请输入有效邮箱'),
  password: z.string().min(8, '密码至少 8 位'),
})

export const emailSchema = credentialsSchema.pick({ email: true })

export const registerSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1, '请输入昵称').max(40, '昵称不能超过 40 个字符'),
})

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, '密码至少 8 位'),
    confirmPassword: z.string().min(1, '请再次输入密码'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  })

export type Credentials = z.infer<typeof credentialsSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type EmailValues = z.infer<typeof emailSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { env } from '../../lib/env'
import { supabase } from '../../lib/supabase'
import { getAuthErrorMessage } from './auth-errors'
import { emailSchema, type EmailValues } from './auth.schemas'

export function ForgotPasswordPage() {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailValues>({ resolver: zodResolver(emailSchema) })

  const submit = handleSubmit(async ({ email }) => {
    setSubmitError(null)
    try {
      const origin = env.VITE_PUBLIC_APP_ORIGIN.replace(/\/+$/, '')
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      })
      if (error) {
        setSubmitError(getAuthErrorMessage(error))
        return
      }
      setSuccess(true)
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error))
    }
  })

  return (
    <main>
      <h1>忘记密码</h1>
      {success ? (
        <p role="status">如果该邮箱已注册，你将收到一封密码重置邮件。</p>
      ) : (
        <form onSubmit={submit} noValidate>
          <label htmlFor="forgot-email">邮箱</label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'forgot-email-error' : undefined}
            {...register('email')}
          />
          {errors.email ? <p id="forgot-email-error" role="alert">{errors.email.message}</p> : null}
          {submitError ? <ResponsiveOperationError message={submitError} /> : null}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '发送中…' : '发送重置邮件'}
          </button>
        </form>
      )}
      <Link to="/login">返回登录</Link>
    </main>
  )
}

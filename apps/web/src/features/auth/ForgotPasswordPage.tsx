import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { publicAppOrigin } from '../../lib/env'
import { supabase } from '../../lib/supabase'
import { getAuthErrorMessage } from './auth-errors'
import { emailSchema, type EmailValues } from './auth.schemas'
import { AuthField, AuthOptions, AuthPageFrame, AuthSubmitButton } from './AuthFormPrimitives'

export function ForgotPasswordPage() {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    mode: 'onChange',
  })

  const submit = handleSubmit(async ({ email }) => {
    setSubmitError(null)
    try {
      const origin = publicAppOrigin()
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
    <AuthPageFrame title="忘记密码" subtitle="输入注册邮箱，我们会向你发送密码重置链接。">
      {success ? (
        <div className="auth-success">
          <p role="status">如果该邮箱已注册，你将收到一封密码重置邮件。</p>
          <Link className="auth-secondary-link" to="/login">返回登录</Link>
        </div>
      ) : (
        <>
          <form className="auth-forgot-form" onSubmit={submit} noValidate>
            <AuthField id="forgot-email" label="邮箱" error={errors.email?.message}>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="请输入邮箱地址"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'forgot-email-error' : undefined}
                {...register('email')}
              />
            </AuthField>
            {submitError ? <ResponsiveOperationError message={submitError} /> : null}
            <AuthSubmitButton
              disabled={!isValid}
              pending={isSubmitting}
              label="发送重置邮件"
              pendingLabel="发送中…"
            />
          </form>
          <AuthOptions>
            <Link to="/login">返回登录</Link>
          </AuthOptions>
        </>
      )}
    </AuthPageFrame>
  )
}

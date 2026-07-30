import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getAuthErrorMessage } from './auth-errors'
import { useAuth } from './auth-context'
import { completePasswordRecovery } from './auth-session-store'
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from './auth.schemas'

export function ResetPasswordPage() {
  const { session, loading, isPasswordRecovery } = useAuth()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const submit = handleSubmit(async ({ password }) => {
    setSubmitError(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setSubmitError(getAuthErrorMessage(error))
        return
      }
      completePasswordRecovery()
      navigate('/app', { replace: true })
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error))
    }
  })

  if (loading) return <p role="status">正在验证重置链接…</p>
  if (!session || !isPasswordRecovery) {
    return (
      <main>
        <h1>重置密码</h1>
        <p role="alert">重置链接无效或已过期，请重新申请。</p>
        <Link to="/forgot-password">重新申请重置邮件</Link>
      </main>
    )
  }

  return (
    <main>
      <h1>重置密码</h1>
      <form onSubmit={submit} noValidate>
        <label htmlFor="reset-password">新密码</label>
        <input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'reset-password-error' : undefined}
          {...register('password')}
        />
        {errors.password ? <p id="reset-password-error" role="alert">{errors.password.message}</p> : null}

        <label htmlFor="reset-confirm-password">确认新密码</label>
        <input
          id="reset-confirm-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword)}
          aria-describedby={errors.confirmPassword ? 'reset-confirm-password-error' : undefined}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword ? (
          <p id="reset-confirm-password-error" role="alert">{errors.confirmPassword.message}</p>
        ) : null}

        {submitError ? <p role="alert">{submitError}</p> : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '保存中…' : '保存新密码'}
        </button>
      </form>
    </main>
  )
}

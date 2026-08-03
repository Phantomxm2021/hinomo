import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { supabase } from '../../lib/supabase'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { getAuthErrorMessage } from './auth-errors'
import { useAuth } from './auth-context'
import { completePasswordRecovery } from './auth-session-store'
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from './auth.schemas'
import { AuthField, AuthOptions, AuthPageFrame, AuthSubmitButton } from './AuthFormPrimitives'

export function ResetPasswordPage() {
  const { session, loading, isPasswordRecovery } = useAuth()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
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

  if (loading) {
    return (
      <AuthPageFrame title="重置密码" subtitle="正在验证重置链接，请稍候。">
        <SkeletonGroup className="grid w-full gap-5" label="正在验证重置链接">
          <div className="grid gap-3 rounded-shell border border-line bg-surface p-5">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        </SkeletonGroup>
      </AuthPageFrame>
    )
  }
  if (!session || !isPasswordRecovery) {
    return (
      <AuthPageFrame title="重置密码" subtitle="该重置请求无法继续。">
        <ResponsiveOperationError message="重置链接无效或已过期，请重新申请。" />
        <AuthOptions>
          <Link to="/login">返回登录</Link>
          <Link to="/forgot-password">重新申请</Link>
        </AuthOptions>
      </AuthPageFrame>
    )
  }

  return (
    <AuthPageFrame title="重置密码" subtitle="设置至少 8 位的新密码。">
      <form className="auth-reset-form" onSubmit={submit} noValidate>
        <AuthField id="reset-password" label="新密码" error={errors.password?.message}>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            placeholder="请输入至少 8 位密码"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'reset-password-error' : undefined}
            {...register('password')}
          />
        </AuthField>

        <AuthField id="reset-confirm-password" label="确认新密码" error={errors.confirmPassword?.message}>
          <input
            id="reset-confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="请再次输入新密码"
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? 'reset-confirm-password-error' : undefined}
            {...register('confirmPassword')}
          />
        </AuthField>

        {submitError ? <ResponsiveOperationError message={submitError} /> : null}
        <AuthSubmitButton
          disabled={!isValid}
          pending={isSubmitting}
          label="保存新密码"
          pendingLabel="保存中…"
        />
      </form>
    </AuthPageFrame>
  )
}

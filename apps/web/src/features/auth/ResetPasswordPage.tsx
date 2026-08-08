import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { useI18n } from '../../i18n/I18nProvider'
import { supabase } from '../../lib/supabase'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { getAuthErrorMessage } from './auth-errors'
import { useAuth } from './auth-context'
import { completePasswordRecovery } from './auth-session-store'
import { createResetPasswordSchema, type ResetPasswordValues } from './auth.schemas'
import { AuthField, AuthOptions, AuthPageFrame, AuthSubmitButton } from './AuthFormPrimitives'

export function ResetPasswordPage() {
  const { t } = useI18n()
  const { session, loading, isPasswordRecovery } = useAuth()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(createResetPasswordSchema(t)),
    mode: 'onChange',
  })

  const submit = handleSubmit(async ({ password }) => {
    setSubmitError(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setSubmitError(getAuthErrorMessage(error, t))
        return
      }
      completePasswordRecovery()
      navigate('/app', { replace: true })
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error, t))
    }
  })

  if (loading) {
    return (
      <AuthPageFrame title={t('auth.resetPassword.title')} subtitle={t('auth.resetLoadingDescription')}>
        <SkeletonGroup className="grid w-full gap-5" label={t('auth.loading')}>
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
      <AuthPageFrame title={t('auth.resetPassword.title')} subtitle={t('auth.resetInvalid')}>
        <ResponsiveOperationError message={t('auth.resetInvalidDescription')} />
        <AuthOptions>
          <Link to="/login">{t('auth.login.submit')}</Link>
          <Link to="/forgot-password">{t('auth.forgotPassword.title')}</Link>
        </AuthOptions>
      </AuthPageFrame>
    )
  }

  return (
    <AuthPageFrame title={t('auth.resetPassword.title')} subtitle={t('auth.resetPasswordDescription')}>
      <form className="auth-reset-form" onSubmit={submit} noValidate>
        <AuthField id="reset-password" label={t('auth.newPassword')} error={errors.password?.message}>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            placeholder={t('auth.newPasswordPlaceholder')}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'reset-password-error' : undefined}
            {...register('password')}
          />
        </AuthField>

        <AuthField id="reset-confirm-password" label={t('auth.confirmNewPassword')} error={errors.confirmPassword?.message}>
          <input
            id="reset-confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder={t('auth.confirmNewPasswordPlaceholder')}
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? 'reset-confirm-password-error' : undefined}
            {...register('confirmPassword')}
          />
        </AuthField>

        {submitError ? <ResponsiveOperationError message={submitError} /> : null}
        <AuthSubmitButton
          disabled={!isValid}
          pending={isSubmitting}
          label={t('auth.resetPassword.submit')}
          pendingLabel={t('auth.pending.resetPassword')}
        />
      </form>
    </AuthPageFrame>
  )
}

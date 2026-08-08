import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { useI18n } from '../../i18n/I18nProvider'
import { supabase } from '../../lib/supabase'
import { getAuthErrorMessage } from './auth-errors'
import { createCredentialsSchema, type Credentials } from './auth.schemas'
import { AuthField, AuthOptions, AuthPageFrame, AuthSubmitButton } from './AuthFormPrimitives'

function safeReturnTo(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/app'
}

export function LoginPage() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<Credentials>({
    resolver: zodResolver(createCredentialsSchema(t)),
    mode: 'onChange',
  })

  const submit = handleSubmit(async (credentials) => {
    setSubmitError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword(credentials)
      if (error) {
        setSubmitError(getAuthErrorMessage(error, t))
        return
      }

      const state = location.state as { returnTo?: unknown } | null
      navigate(safeReturnTo(state?.returnTo), { replace: true })
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error, t))
    }
  })

  return (
    <AuthPageFrame title={t('auth.login.title')} subtitle={t('auth.login.subtitle')}>
      <form className="auth-login-form" onSubmit={submit} noValidate>
        <AuthField id="login-email" label={t('auth.fields.email')} error={errors.email?.message}>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder={t('auth.fields.emailPlaceholder')}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            {...register('email')}
          />
        </AuthField>

        <AuthField id="login-password" label={t('auth.fields.password')} error={errors.password?.message}>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder={t('auth.fields.passwordPlaceholder')}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            {...register('password')}
          />
        </AuthField>

        {submitError ? <ResponsiveOperationError message={submitError} /> : null}
        <AuthSubmitButton
          disabled={!isValid}
          pending={isSubmitting}
          label={t('auth.login.submit')}
          pendingLabel={t('auth.pending.login')}
        />
      </form>
      <AuthOptions>
        <Link to="/register">{t('auth.login.register')}</Link>
        <Link to="/forgot-password">{t('auth.forgotPassword.title')}</Link>
      </AuthOptions>
    </AuthPageFrame>
  )
}

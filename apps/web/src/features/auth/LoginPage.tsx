import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { useI18n } from '../../i18n/I18nProvider'
import { supabase } from '../../lib/supabase'
import { getAuthErrorKey, type AuthErrorKey } from './auth-errors'
import { createCredentialsSchema, type Credentials } from './auth.schemas'
import { AuthField, AuthOptions, AuthPageFrame, AuthSubmitButton } from './AuthFormPrimitives'
import { useLocalizedFormValidation } from './useLocalizedFormValidation'

function safeReturnTo(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/app'
}

export function LoginPage() {
  const { locale, t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [submitErrorKey, setSubmitErrorKey] = useState<AuthErrorKey | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting, isValid, touchedFields },
  } = useForm<Credentials>({
    resolver: zodResolver(createCredentialsSchema(t)),
    mode: 'onChange',
  })

  useLocalizedFormValidation({
    locale,
    trigger,
    touchedFields,
    errorFields: errors,
    submitAttempted,
  })

  const submit = handleSubmit(async (credentials) => {
    setSubmitErrorKey(null)
    try {
      const { error } = await supabase.auth.signInWithPassword(credentials)
      if (error) {
        setSubmitErrorKey(getAuthErrorKey(error))
        return
      }

      const state = location.state as { returnTo?: unknown } | null
      navigate(safeReturnTo(state?.returnTo), { replace: true })
    } catch (error) {
      setSubmitErrorKey(getAuthErrorKey(error))
    }
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    setSubmitAttempted(true)
    void submit(event)
  }

  return (
    <AuthPageFrame title={t('auth.login.title')} subtitle={t('auth.login.subtitle')}>
      <form className="auth-login-form" onSubmit={onSubmit} noValidate>
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

        {submitErrorKey ? <ResponsiveOperationError message={t(submitErrorKey)} /> : null}
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

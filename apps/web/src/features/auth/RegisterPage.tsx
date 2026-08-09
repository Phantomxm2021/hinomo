import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { useI18n } from '../../i18n/I18nProvider'
import { supabase } from '../../lib/supabase'
import { LEGAL_POLICY_VERSION } from '../legal/legal-policy'
import { getAuthErrorKey, type AuthErrorKey } from './auth-errors'
import { createRegisterSchema, type RegisterValues } from './auth.schemas'
import { AuthField, AuthOptions, AuthPageFrame, AuthSubmitButton } from './AuthFormPrimitives'
import { useLocalizedFormValidation } from './useLocalizedFormValidation'
import { safeReturnTo } from './safe-return-to'

export function RegisterPage() {
  const { locale, t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const returnTo = safeReturnTo((location.state as { returnTo?: unknown } | null)?.returnTo)
  const [submitErrorKey, setSubmitErrorKey] = useState<AuthErrorKey | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting, isValid, touchedFields },
  } = useForm<RegisterValues>({
    resolver: zodResolver(createRegisterSchema(t)),
    mode: 'onChange',
    defaultValues: { acceptLegal: false },
  })

  useLocalizedFormValidation({
    locale,
    trigger,
    touchedFields,
    errorFields: errors,
    submitAttempted,
  })

  const submit = handleSubmit(async ({ displayName, email, password }) => {
    setSubmitErrorKey(null)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            legal_acceptance: {
              terms_version: LEGAL_POLICY_VERSION,
              privacy_version: LEGAL_POLICY_VERSION,
              accepted_at: new Date().toISOString(),
            },
          },
        },
      })
      if (error) {
        setSubmitErrorKey(getAuthErrorKey(error))
        return
      }
      if (data.session) {
        navigate(returnTo, { replace: true })
        return
      }
      setSuccess(true)
    } catch (error) {
      setSubmitErrorKey(getAuthErrorKey(error))
    }
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    setSubmitAttempted(true)
    void submit(event)
  }

  return (
    <AuthPageFrame title={t('auth.register.title')} subtitle={t('auth.register.subtitle')}>
      {success ? (
        <div className="auth-register-success">
          <p role="status">{t('auth.success.register')}</p>
          <Link className="auth-secondary-link" to="/login" state={{ returnTo }}>{t('auth.register.signIn')}</Link>
        </div>
      ) : (
        <>
          <form className="auth-register-form" onSubmit={onSubmit} noValidate>
          <AuthField id="register-display-name" label={t('auth.fields.nickname')} error={errors.displayName?.message}>
            <input
              id="register-display-name"
              type="text"
              autoComplete="nickname"
              placeholder={t('auth.fields.nicknamePlaceholder')}
              aria-invalid={Boolean(errors.displayName)}
              aria-describedby={errors.displayName ? 'register-display-name-error' : undefined}
              {...register('displayName')}
            />
          </AuthField>

          <AuthField id="register-email" label={t('auth.fields.email')} error={errors.email?.message}>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              placeholder={t('auth.fields.emailPlaceholder')}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'register-email-error' : undefined}
              {...register('email')}
            />
          </AuthField>

          <AuthField id="register-password" label={t('auth.fields.password')} error={errors.password?.message}>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              placeholder={t('auth.fields.passwordPlaceholder')}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'register-password-error' : undefined}
              {...register('password')}
            />
          </AuthField>

          <div className="auth-legal-consent">
            <label htmlFor="register-accept-legal">
              <input
                id="register-accept-legal"
                type="checkbox"
                aria-invalid={Boolean(errors.acceptLegal)}
                aria-describedby={errors.acceptLegal ? 'register-accept-legal-error' : undefined}
                {...register('acceptLegal')}
              />
                <span>
                {t('auth.legal.consentPrefix')}{' '}
                <Link to={`/legal/terms?lang=${locale}`} target="_blank" rel="noreferrer">
                  {locale === 'zh-CN' ? `《${t('auth.register.terms')}》` : t('auth.register.terms')}
                </Link>
                {' '}{t('auth.register.and')}{' '}
                <Link to={`/legal/privacy?lang=${locale}`} target="_blank" rel="noreferrer">
                  {locale === 'zh-CN' ? `《${t('auth.register.privacy')}》` : t('auth.register.privacy')}
                </Link>
              </span>
            </label>
            {errors.acceptLegal ? (
              <p id="register-accept-legal-error" role="alert">{errors.acceptLegal.message}</p>
            ) : null}
          </div>

          {submitErrorKey ? <ResponsiveOperationError message={t(submitErrorKey)} /> : null}
          <AuthSubmitButton
            disabled={!isValid}
            pending={isSubmitting}
            label={t('auth.register.submit')}
            pendingLabel={t('auth.pending.register')}
          />
          </form>
          <AuthOptions>
            <span>{t('auth.register.hasAccount')}</span>
            <Link to="/login" state={{ returnTo }}>{t('auth.register.signIn')}</Link>
          </AuthOptions>
        </>
      )}
    </AuthPageFrame>
  )
}

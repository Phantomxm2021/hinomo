import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { useI18n } from '../../i18n/I18nProvider'
import { publicAppOrigin } from '../../lib/env'
import { supabase } from '../../lib/supabase'
import { getAuthErrorKey, type AuthErrorKey } from './auth-errors'
import { createEmailSchema, type EmailValues } from './auth.schemas'
import { AuthField, AuthOptions, AuthPageFrame, AuthSubmitButton } from './AuthFormPrimitives'
import { useLocalizedFormValidation } from './useLocalizedFormValidation'

export function ForgotPasswordPage() {
  const { locale, t } = useI18n()
  const [submitErrorKey, setSubmitErrorKey] = useState<AuthErrorKey | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting, isValid, touchedFields },
  } = useForm<EmailValues>({
    resolver: zodResolver(createEmailSchema(t)),
    mode: 'onChange',
  })

  useLocalizedFormValidation({
    locale,
    trigger,
    touchedFields,
    errorFields: errors,
    submitAttempted,
  })

  const submit = handleSubmit(async ({ email }) => {
    setSubmitErrorKey(null)
    try {
      const origin = publicAppOrigin()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      })
      if (error) {
        setSubmitErrorKey(getAuthErrorKey(error))
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
    <AuthPageFrame title={t('auth.forgotPassword.title')} subtitle={t('auth.forgotPassword.subtitle')}>
      {success ? (
        <div className="auth-success">
          <p role="status">{t('auth.success.forgotPassword')}</p>
          <Link className="auth-secondary-link" to="/login">{t('auth.forgotPassword.signIn')}</Link>
        </div>
      ) : (
        <>
          <form className="auth-forgot-form" onSubmit={onSubmit} noValidate>
            <AuthField id="forgot-email" label={t('auth.fields.email')} error={errors.email?.message}>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder={t('auth.fields.emailPlaceholder')}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'forgot-email-error' : undefined}
                {...register('email')}
              />
            </AuthField>
            {submitErrorKey ? <ResponsiveOperationError message={t(submitErrorKey)} /> : null}
            <AuthSubmitButton
              disabled={!isValid}
              pending={isSubmitting}
              label={t('auth.forgotPassword.submit')}
              pendingLabel={t('auth.pending.forgotPassword')}
            />
          </form>
          <AuthOptions>
            <Link to="/login">{t('auth.forgotPassword.signIn')}</Link>
          </AuthOptions>
        </>
      )}
    </AuthPageFrame>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { supabase } from '../../lib/supabase'
import { LEGAL_POLICY_VERSION } from '../legal/legal-policy'
import { getAuthErrorMessage } from './auth-errors'
import { registerSchema, type RegisterValues } from './auth.schemas'
import { AuthField, AuthOptions, AuthPageFrame, AuthSubmitButton } from './AuthFormPrimitives'

export function RegisterPage() {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: { acceptLegal: false },
  })

  const submit = handleSubmit(async ({ displayName, email, password }) => {
    setSubmitError(null)
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
        setSubmitError(getAuthErrorMessage(error))
        return
      }
      if (data.session) {
        navigate('/app', { replace: true })
        return
      }
      setSuccess(true)
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error))
    }
  })

  return (
    <AuthPageFrame title="创建账号" subtitle="用昵称建立属于你的家庭收纳空间。">
      {success ? (
        <div className="auth-register-success">
          <p role="status">注册成功，请查收验证邮件后登录。</p>
          <Link className="auth-secondary-link" to="/login">返回登录</Link>
        </div>
      ) : (
        <>
          <form className="auth-register-form" onSubmit={submit} noValidate>
          <AuthField id="register-display-name" label="昵称" error={errors.displayName?.message}>
            <input
              id="register-display-name"
              type="text"
              autoComplete="nickname"
              placeholder="怎么称呼你"
              aria-invalid={Boolean(errors.displayName)}
              aria-describedby={errors.displayName ? 'register-display-name-error' : undefined}
              {...register('displayName')}
            />
          </AuthField>

          <AuthField id="register-email" label="邮箱" error={errors.email?.message}>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              placeholder="请输入邮箱地址"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'register-email-error' : undefined}
              {...register('email')}
            />
          </AuthField>

          <AuthField id="register-password" label="密码" error={errors.password?.message}>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              placeholder="请输入至少 8 位密码"
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
                我已阅读并同意
                <Link to="/legal/terms?lang=zh-CN" target="_blank" rel="noreferrer">《服务条款》</Link>
                和
                <Link to="/legal/privacy?lang=zh-CN" target="_blank" rel="noreferrer">《隐私政策》</Link>
              </span>
            </label>
            {errors.acceptLegal ? (
              <p id="register-accept-legal-error" role="alert">{errors.acceptLegal.message}</p>
            ) : null}
          </div>

          {submitError ? <ResponsiveOperationError message={submitError} /> : null}
          <AuthSubmitButton
            disabled={!isValid}
            pending={isSubmitting}
            label="注册"
            pendingLabel="注册中…"
          />
          </form>
          <AuthOptions>
            <span>已经有账号？</span>
            <Link to="/login">返回登录</Link>
          </AuthOptions>
        </>
      )}
    </AuthPageFrame>
  )
}

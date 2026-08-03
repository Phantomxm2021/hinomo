import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { supabase } from '../../lib/supabase'
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
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })

  const submit = handleSubmit(async ({ displayName, ...credentials }) => {
    setSubmitError(null)
    try {
      const { data, error } = await supabase.auth.signUp({
        ...credentials,
        options: { data: { display_name: displayName } },
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
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'register-password-error' : undefined}
              {...register('password')}
            />
          </AuthField>

          {submitError ? <ResponsiveOperationError message={submitError} /> : null}
          <AuthSubmitButton pending={isSubmitting} label="注册" pendingLabel="注册中…" />
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

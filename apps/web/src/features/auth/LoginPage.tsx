import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { supabase } from '../../lib/supabase'
import { getAuthErrorMessage } from './auth-errors'
import { credentialsSchema, type Credentials } from './auth.schemas'
import { AuthField, AuthOptions, AuthPageFrame, AuthSubmitButton } from './AuthFormPrimitives'

function safeReturnTo(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/app'
}

export function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Credentials>({ resolver: zodResolver(credentialsSchema) })

  const submit = handleSubmit(async (credentials) => {
    setSubmitError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword(credentials)
      if (error) {
        setSubmitError(getAuthErrorMessage(error))
        return
      }

      const state = location.state as { returnTo?: unknown } | null
      navigate(safeReturnTo(state?.returnTo), { replace: true })
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error))
    }
  })

  return (
    <AuthPageFrame title="欢迎回来" subtitle="登录后继续整理和查找你的物品。">
      <form className="auth-login-form" onSubmit={submit} noValidate>
        <AuthField id="login-email" label="邮箱" error={errors.email?.message}>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            {...register('email')}
          />
        </AuthField>

        <AuthField id="login-password" label="密码" error={errors.password?.message}>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="输入密码"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            {...register('password')}
          />
        </AuthField>

        {submitError ? <ResponsiveOperationError message={submitError} /> : null}
        <AuthSubmitButton pending={isSubmitting} label="登录" pendingLabel="登录中…" />
      </form>
      <AuthOptions>
        <Link to="/register">注册账号</Link>
        <Link to="/forgot-password">忘记密码</Link>
      </AuthOptions>
    </AuthPageFrame>
  )
}

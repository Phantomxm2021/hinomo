import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getAuthErrorMessage } from './auth-errors'
import { credentialsSchema, type Credentials } from './auth.schemas'

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
    <main>
      <h1>登录</h1>
      <form onSubmit={submit} noValidate>
        <label htmlFor="login-email">邮箱</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          {...register('email')}
        />
        {errors.email ? <p id="login-email-error" role="alert">{errors.email.message}</p> : null}

        <label htmlFor="login-password">密码</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          {...register('password')}
        />
        {errors.password ? <p id="login-password-error" role="alert">{errors.password.message}</p> : null}

        {submitError ? <p role="alert">{submitError}</p> : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '登录中…' : '登录'}
        </button>
      </form>
      <nav aria-label="认证选项">
        <Link to="/register">注册账号</Link>
        <Link to="/forgot-password">忘记密码</Link>
      </nav>
    </main>
  )
}

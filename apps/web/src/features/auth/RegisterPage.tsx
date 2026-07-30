import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getAuthErrorMessage } from './auth-errors'
import { credentialsSchema, type Credentials } from './auth.schemas'

export function RegisterPage() {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Credentials>({ resolver: zodResolver(credentialsSchema) })

  const submit = handleSubmit(async (credentials) => {
    setSubmitError(null)
    try {
      const { data, error } = await supabase.auth.signUp(credentials)
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
    <main>
      <h1>注册</h1>
      {success ? (
        <p role="status">注册成功，请查收验证邮件后登录。</p>
      ) : (
        <form onSubmit={submit} noValidate>
          <label htmlFor="register-email">邮箱</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'register-email-error' : undefined}
            {...register('email')}
          />
          {errors.email ? <p id="register-email-error" role="alert">{errors.email.message}</p> : null}

          <label htmlFor="register-password">密码</label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'register-password-error' : undefined}
            {...register('password')}
          />
          {errors.password ? <p id="register-password-error" role="alert">{errors.password.message}</p> : null}

          {submitError ? <p role="alert">{submitError}</p> : null}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '注册中…' : '注册'}
          </button>
        </form>
      )}
      <Link to="/login">返回登录</Link>
    </main>
  )
}

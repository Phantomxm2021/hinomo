import { useLocation } from 'react-router-dom'

export function PlaceholderPage({ title }: { title: string }) {
  return <h1>{title}</h1>
}

export function LoginPlaceholder() {
  const location = useLocation()
  const state = location.state as { returnTo?: string } | null

  return (
    <>
      <h1>登录</h1>
      {state?.returnTo ? (
        <span data-testid="return-to">{state.returnTo}</span>
      ) : null}
    </>
  )
}

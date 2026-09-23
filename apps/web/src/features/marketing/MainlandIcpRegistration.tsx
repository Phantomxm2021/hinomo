import { useEffect, useState } from 'react'

export function MainlandIcpRegistration() {
  const [isMainlandChina, setIsMainlandChina] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/geo', { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ country?: unknown }> : null)
      .then((result) => setIsMainlandChina(result?.country === 'CN'))
      .catch(() => {})

    return () => controller.abort()
  }, [])

  if (!isMainlandChina) return null

  return <a className="text-inherit no-underline transition hover:text-white" href="https://beian.miit.gov.cn/">闽ICP备2021006184号-5</a>
}

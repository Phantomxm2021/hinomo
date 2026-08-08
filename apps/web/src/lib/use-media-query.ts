import { useEffect, useState } from 'react'

function getMatches(query: string) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(query).matches
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => getMatches(query))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setMatches(false)
      return
    }

    const mediaQuery = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    setMatches(mediaQuery.matches)
    mediaQuery.addEventListener?.('change', onChange)
    if (!mediaQuery.addEventListener) mediaQuery.addListener(onChange)

    return () => {
      mediaQuery.removeEventListener?.('change', onChange)
      if (!mediaQuery.removeEventListener) mediaQuery.removeListener(onChange)
    }
  }, [query])

  return matches
}

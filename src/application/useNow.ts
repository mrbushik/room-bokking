import { useEffect, useState } from 'react'
import type { Clock } from '../domain/time'

export function useNow(clock: Clock): Date {
  const [now, setNow] = useState(() => clock.now())
  useEffect(() => {
    const update = () => setNow(clock.now())
    const interval = window.setInterval(update, 1000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [clock])
  return now
}

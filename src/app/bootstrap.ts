import { createBookingsApi } from '../api/client'
import { systemClock } from '../domain/time'

export async function bootstrap() {
  const mode: string | undefined = import.meta.env.VITE_API_MODE
  const base: string | undefined = import.meta.env.VITE_API_BASE_URL
  if ((mode !== 'mock' && mode !== 'real') || !base) throw new Error('Не задан корректный режим API. Используйте development или сборку --mode demo.')
  const url = new URL(base, window.location.origin)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Некорректный адрес API.')
  if (mode === 'mock') {
    const { startMockApi } = await import('../mocks/browser')
    await startMockApi()
  }
  return { api: createBookingsApi(url.href), clock: systemClock }
}

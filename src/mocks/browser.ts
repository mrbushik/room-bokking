import { setupWorker } from 'msw/browser'
import { systemClock } from '../domain/time'
import { isRecord } from '../domain/booking'
import { createHandlers } from './handlers'
import { createRepository } from './repository'

let start: Promise<unknown> | undefined

export async function startMockApi(): Promise<void> {
  if (!start) {
    const worker = setupWorker(...createHandlers(createRepository(window.localStorage), systemClock))
    start = worker.start({
      quiet: true,
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
      onUnhandledFrame({ frame }) {
        if (frame.protocol === 'http' && isRecord(frame.data) && frame.data.request instanceof Request && new URL(frame.data.request.url).pathname.startsWith('/api/')) {
          throw new Error('Неперехваченный запрос mock API.')
        }
      },
    }).catch(error => {
      worker.stop()
      start = undefined
      throw error
    })
  }
  await start
}

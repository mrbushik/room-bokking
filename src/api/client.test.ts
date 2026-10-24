import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBookingsApi } from './client'
import { createQueryClient } from '../app/queryClient'

afterEach(() => vi.unstubAllGlobals())

describe('HTTP response failures', () => {
  it('does not retry a malformed JSON response', async () => {
    const fetchMock = vi.fn(async () => new Response('{invalid json'))
    vi.stubGlobal('fetch', fetchMock)
    const client = createQueryClient()
    try {
      await expect(client.fetchQuery({ queryKey: ['invalid-json'], queryFn: () => createBookingsApi('http://localhost/api').list('2026-10-25'), retryDelay: 0 })).rejects.toMatchObject({ kind: 'protocol' })
      expect(fetchMock).toHaveBeenCalledOnce()
    } finally { client.clear() }
  })

  it('retries GET once if the response stream fails after headers arrive', async () => {
    let attempt = 0
    const fetchMock = vi.fn(async () => ++attempt === 1
      ? new Response(new ReadableStream({ start(controller) { controller.error(new TypeError('Connection terminated')) } }))
      : Response.json({ data: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createQueryClient()
    try {
      await expect(client.fetchQuery({ queryKey: ['stream-failure'], queryFn: () => createBookingsApi('http://localhost/api').list('2026-10-25'), retryDelay: 0 })).resolves.toEqual([])
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally { client.clear() }
  })

  it('preserves cancellation while reading a response body', async () => {
    const controller = new AbortController()
    const aborted = new DOMException('The operation was aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => { controller.abort(); throw aborted },
    })))
    await expect(createBookingsApi('http://localhost/api').list('2026-10-25', controller.signal)).rejects.toBe(aborted)
  })
})

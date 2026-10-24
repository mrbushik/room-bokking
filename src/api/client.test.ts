import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBookingsApi } from './client'

afterEach(() => vi.unstubAllGlobals())

describe('HTTP cancellation', () => {
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

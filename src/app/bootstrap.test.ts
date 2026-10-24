// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bootstrap } from './bootstrap'
import { startMockApi } from '../mocks/browser'

vi.mock('../mocks/browser', () => ({ startMockApi: vi.fn() }))
beforeEach(() => {
  vi.stubEnv('VITE_API_MODE', 'mock')
  vi.stubEnv('VITE_API_BASE_URL', '/api')
})
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks() })

describe('bootstrap mode contract', () => {
  it('does not expose the API until worker startup finishes', async () => {
    let release = () => {}
    const gate = new Promise<void>(resolve => { release = resolve })
    vi.mocked(startMockApi).mockReturnValue(gate)
    let ready = false
    const result = bootstrap().then(dependencies => { ready = true; return dependencies })
    await vi.waitFor(() => expect(startMockApi).toHaveBeenCalledOnce())
    expect(ready).toBe(false)
    release()
    expect((await result).api.list).toBeTypeOf('function')
  })
  it('propagates registration failure without fallback and permits retry', async () => {
    vi.mocked(startMockApi).mockRejectedValueOnce(new Error('Registration failed')).mockResolvedValueOnce()
    await expect(bootstrap()).rejects.toThrow('Registration failed')
    await expect(bootstrap()).resolves.toHaveProperty('api')
    expect(startMockApi).toHaveBeenCalledTimes(2)
  })
  it('does not initialize MSW in real mode', async () => {
    vi.stubEnv('VITE_API_MODE', 'real')
    await expect(bootstrap()).resolves.toHaveProperty('api')
    expect(startMockApi).not.toHaveBeenCalled()
  })
  it.each(['', 'unknown'])('rejects invalid mode %j', async mode => {
    vi.stubEnv('VITE_API_MODE', mode)
    await expect(bootstrap()).rejects.toThrow('режим API')
    expect(startMockApi).not.toHaveBeenCalled()
  })
  it('rejects a non-HTTP base URL', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'file:///api')
    await expect(bootstrap()).rejects.toThrow('адрес API')
    expect(startMockApi).not.toHaveBeenCalled()
  })
})

/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

type WorkerMessage = { data: string; source: { id: string }; waitUntil: (task: Promise<unknown>) => void }

describe('generated worker notification lifetime', () => {
  it.each(['MOCK_ACTIVATE', 'KEEPALIVE_REQUEST', 'INTEGRITY_CHECK_REQUEST'])('%s finishes without a client acknowledgement', async type => {
    const source = readFileSync(process.env.MSW_WORKER_TEST_PATH ?? 'public/mockServiceWorker.js', 'utf8')
    let listener: ((event: WorkerMessage) => unknown) | undefined
    const tasks: Promise<unknown>[] = []
    const notifications: unknown[] = []
    const client = { id: 'room-booking-test', postMessage: (message: unknown) => notifications.push(message) }
    runInNewContext(source, {
      addEventListener: (name: string, callback: typeof listener) => { if (name === 'message') listener = callback },
      self: { clients: { get: async () => client, matchAll: async () => [client] } },
      MessageChannel: class { port1 = { onmessage: null }; port2 = {} },
    })
    await listener!({ data: type, source: { id: client.id }, waitUntil: task => { tasks.push(task) } })
    let timer: ReturnType<typeof setTimeout> | undefined
    const finished = await Promise.race([
      Promise.all(tasks).then(() => true),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 50) }),
    ])
    clearTimeout(timer)
    expect(notifications).toHaveLength(1)
    // These notifications have no response; an unresolved waitUntil keeps the
    // event alive until the browser's lifetime deadline terminates the worker.
    expect(finished).toBe(true)
  })
})

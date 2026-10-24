import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { createHandlers } from './handlers'
import { createRepository } from './repository'
import { memoryStorage, testClock } from '../test/fixtures'
import { createBookingsApi } from '../api/client'

const server = setupServer()
const clock = testClock()
const api = createBookingsApi('http://localhost/api')
const input = { date: '2026-10-24', start: '10:00', end: '11:00', title: ' Команда ' }
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
beforeEach(() => {
  clock.set(new Date(2026, 9, 24, 8))
  server.use(...createHandlers(createRepository(memoryStorage()), clock))
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('HTTP contract', () => {
  it('CRUD, partial PATCH, title clearing, self exclusion and date transfer', async () => {
    const a = await api.create(input)
    expect(a.title).toBe('Команда')
    expect(await api.list(input.date)).toEqual([a])
    expect(await api.update(a.id, { start: a.start, end: a.end })).toEqual(a)
    const moved = await api.update(a.id, { date: '2026-10-25', title: '' })
    expect(moved.id).toBe(a.id)
    expect(moved).not.toHaveProperty('title')
    expect(await api.list(input.date)).toEqual([])
    expect(await api.list(moved.date)).toEqual([moved])
    await api.remove(a.id)
    expect(await api.list(moved.date)).toEqual([])
  })
  it('allows touching but rejects a real conflict without changing data', async () => {
    await api.create(input)
    await api.create({ ...input, start: '11:00', end: '11:30' })
    await expect(api.create({ ...input, start: '10:30', end: '11:00' })).rejects.toMatchObject({ status: 409, code: 'BOOKING_CONFLICT', kind: 'http' })
    expect(await api.list(input.date)).toHaveLength(2)
  })
  it('validates the target date during PATCH', async () => {
    const a = await api.create(input)
    await api.create({ ...input, date: '2026-10-25' })
    await expect(api.update(a.id, { date: '2026-10-25' })).rejects.toMatchObject({ status: 409 })
    expect(await api.list(input.date)).toEqual([a])
  })
  it('checks the current clock for both POST and PATCH', async () => {
    const a = await api.create(input)
    clock.set(new Date(2026, 9, 24, 10, 0, 0, 1))
    await expect(api.create(input)).rejects.toMatchObject({ status: 422 })
    await expect(api.update(a.id, { title: 'Only title' })).rejects.toMatchObject({ status: 422 })
  })
  it('serializes actual simultaneous conflicting requests', async () => {
    const results = await Promise.allSettled([api.create(input), api.create(input)])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { status: 409 } })
    expect(await api.list(input.date)).toHaveLength(1)
  })
  it.each([{ ...input, start: '08:00' }, { ...input, end: '10:29' }, { ...input, end: '12:01' }, { ...input, end: '09:00' }, { ...input, date: '2026-02-30' }])('returns 422 without UI for %j', async body => {
    await expect(api.create(body)).rejects.toMatchObject({ status: 422, fieldErrors: expect.any(Object) })
    expect(await api.list(input.date)).toEqual([])
  })
  it.each([{ id: 'injected', ...input }, {}, { ...input, start: 900 }, { ...input, title: null }])('rejects malformed DTO %j', async body => {
    const response = await fetch('http://localhost/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    expect(response.status).toBe(400)
  })
  it('returns 400 for malformed JSON and missing date, 415 for text', async () => {
    expect((await fetch('http://localhost/api/bookings')).status).toBe(400)
    expect((await fetch('http://localhost/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status).toBe(400)
    expect((await fetch('http://localhost/api/bookings', { method: 'POST', body: 'text' })).status).toBe(415)
  })
  it('returns 404 for missing records and rejects empty PATCH', async () => {
    await expect(api.update('missing', { title: 'x' })).rejects.toMatchObject({ status: 404 })
    await expect(api.remove('missing')).rejects.toMatchObject({ status: 404 })
    await expect(api.update('missing', {})).rejects.toMatchObject({ status: 400 })
  })
  it('maps Storage failures to 500', async () => {
    server.resetHandlers(...createHandlers(createRepository({ getItem: () => null, setItem: () => { throw new Error('quota') } }), clock))
    await expect(api.create(input)).rejects.toMatchObject({ status: 500, code: 'STORAGE_ERROR' })
    expect(await api.list(input.date)).toEqual([])
  })
  it('does not trust malformed API responses', async () => {
    server.use(http.get('*/api/bookings', () => HttpResponse.json({ data: [{ id: 'x' }] })))
    await expect(api.list(input.date)).rejects.toMatchObject({ kind: 'protocol', code: 'INVALID_RESPONSE' })
  })
  it('distinguishes network failures', async () => {
    server.use(http.get('*/api/bookings', () => HttpResponse.error()))
    await expect(api.list(input.date)).rejects.toMatchObject({ kind: 'network' })
  })
})

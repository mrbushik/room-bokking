import { isBooking, isRecord, type FieldErrors } from '../domain/booking'
import { validateBookingFields } from '../domain/bookingRules'
import type { BookingsApi } from './contracts'
import { ApiError } from './errors'

function decodeFields(value: unknown): FieldErrors | undefined {
  if (!isRecord(value)) return undefined
  const result: FieldErrors = {}
  for (const field of ['date', 'start', 'end', 'title'] as const) {
    const messages = value[field]
    if (Array.isArray(messages) && messages.every(m => typeof m === 'string')) result[field] = messages
  }
  return result
}

export function createBookingsApi(baseUrl: string): BookingsApi {
  const base = baseUrl.replace(/\/$/, '')
  async function request(path: string, init?: RequestInit): Promise<unknown> {
    let response: Response
    try { response = await fetch(`${base}/bookings${path}`, init) }
    catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error
      throw new ApiError('Не удалось связаться с API. Проверьте соединение и повторите.', { kind: 'network', code: 'NETWORK_ERROR' })
    }
    let body: unknown
    try { body = response.status === 204 ? undefined : await response.json() }
    catch {
      throw new ApiError(response.ok ? 'API вернул некорректный ответ.' : 'API вернул ошибку в неизвестном формате.', { kind: response.ok ? 'protocol' : 'http', status: response.status, code: 'INVALID_RESPONSE' })
    }
    if (!response.ok) {
      const error = isRecord(body) && isRecord(body.error) ? body.error : undefined
      const fieldErrors = decodeFields(error?.fieldErrors)
      throw new ApiError(typeof error?.message === 'string' ? error.message : 'Не удалось выполнить запрос.', {
        kind: 'http', status: response.status, code: typeof error?.code === 'string' ? error.code : 'HTTP_ERROR',
        ...(fieldErrors ? { fieldErrors } : {}),
      })
    }
    return response.status === 204 ? undefined : isRecord(body) ? body.data : undefined
  }
  function invalid(): never { throw new ApiError('API вернул некорректные данные.', { kind: 'protocol', code: 'INVALID_RESPONSE' }) }
  function booking(value: unknown) {
    if (!isBooking(value) || validateBookingFields(value).length) return invalid()
    return value
  }
  const json = (method: string, data: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  return {
    async list(date, signal) {
      const data = await request(`?date=${encodeURIComponent(date)}`, signal ? { signal } : undefined)
      if (!Array.isArray(data)) return invalid()
      const result = data.map(booking)
      if (result.some(b => b.date !== date) || new Set(result.map(b => b.id)).size !== result.length) return invalid()
      return result
    },
    async create(input) { return booking(await request('', json('POST', input))) },
    async update(id, input) { return booking(await request(`/${encodeURIComponent(id)}`, json('PATCH', input))) },
    async remove(id) { await request(`/${encodeURIComponent(id)}`, { method: 'DELETE' }) },
  }
}

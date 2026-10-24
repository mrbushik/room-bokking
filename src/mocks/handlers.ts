import { http, HttpResponse } from 'msw'
import { isRecord, normalizeBooking, type BookingInput, type FieldErrors } from '../domain/booking'
import { issueFields, validateBooking } from '../domain/bookingRules'
import { isValidDate, type Clock } from '../domain/time'
import type { ErrorCode, ErrorEnvelope, UpdateBookingDto } from '../api/contracts'
import { StorageError, type BookingsRepository } from './repository'

class HttpProblem extends Error {
  constructor(readonly status: number, readonly code: ErrorCode, message: string, readonly fieldErrors?: FieldErrors) { super(message) }
}

export function createHandlers(repository: BookingsRepository, clock: Clock) {
  const safe = async (action: () => Response | Promise<Response>) => {
    try { return await action() }
    catch (error) {
      const problem = error instanceof HttpProblem ? error : new HttpProblem(500, error instanceof StorageError ? 'STORAGE_ERROR' : 'INTERNAL_ERROR', error instanceof StorageError ? error.message : 'Внутренняя ошибка mock API.')
      return HttpResponse.json<ErrorEnvelope>({ error: { code: problem.code, message: problem.message, ...(problem.fieldErrors ? { fieldErrors: problem.fieldErrors } : {}) } }, { status: problem.status })
    }
  }
  const missing = () => new HttpProblem(404, 'BOOKING_NOT_FOUND', 'Бронирование уже удалено или не существует.')
  const validate = (input: BookingInput, existing: Parameters<typeof validateBooking>[1], excludeId?: string) => {
    const issues = validateBooking(input, existing, clock.now(), excludeId)
    if (issues.length) {
      const conflictOnly = issues.every(i => i.code === 'CONFLICT')
      throw new HttpProblem(conflictOnly ? 409 : 422, conflictOnly ? 'BOOKING_CONFLICT' : 'VALIDATION_ERROR', conflictOnly ? 'Выбранное время уже занято. Измените интервал и повторите.' : 'Проверьте дату и время бронирования.', issueFields(issues))
    }
  }
  async function dto(request: Request, partial: boolean): Promise<UpdateBookingDto> {
    if (request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new HttpProblem(415, 'INVALID_REQUEST', 'Ожидается Content-Type: application/json.')
    let value: unknown
    try { value = await request.json() } catch { throw new HttpProblem(400, 'INVALID_REQUEST', 'Некорректный JSON.') }
    const fields = ['date', 'start', 'end', 'title']
    if (!isRecord(value) || Object.keys(value).length === 0 || Object.keys(value).some(key => !fields.includes(key) || typeof value[key] !== 'string')) throw new HttpProblem(400, 'INVALID_REQUEST', 'Некорректные поля запроса.')
    if (!partial && ['date', 'start', 'end'].some(key => typeof value[key] !== 'string')) throw new HttpProblem(400, 'INVALID_REQUEST', 'Укажите дату, начало и окончание.')
    return value
  }
  return [
    http.get('*/api/bookings', ({ request }) => safe(() => {
      const date = new URL(request.url).searchParams.get('date')
      if (!date || !isValidDate(date)) throw new HttpProblem(400, 'INVALID_REQUEST', 'Укажите дату YYYY-MM-DD.')
      return HttpResponse.json({ data: repository.readAll().filter(b => b.date === date).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id)) })
    })),
    http.post('*/api/bookings', ({ request }) => safe(async () => {
      const body = await dto(request, false)
      // Required string fields were checked before entering the synchronous transaction.
      const input: BookingInput = { date: body.date!, start: body.start!, end: body.end!, ...(body.title !== undefined ? { title: body.title } : {}) }
      const saved = repository.transact(current => {
        validate(input, current)
        const booking = { id: crypto.randomUUID(), ...normalizeBooking(input) }
        return { bookings: [...current, booking], result: booking }
      })
      return HttpResponse.json({ data: saved }, { status: 201 })
    })),
    http.patch('*/api/bookings/:id', ({ request, params }) => safe(async () => {
      const body = await dto(request, true)
      const saved = repository.transact(current => {
        const old = current.find(b => b.id === params.id)
        if (!old) throw missing()
        const input = { ...old, ...body }
        validate(input, current, old.id)
        const booking = { id: old.id, ...normalizeBooking(input) }
        return { bookings: current.map(b => b.id === old.id ? booking : b), result: booking }
      })
      return HttpResponse.json({ data: saved })
    })),
    http.delete('*/api/bookings/:id', ({ params }) => safe(() => {
      repository.transact(current => {
        if (!current.some(b => b.id === params.id)) throw missing()
        return { bookings: current.filter(b => b.id !== params.id), result: undefined }
      })
      return new HttpResponse(null, { status: 204 })
    })),
    http.all('*/api/*', () => HttpResponse.json<ErrorEnvelope>({ error: { code: 'INVALID_REQUEST', message: 'Неизвестный маршрут API.' } }, { status: 404 })),
  ]
}

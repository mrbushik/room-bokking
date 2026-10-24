import { isBooking, isRecord, type Booking } from '../domain/booking'
import { overlaps, validateBookingFields } from '../domain/bookingRules'
import { parseTime } from '../domain/time'

export const STORAGE_KEY = 'room-booking:v1'
export type DemoStorage = Pick<Storage, 'getItem' | 'setItem'>
export interface BookingsRepository {
  readAll(): Booking[]
  transact<T>(change: (current: readonly Booking[]) => { bookings: Booking[]; result: T }): T
}
export class StorageError extends Error {
  constructor() { super('Не удалось прочитать или сохранить данные в этом браузере.'); this.name = 'StorageError' }
}

function validSnapshot(value: unknown): value is Booking[] {
  if (!Array.isArray(value) || !value.every(isBooking)) return false
  if (new Set(value.map(b => b.id)).size !== value.length || value.some(b => validateBookingFields(b).length)) return false
  return !value.some((a, i) => value.some((b, j) => i < j && a.date === b.date && overlaps(parseTime(a.start)!, parseTime(a.end)!, parseTime(b.start)!, parseTime(b.end)!)))
}

export function createRepository(storage: DemoStorage): BookingsRepository {
  const readAll = (): Booking[] => {
    try {
      const text = storage.getItem(STORAGE_KEY)
      if (text === null) return []
      const data: unknown = JSON.parse(text)
      if (!isRecord(data) || data.version !== 1 || !validSnapshot(data.bookings)) throw new StorageError()
      return data.bookings
    } catch { throw new StorageError() }
  }
  return {
    readAll,
    transact(change) {
      const { bookings, result } = change(readAll())
      if (!validSnapshot(bookings)) throw new StorageError()
      try { storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, bookings })) }
      catch { throw new StorageError() }
      return result
    },
  }
}

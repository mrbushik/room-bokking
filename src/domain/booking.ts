import { isValidDate, parseTime } from './time'

export interface BookingInput {
  date: string
  start: string
  end: string
  title?: string
}

export interface Booking extends BookingInput {
  id: string
}

export type BookingField = keyof BookingInput
export type FieldErrors = Partial<Record<BookingField, string[]>>

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isBooking(value: unknown): value is Booking {
  return isRecord(value) && typeof value.id === 'string' && value.id.trim().length > 0
    && typeof value.date === 'string' && isValidDate(value.date)
    && typeof value.start === 'string' && parseTime(value.start) !== undefined
    && typeof value.end === 'string' && parseTime(value.end) !== undefined
    && (value.title === undefined || typeof value.title === 'string')
}

export function normalizeBooking(input: BookingInput): BookingInput {
  const title = input.title?.trim()
  return { date: input.date, start: input.start, end: input.end, ...(title ? { title } : {}) }
}

import type { Booking, BookingField, BookingInput, FieldErrors } from './booking'
import { isValidDate, localDate, localTimeMilliseconds, parseTime, WORK_END, WORK_START } from './time'

export const MIN_DURATION = 30
export const MAX_DURATION = 120

export function endTimeRange(startValue: string): { min: number; max: number } | undefined {
  const start = parseTime(startValue)
  if (start === undefined || start < WORK_START || start + MIN_DURATION > WORK_END) return undefined
  return { min: start + MIN_DURATION, max: Math.min(start + MAX_DURATION, WORK_END) }
}

export interface BookingIssue {
  field: BookingField
  code: 'FORMAT' | 'HOURS' | 'ORDER' | 'DURATION' | 'PAST' | 'CONFLICT'
  message: string
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function validateBookingFields(input: BookingInput): BookingIssue[] {
  const issues: BookingIssue[] = []
  if (!isValidDate(input.date)) issues.push({ field: 'date', code: 'FORMAT', message: 'Укажите существующую дату.' })
  const start = parseTime(input.start)
  const end = parseTime(input.end)
  if (start === undefined) issues.push({ field: 'start', code: 'FORMAT', message: 'Укажите начало в формате ЧЧ:ММ.' })
  if (end === undefined) issues.push({ field: 'end', code: 'FORMAT', message: 'Укажите окончание в формате ЧЧ:ММ.' })
  if (start === undefined || end === undefined) return issues
  if (start < WORK_START || start >= WORK_END) issues.push({ field: 'start', code: 'HOURS', message: 'Начало должно быть в пределах 09:00–18:00.' })
  if (end < WORK_START || end > WORK_END) issues.push({ field: 'end', code: 'HOURS', message: 'Окончание должно быть в пределах 09:00–18:00.' })
  if (start >= end) issues.push({ field: 'end', code: 'ORDER', message: 'Окончание должно быть позже начала.' })
  else if (end - start < MIN_DURATION || end - start > MAX_DURATION) issues.push({ field: 'end', code: 'DURATION', message: 'Длительность — от 30 до 120 минут.' })
  return issues
}

export function validateBooking(input: BookingInput, bookings: readonly Booking[], now: Date, excludeId?: string): BookingIssue[] {
  const issues = validateBookingFields(input)
  if (issues.length) return issues
  const start = parseTime(input.start)!
  const end = parseTime(input.end)!
  const today = localDate(now)
  if (input.date < today || (input.date === today && start * 60_000 < localTimeMilliseconds(now))) {
    issues.push({ field: 'start', code: 'PAST', message: 'Нельзя бронировать прошедшее время.' })
  }
  if (bookings.some(b => b.id !== excludeId && b.date === input.date && overlaps(start, end, parseTime(b.start)!, parseTime(b.end)!))) {
    issues.push({ field: 'start', code: 'CONFLICT', message: 'Выбранное время уже занято.' })
  }
  return issues
}

export function issueFields(issues: readonly BookingIssue[]): FieldErrors {
  const fields: FieldErrors = {}
  for (const issue of issues) (fields[issue.field] ??= []).push(issue.message)
  return fields
}

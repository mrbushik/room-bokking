import { describe, expect, it } from 'vitest'
import { normalizeBooking, type Booking, type BookingInput } from './booking'
import { endTimeRange, validateBooking, validateBookingFields } from './bookingRules'

const date = '2026-10-24'
const now = new Date(2026, 9, 24, 8)
const input = (start: string, end: string): BookingInput => ({ date, start, end })
const existing: Booking = { id: 'a', ...input('10:00', '11:00') }

describe('booking rules', () => {
  it.each([['09:00', '09:30'], ['17:30', '18:00'], ['09:10', '09:40'], ['09:00', '11:00']])('accepts %s–%s', (start, end) => expect(validateBooking(input(start, end), [], now)).toEqual([]))
  it.each([['09:00', '09:29', 'DURATION'], ['09:00', '11:01', 'DURATION'], ['10:00', '10:00', 'ORDER'], ['11:00', '10:00', 'ORDER'], ['08:59', '09:30', 'HOURS'], ['17:30', '18:01', 'HOURS'], ['9:00', '10:00', 'FORMAT']])('rejects %s–%s with %s', (start, end, code) => expect(validateBooking(input(start, end), [], now).some(i => i.code === code)).toBe(true))
  it.each([['09:30', '10:00'], ['11:00', '11:30']])('allows touching %s–%s', (start, end) => expect(validateBooking(input(start, end), [existing], now)).toEqual([]))
  it.each([['09:30', '10:30'], ['10:30', '11:30'], ['10:00', '10:30'], ['09:30', '11:30'], ['10:00', '11:00']])('rejects overlap %s–%s', (start, end) => expect(validateBooking(input(start, end), [existing], now).some(i => i.code === 'CONFLICT')).toBe(true))
  it('excludes self but not another booking', () => {
    expect(validateBooking(existing, [existing], now, 'a')).toEqual([])
    expect(validateBooking(existing, [existing, { ...existing, id: 'b' }], now, 'a')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'CONFLICT' })]))
  })
  it('ignores another date', () => expect(validateBooking(existing, [{ ...existing, date: '2026-10-25' }], now)).toEqual([]))
  it('rejects previous dates', () => expect(validateBooking({ ...input('09:00', '10:00'), date: '2026-10-23' }, [], now)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PAST' })])))
  it('allows exact now and rejects one millisecond later', () => {
    expect(validateBooking(input('17:30', '18:00'), [], new Date(2026, 9, 24, 17, 30))).toEqual([])
    expect(validateBooking(input('17:30', '18:00'), [], new Date(2026, 9, 24, 17, 30, 0, 1))).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PAST' })]))
  })
  it('allows the final interval just before 17:30', () => expect(validateBooking(input('17:30', '18:00'), [], new Date(2026, 9, 24, 17, 29, 59))).toEqual([]))
  it('an open draft becomes past after midnight', () => expect(validateBooking(input('09:00', '10:00'), [], new Date(2026, 9, 25))).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PAST' })])))
  it('rejects an impossible date', () => expect(validateBookingFields({ ...existing, date: '2026-02-30' })).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'date' })])))
  it('normalizes optional title without mutating input', () => {
    const draft = { ...existing, title: '  Команда  ' }
    expect(normalizeBooking(draft).title).toBe('Команда')
    expect(draft.title).toBe('  Команда  ')
    expect(normalizeBooking({ ...draft, title: ' ' })).not.toHaveProperty('title')
  })
})


describe('end time choices', () => {
  it.each([
    ['09:00', 570, 660],
    ['12:48', 798, 888],
    ['16:45', 1035, 1080],
    ['17:30', 1080, 1080],
  ])('offers only the duration/working-day range for %s', (start, min, max) => {
    expect(endTimeRange(start)).toEqual({ min, max })
  })
  it.each(['', '12:', 'bad', '08:59', '17:31', '18:00'])('offers no end choices for %s', start => {
    expect(endTimeRange(start)).toBeUndefined()
  })
})

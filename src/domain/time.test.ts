import { describe, expect, it } from 'vitest'
import { earliestStart, formatTime, isValidDate, localDate, parseTime } from './time'

describe('calendar dates', () => {
  it.each(['2026-01-01', '2024-02-29', '2000-02-29', '2026-12-31'])('accepts %s', date => expect(isValidDate(date)).toBe(true))
  it.each(['2026-02-29', '1900-02-29', '2026-04-31', '0000-01-01', '2026-00-01', '2026-13-01', '2026-01-00', '26-01-01', '2026-1-01', '2026-01-01T00:00:00Z', '2026-10-24\n', ''])('rejects %s', date => expect(isValidDate(date)).toBe(false))
  it.each([new Date(2026, 0, 1, 0, 1), new Date(2026, 0, 1, 23, 59)])('uses local calendar near midnight: %s', now => expect(localDate(now)).toBe('2026-01-01'))
  it('crosses year boundary in local time', () => {
    expect(localDate(new Date(2025, 11, 31, 23, 59))).toBe('2025-12-31')
    expect(localDate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
  })
})

describe('minute precision', () => {
  it.each([['09:00', 540], ['09:10', 550], ['18:00', 1080], ['23:59', 1439]] as const)('parses %s', (text, minutes) => {
    expect(parseTime(text)).toBe(minutes)
    expect(formatTime(minutes)).toBe(text)
  })
  it.each(['9:00', '24:00', '09:60', '09:00:00', '09:0', '', '-1:00', '09:00\n'])('rejects %s', text => expect(parseTime(text)).toBeUndefined())
  it.each([[17, 29, 59, 0, 1050], [17, 30, 0, 0, 1050], [17, 30, 0, 1, 1051], [8, 0, 0, 0, 540]])('rounds now upward without a slot grid', (h, m, s, ms, expected) => {
    expect(earliestStart('2026-10-24', new Date(2026, 9, 24, h, m, s, ms))).toBe(expected)
  })
})

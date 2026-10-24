export interface Clock {
  now(): Date
}

export const systemClock: Clock = { now: () => new Date() }
export const WORK_START = 9 * 60
export const WORK_END = 18 * 60

export function isValidDate(value: string): boolean {
  if (value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0)
}

export function parseTime(value: string): number | undefined {
  if (value.length !== 5 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return undefined
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
}

export function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function localDate(now: Date): string {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function localTimeMilliseconds(now: Date): number {
  return ((now.getHours() * 60 + now.getMinutes()) * 60 + now.getSeconds()) * 1000 + now.getMilliseconds()
}

export function earliestStart(date: string, now: Date): number {
  const today = localDate(now)
  if (date < today) return WORK_END
  if (date > today) return WORK_START
  return Math.max(WORK_START, Math.ceil(localTimeMilliseconds(now) / 60_000))
}

import type { DemoStorage } from '../mocks/repository'
import type { Clock } from '../domain/time'

export function memoryStorage(): DemoStorage {
  const values = new Map<string, string>()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }
}

export function testClock(initial = new Date(2026, 9, 24, 8)): Clock & { set(date: Date): void } {
  let current = initial
  return { now: () => new Date(current), set: date => { current = date } }
}

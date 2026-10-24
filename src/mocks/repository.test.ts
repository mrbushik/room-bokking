import { describe, expect, it } from 'vitest'
import { createRepository, STORAGE_KEY, StorageError } from './repository'
import { memoryStorage } from '../test/fixtures'

const booking = { id: 'old', date: '2020-01-01', start: '09:00', end: '09:30' }
describe('repository', () => {
  it('persists across repository instances and reads historical records', () => {
    const storage = memoryStorage()
    createRepository(storage).transact(() => ({ bookings: [booking], result: undefined }))
    expect(createRepository(storage).readAll()).toEqual([booking])
  })
  it.each(['invalid', '{"version":2,"bookings":[]}', '{"version":1,"bookings":[{}]}'])('rejects corrupt snapshot without overwriting: %s', text => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, text)
    expect(() => createRepository(storage).readAll()).toThrow(StorageError)
    expect(storage.getItem(STORAGE_KEY)).toBe(text)
  })
  it('does not persist a failed change', () => {
    const storage = memoryStorage()
    const repo = createRepository(storage)
    expect(() => repo.transact(() => { throw new Error('conflict') })).toThrow('conflict')
    expect(repo.readAll()).toEqual([])
  })
  it('does not report successful writes if Storage fails', () => {
    const repo = createRepository({ getItem: () => null, setItem: () => { throw new Error('quota') } })
    expect(() => repo.transact(() => ({ bookings: [booking], result: booking }))).toThrow(StorageError)
  })
})

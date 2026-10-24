// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { App } from '../app/App'
import { createBookingsApi } from '../api/client'
import { createHandlers } from '../mocks/handlers'
import { createRepository, type BookingsRepository } from '../mocks/repository'
import { bookingKey } from '../application/bookingQueries'
import { memoryStorage, testClock } from './fixtures'

const server = setupServer()
const api = createBookingsApi('http://localhost/api')
const clock = testClock()
let client: QueryClient
let repository: BookingsRepository
const competitor = createBookingsApi('http://localhost/api')
const baseInput = { date: '2026-10-24', start: '10:00', end: '11:00', title: 'Исходная' }
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
beforeEach(() => {
  clock.set(new Date(2026, 9, 24, 8))
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  repository = createRepository(memoryStorage())
  server.use(...createHandlers(repository, clock))
})
afterEach(() => { cleanup(); client.clear(); server.resetHandlers() })
afterAll(() => server.close())

function showApp() { return render(<QueryClientProvider client={client}><App api={api} clock={clock} /></QueryClientProvider>) }
function times(start = '10:00', end = '11:00') {
  fireEvent.change(screen.getByLabelText('Начало'), { target: { value: start } })
  fireEvent.change(screen.getByLabelText('Окончание'), { target: { value: end } })
}
async function loaded() { await screen.findByText('На этот день пока нет бронирований') }
const createButton = () => screen.getByRole('button', { name: 'Создать бронирование' })
const restoreHandlers = () => server.resetHandlers(...createHandlers(repository, clock))
const failedGet = () => server.use(http.get('*/api/bookings', () => HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Временно недоступно' } }, { status: 503 })))
function deferred() {
  let release = () => {}
  const promise = new Promise<void>(resolve => { release = resolve })
  return { promise, release }
}

describe('booking UI through real HTTP handlers', () => {
  it('loads empty, creates, edits, transfers and deletes through API', async () => {
    const user = userEvent.setup()
    showApp()
    await loaded()
    times()
    await user.type(screen.getByLabelText(/Название/), 'Команда')
    await user.click(createButton())
    const item = await screen.findByRole('button', { name: /Редактировать Команда/ })
    await user.click(item)
    fireEvent.change(screen.getByLabelText('Дата'), { target: { value: '2026-10-25' } })
    expect(screen.getByLabelText('Начало')).toHaveValue('10:00')
    await screen.findByText('На этот день пока нет бронирований')
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }))
    const moved = await screen.findByRole('button', { name: /Редактировать Команда/ })
    expect(await api.list('2026-10-24')).toEqual([])
    expect(await api.list('2026-10-25')).toHaveLength(1)
    await user.click(moved)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await user.click(screen.getByRole('button', { name: 'Удалить бронь' }))
    expect(await api.list('2026-10-25')).toHaveLength(1)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Удалить бронь' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Редактировать Команда/ })).not.toBeInTheDocument())
    expect(await api.list('2026-10-25')).toEqual([])
  })
  it('validates fields without erasing draft', async () => {
    const user = userEvent.setup()
    showApp()
    await loaded()
    times('10:00', '10:29')
    await user.type(screen.getByLabelText(/Название/), 'Мой черновик')
    await user.click(createButton())
    expect(screen.getByText('Длительность — от 30 до 120 минут.')).toBeVisible()
    expect(screen.getByLabelText('Окончание')).toHaveFocus()
    expect(screen.getByLabelText(/Название/)).toHaveValue('Мой черновик')
    expect(await api.list('2026-10-24')).toEqual([])
  })

  it.each(['create', 'update'] as const)('handles a real stale-data 409 on %s, keeps draft and retries', async kind => {
    const user = userEvent.setup()
    const original = kind === 'update' ? await competitor.create({ ...baseInput, start: '09:00', end: '09:30' }) : undefined
    const spy = vi.spyOn(api, kind)
    showApp()
    if (original) await user.click(await screen.findByRole('button', { name: /Редактировать Исходная/ }))
    else await loaded()
    times()
    await user.clear(screen.getByLabelText(/Название/))
    await user.type(screen.getByLabelText(/Название/), '  Черновик  ')
    await competitor.create({ ...baseInput, start: '10:30', end: '11:00', title: 'Конкурент' })
    expect(screen.queryByRole('button', { name: /Редактировать Конкурент/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: kind === 'create' ? 'Создать бронирование' : 'Сохранить изменения' }))
    await screen.findByText('Выбранное время уже занято. Измените интервал и повторите.')
    await screen.findByRole('button', { name: /Редактировать Конкурент/ })
    await expect(spy.mock.results[0]?.value).rejects.toMatchObject({ status: 409 })
    await waitFor(() => expect(screen.getByLabelText('Начало')).toBeEnabled())
    expect(screen.getByLabelText('Дата')).toHaveValue('2026-10-24')
    expect(screen.getByLabelText('Начало')).toHaveValue('10:00')
    expect(screen.getByLabelText('Окончание')).toHaveValue('11:00')
    expect(screen.getByLabelText(/Название/)).toHaveValue('  Черновик  ')
    times('11:00', '12:00')
    await user.click(screen.getByRole('button', { name: kind === 'create' ? 'Создать бронирование' : 'Сохранить изменения' }))
    await screen.findByRole('button', { name: /Редактировать Черновик/ })
    const records = await competitor.list(baseInput.date)
    expect(records).toHaveLength(2)
    if (original) expect(records.find(b => b.title === 'Черновик')?.id).toBe(original.id)
  })

  it.each(['create', 'update', 'delete'] as const)('keeps %s successful when the following GET fails; retries only GET', async kind => {
    const user = userEvent.setup()
    if (kind !== 'create') await competitor.create(baseInput)
    const spy = vi.spyOn(api, kind === 'delete' ? 'remove' : kind)
    showApp()
    if (kind === 'create') await loaded()
    else await user.click(await screen.findByRole('button', { name: /Редактировать Исходная/ }))
    times()
    failedGet()
    if (kind === 'delete') {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      await user.click(screen.getByRole('button', { name: 'Удалить бронь' }))
    } else await user.click(screen.getByRole('button', { name: kind === 'create' ? 'Создать бронирование' : 'Сохранить изменения' }))
    await screen.findByText(kind === 'delete' ? 'Бронирование удалено.' : 'Бронирование сохранено.')
    await screen.findByText(/Не удалось обновить расписание/)
    await waitFor(() => expect(client.getMutationCache().getAll().at(-1)?.state.status).toBe('success'))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Начало')).toHaveValue('')
    restoreHandlers()
    await user.click(screen.getByRole('button', { name: 'Обновить расписание' }))
    await waitFor(() => expect(client.getQueryState(bookingKey(baseInput.date))?.status).toBe('success'))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(await competitor.list(baseInput.date)).toHaveLength(kind === 'delete' ? 0 : 1)
  })

  it('keeps both conflict and draft when the 409 refetch also fails', async () => {
    const user = userEvent.setup()
    showApp()
    await loaded()
    times()
    await user.type(screen.getByLabelText(/Название/), 'Сохранить ввод')
    await competitor.create({ ...baseInput, title: 'Конкурент' })
    failedGet()
    await user.click(createButton())
    await screen.findByText(/Выбранное время уже занято. Измените интервал/)
    await screen.findByText(/Не удалось обновить расписание/)
    await waitFor(() => expect(screen.getByLabelText('Начало')).toBeEnabled())
    expect(screen.getByLabelText('Начало')).toHaveValue('10:00')
    expect(screen.getByLabelText(/Название/)).toHaveValue('Сохранить ввод')
  })

  it('handles initial GET failure and retries without losing entered fields', async () => {
    const user = userEvent.setup()
    failedGet()
    showApp()
    await screen.findByText('Не удалось загрузить расписание. Повторите загрузку.')
    expect(createButton()).toBeDisabled()
    await user.type(screen.getByLabelText(/Название/), 'Черновик до загрузки')
    restoreHandlers()
    await user.click(screen.getByRole('button', { name: 'Обновить расписание' }))
    await loaded()
    expect(screen.getByLabelText(/Название/)).toHaveValue('Черновик до загрузки')
  })

  it('keeps fields on a network mutation error', async () => {
    const user = userEvent.setup()
    showApp()
    await loaded()
    times()
    await user.type(screen.getByLabelText(/Название/), 'Не терять')
    server.use(http.post('*/api/bookings', () => HttpResponse.error()))
    await user.click(createButton())
    await screen.findByText(/Не удалось связаться с API/)
    expect(screen.getByLabelText('Начало')).toHaveValue('10:00')
    expect(screen.getByLabelText(/Название/)).toHaveValue('Не терять')
    expect(await competitor.list(baseInput.date)).toEqual([])
  })

  it('maps fresh server-clock validation errors to fields without losing input', async () => {
    const user = userEvent.setup()
    showApp()
    await loaded()
    times()
    const realCreate = api.create
    vi.spyOn(api, 'create').mockImplementation(input => {
      clock.set(new Date(2026, 9, 24, 10, 0, 0, 1))
      return realCreate(input)
    })
    await user.click(createButton())
    await screen.findByText('Нельзя бронировать прошедшее время.')
    expect(screen.getByLabelText('Начало')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Начало')).toHaveValue('10:00')
    await waitFor(() => expect(screen.getByLabelText('Начало')).toHaveFocus())
  })

  it('invalidates inactive dates without refetching them until opened', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(api, 'list')
    showApp()
    await loaded()
    fireEvent.change(screen.getByLabelText('Дата'), { target: { value: '2026-10-25' } })
    await waitFor(() => expect(client.getQueryData(bookingKey('2026-10-25'))).toEqual([]))
    times()
    await user.click(createButton())
    await screen.findByText('Бронирование сохранено.')
    await waitFor(() => expect(client.getMutationCache().getAll().at(-1)?.state.status).toBe('success'))
    expect(client.getQueryState(bookingKey('2026-10-24'))?.isInvalidated).toBe(true)
    expect(spy.mock.calls.filter(([d]) => d === '2026-10-24')).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Дата'), { target: { value: '2026-10-24' } })
    await waitFor(() => expect(client.getQueryState(bookingKey('2026-10-24'))?.isInvalidated).toBe(false))
    expect(spy.mock.calls.filter(([d]) => d === '2026-10-24')).toHaveLength(2)
  })

  it('shows loading and preserves input entered before GET completes', async () => {
    const gate = deferred()
    server.use(http.get('*/api/bookings', async () => { await gate.promise; return HttpResponse.json({ data: [] }) }))
    showApp()
    expect(screen.getByText('Загружаем расписание…')).toBeVisible()
    expect(createButton()).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Название/), { target: { value: 'До загрузки' } })
    gate.release()
    await loaded()
    expect(screen.getByLabelText(/Название/)).toHaveValue('До загрузки')
  })

  it('prevents duplicate submission and locks date until the operation finishes', async () => {
    const gate = deferred()
    const realCreate = api.create
    const spy = vi.spyOn(api, 'create').mockImplementation(async input => { await gate.promise; return realCreate(input) })
    showApp()
    await loaded()
    times()
    const form = screen.getByLabelText('Начало').closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText('Дата')).toBeDisabled()
    expect(screen.getByLabelText('Начало')).toBeDisabled()
    gate.release()
    await screen.findByText('Бронирование сохранено.')
    await waitFor(() => expect(createButton()).toBeEnabled())
    expect(await competitor.list(baseInput.date)).toHaveLength(1)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('never displays an old delayed response under a different date', async () => {
    const gate = deferred()
    let started = false
    let finished = false
    server.use(http.get('*/api/bookings', async ({ request }) => {
      const date = new URL(request.url).searchParams.get('date')!
      if (date === '2026-10-24') { started = true; await gate.promise; finished = true }
      return HttpResponse.json({ data: [{ ...baseInput, date, id: date, title: date === '2026-10-24' ? 'Старый день' : 'Новый день' }] })
    }))
    showApp()
    await waitFor(() => expect(started).toBe(true))
    fireEvent.change(screen.getByLabelText('Дата'), { target: { value: '2026-10-25' } })
    await screen.findByRole('button', { name: /Редактировать Новый день/ })
    gate.release()
    await waitFor(() => expect(finished).toBe(true))
    expect(screen.queryByRole('button', { name: /Редактировать Старый день/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Редактировать Новый день/ })).toBeVisible()
  })

  it('updates the final working-day boundary and midnight without changing draft or date', async () => {
    clock.set(new Date(2026, 9, 24, 17, 29, 59))
    showApp()
    await loaded()
    times('17:30', '18:00')
    fireEvent.change(screen.getByLabelText(/Название/), { target: { value: 'К концу дня' } })
    expect(createButton()).toBeEnabled()
    clock.set(new Date(2026, 9, 24, 17, 30, 0, 1))
    await waitFor(() => expect(createButton()).toBeDisabled(), { timeout: 2000 })
    expect(screen.getByText(/Сегодня уже не осталось времени/)).toBeVisible()
    clock.set(new Date(2026, 9, 25))
    fireEvent.focus(window)
    expect(screen.getByText(/Прошедший день доступен только для просмотра/)).toBeVisible()
    expect(screen.getByLabelText('Дата')).toHaveValue('2026-10-24')
    expect(screen.getByLabelText('Начало')).toHaveValue('17:30')
    expect(screen.getByLabelText(/Название/)).toHaveValue('К концу дня')
  })

  it('allows moving a past booking into the future but not saving its past interval', async () => {
    const user = userEvent.setup()
    const original = await competitor.create(baseInput)
    clock.set(new Date(2026, 9, 25, 8))
    showApp()
    await loaded()
    fireEvent.change(screen.getByLabelText('Дата'), { target: { value: '2026-10-24' } })
    await user.click(await screen.findByRole('button', { name: /Редактировать Исходная/ }))
    expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Дата'), { target: { value: '2026-10-26' } })
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }))
    await screen.findByRole('button', { name: /Редактировать Исходная/ })
    expect((await competitor.list('2026-10-26'))[0]?.id).toBe(original.id)
  })

  it('preserves the edit draft when another client has deleted the record', async () => {
    const user = userEvent.setup()
    const original = await competitor.create(baseInput)
    showApp()
    await user.click(await screen.findByRole('button', { name: /Редактировать Исходная/ }))
    await competitor.remove(original.id)
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }))
    await screen.findByText('Бронирование уже удалено или не существует.')
    await loaded()
    expect(screen.getByLabelText(/Название/)).toHaveValue('Исходная')
    expect(screen.getByLabelText('Начало')).toHaveValue('10:00')
  })
})

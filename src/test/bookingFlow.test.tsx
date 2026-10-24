// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { App } from '../app/App'
import { createBookingsApi } from '../api/client'
import { createHandlers } from '../mocks/handlers'
import { createRepository } from '../mocks/repository'
import { memoryStorage, testClock } from './fixtures'

const server = setupServer()
const api = createBookingsApi('http://localhost/api')
const clock = testClock()
let client: QueryClient
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
beforeEach(() => {
  clock.set(new Date(2026, 9, 24, 8))
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  server.use(...createHandlers(createRepository(memoryStorage()), clock))
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
})

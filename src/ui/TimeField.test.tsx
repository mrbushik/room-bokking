// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { TimeField } from './TimeField'

afterEach(cleanup)
function show(min = '09:00', max = '17:30', value = '') {
  const changed = vi.fn()
  function Field() {
    const [time, setTime] = useState(value)
    return <><TimeField id="time" label="Начало" value={time} min={min} max={max} disabled={false}
      onChange={next => { changed(next); setTime(next) }} /><button>Снаружи</button></>
  }
  render(<Field />)
  return changed
}
const open = () => userEvent.setup().click(screen.getByRole('button', { name: /Выбрать время:/ }))
const hour = (value: number) => screen.getByRole('option', { name: `Час ${value}` })
const minute = (value: number) => screen.getByRole('option', { name: `Минута ${value}` })

describe('24-hour time wheels', () => {
  it('offers separate hour/minute wheels with only available business times', async () => {
    show()
    await open()
    expect(within(screen.getByRole('listbox', { name: 'Часы' })).getAllByRole('option')).toHaveLength(9)
    expect(within(screen.getByRole('listbox', { name: 'Минуты' })).getAllByRole('option')).toHaveLength(60)
    expect(screen.queryByRole('option', { name: 'Час 8' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Час 18' })).not.toBeInTheDocument()
    expect(screen.queryByText(/AM|PM/)).not.toBeInTheDocument()
  })

  it.each([['09:30', '18:00', 9, 29, 30], ['13:17', '17:30', 13, 16, 17]])(
    'excludes minutes before %s', async (min, max, selectedHour, blocked, allowed) => {
      show(min, max)
      await open()
      expect(hour(selectedHour)).toHaveAttribute('aria-selected', 'true')
      expect(screen.queryByRole('option', { name: `Минута ${blocked}` })).not.toBeInTheDocument()
      expect(minute(allowed)).toBeEnabled()
    },
  )

  it('clamps minutes at the hour boundary and permits only 18:00', async () => {
    const user = userEvent.setup()
    show('09:30', '18:00', '17:47')
    await open()
    await user.click(hour(18))
    expect(minute(0)).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('listbox', { name: 'Минуты' })).getAllByRole('option')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Выбрать 18:00' }))
    expect(screen.getByLabelText('Начало')).toHaveValue('18:00')
  })

  it('settles a wheel after scrolling stops and commits only on confirmation', async () => {
    const changed = show()
    await open()
    const wheel = screen.getByRole('listbox', { name: 'Минуты' })
    fireEvent.scroll(wheel, { target: { scrollTop: 17 * 44 } })
    expect(screen.getByRole('button', { name: 'Выбрать 09:00' })).toBeDisabled()
    expect(changed).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Выбрать 09:17' })).toBeEnabled())
    expect(screen.getByLabelText('Начало')).toHaveValue('')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Выбрать 09:17' }))
    expect(changed).toHaveBeenCalledExactlyOnceWith('09:17')
    expect(screen.getByLabelText('Начало')).toHaveFocus()
  })

  it('never restores a stale hour when the other wheel settles later', async () => {
    show()
    await open()
    fireEvent.scroll(screen.getByRole('listbox', { name: 'Минуты' }), { target: { scrollTop: 17 * 44 } })
    await userEvent.setup().click(hour(14))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Выбрать 14:17' })).toBeEnabled())
  })

  it('preserves direct input, keyboard navigation, Escape and outside blur', async () => {
    const user = userEvent.setup()
    const changed = show()
    const input = screen.getByLabelText('Начало')
    await user.type(input, '0917')
    expect(input).toHaveValue('09:17')
    changed.mockClear()
    await user.keyboard('{ArrowDown}{ArrowDown}{Escape}')
    expect(input).toHaveValue('09:17')
    expect(changed).not.toHaveBeenCalled()
    await user.keyboard('{ArrowDown}{ArrowDown}{Tab}{ArrowDown}{Tab}{Enter}')
    expect(input).toHaveValue('10:18')
    await open()
    await user.click(screen.getByText('Снаружи'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('offers no times when the last possible start has passed', async () => {
    show('18:00', '17:30')
    await open()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByText('Нет доступного времени')).toBeVisible()
  })
})

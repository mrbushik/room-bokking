// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
const hour = (value: number) => screen.getByRole('button', { name: `Час ${value}` })
const minute = (value: number) => screen.getByRole('button', { name: `Минута ${value}` })

describe('separate 24-hour hour and minute selection', () => {
  it('shows business hours and every minute in two compact groups', async () => {
    show()
    await open()
    expect(within(screen.getByRole('group', { name: 'Часы' })).getAllByRole('button')).toHaveLength(9)
    expect(within(screen.getByRole('group', { name: 'Минуты' })).getAllByRole('button')).toHaveLength(60)
    expect(screen.queryByRole('button', { name: 'Час 8' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Час 18' })).not.toBeInTheDocument()
    expect(screen.queryByText(/AM|PM/)).not.toBeInTheDocument()
    for (let value = 0; value < 60; value++) expect(minute(value)).toBeEnabled()
  })

  it.each([['09:30', '18:00', 9, 29, 30], ['13:17', '17:30', 13, 16, 17]])(
    'disables minutes before the lower boundary %s', async (min, max, selectedHour, blocked, allowed) => {
      show(min, max)
      await open()
      expect(hour(selectedHour)).toHaveAttribute('aria-pressed', 'true')
      expect(minute(blocked)).toBeDisabled()
      expect(minute(allowed)).toBeEnabled()
    },
  )

  it('clamps the minute when changing to a boundary hour and enforces 18:00', async () => {
    const user = userEvent.setup()
    show('09:30', '18:00', '17:47')
    await open()
    await user.click(hour(18))
    expect(minute(0)).toHaveAttribute('aria-pressed', 'true')
    expect(minute(0)).toBeEnabled()
    for (let value = 1; value < 60; value++) expect(minute(value)).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Выбрать 18:00' }))
    expect(screen.getByLabelText('Начало')).toHaveValue('18:00')
  })

  it('does not commit on scrolling or hour/minute clicks; confirms the exact time', async () => {
    const user = userEvent.setup()
    const changed = show()
    await open()
    fireEvent.wheel(screen.getByRole('dialog'), { deltaY: 300 })
    await user.click(hour(14))
    await user.click(minute(17))
    expect(changed).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Начало')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Выбрать 14:17' }))
    expect(changed).toHaveBeenCalledExactlyOnceWith('14:17')
    expect(screen.getByLabelText('Начало')).toHaveValue('14:17')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Начало')).toHaveFocus()
  })

  it('preserves direct input and supports keyboard hour/minute navigation, Escape and blur', async () => {
    const user = userEvent.setup()
    const changed = show()
    const input = screen.getByLabelText('Начало')
    await user.type(input, '0917')
    expect(input).toHaveValue('09:17')
    changed.mockClear()
    await user.keyboard('{ArrowDown}{ArrowDown}{Escape}')
    expect(input).toHaveValue('09:17')
    expect(changed).not.toHaveBeenCalled()
    await user.keyboard('{ArrowDown}{ArrowDown}{Tab}{ArrowRight}{Tab}{Enter}')
    expect(input).toHaveValue('10:18')
    expect(changed).toHaveBeenCalledExactlyOnceWith('10:18')
    await open()
    await user.click(screen.getByText('Снаружи'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('offers no times when the last possible start has passed', async () => {
    show('18:00', '17:30')
    await open()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(screen.getByText('Нет доступного времени')).toBeVisible()
  })
})

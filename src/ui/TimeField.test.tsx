// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

describe('24-hour time selection', () => {
  it.each([['09:00', '17:30', 511], ['09:30', '18:00', 511], ['13:17', '17:30', 254]])(
    'offers every minute only between %s and %s', async (min, max, count) => {
      const user = userEvent.setup()
      show(min, max)
      await user.click(screen.getByRole('button', { name: /Выбрать время/ }))
      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(count)
      expect(options[0]).toHaveTextContent(min)
      expect(options.at(-1)).toHaveTextContent(max)
      expect(options.every(option => /^\d{2}:\d{2}$/.test(option.textContent!))).toBe(true)
      expect(screen.queryByText(/AM|PM/)).not.toBeInTheDocument()
    },
  )

  it('scrolls without changing the value; commits only the clicked minute', async () => {
    const user = userEvent.setup()
    const changed = show()
    await user.click(screen.getByRole('button', { name: /Выбрать время/ }))
    const list = screen.getByRole('listbox')
    fireEvent.wheel(list, { deltaY: 300 })
    fireEvent.scroll(list, { target: { scrollTop: 300 } })
    expect(changed).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Начало')).toHaveValue('')
    await user.click(screen.getByRole('option', { name: '14:17' }))
    expect(screen.getByLabelText('Начало')).toHaveValue('14:17')
    expect(changed).toHaveBeenCalledExactlyOnceWith('14:17')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('supports exact manual input and keyboard selection without committing on navigation or Escape', async () => {
    const user = userEvent.setup()
    show()
    const input = screen.getByLabelText('Начало')
    await user.type(input, '0917')
    expect(input).toHaveValue('09:17')
    await user.keyboard('{ArrowDown}{ArrowDown}{Escape}')
    expect(input).toHaveValue('09:17')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(input).toHaveValue('09:18')
    await user.click(screen.getByRole('button', { name: /Выбрать время/ }))
    await user.click(screen.getByText('Снаружи'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('offers no times when the last possible start has passed', async () => {
    show('18:00', '17:30')
    await userEvent.setup().click(screen.getByRole('button', { name: /Выбрать время/ }))
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(screen.getByText('Нет доступного времени')).toBeVisible()
  })
})

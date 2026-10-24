// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TimeWheel } from './TimeWheel'

afterEach(cleanup)

it('keeps scrolling independent from parent renders and updates the latest callback once after settling', async () => {
  const oldChange = vi.fn()
  const latestChange = vi.fn()
  const scrolling = vi.fn()
  const props = { id: 'minutes', label: 'Минуты', optionLabel: 'Минута', min: 0, max: 59, value: 17, onScrollingChange: scrolling }
  const view = render(<TimeWheel {...props} onChange={oldChange} />)
  const wheel = screen.getByRole('listbox')
  for (let step = 18; step <= 28; step++) fireEvent.scroll(wheel, { target: { scrollTop: step * 44 + 8 } })
  view.rerender(<TimeWheel {...props} onChange={latestChange} />)
  expect(wheel.scrollTop).toBe(28 * 44 + 8)
  expect(oldChange).not.toHaveBeenCalled()
  expect(latestChange).not.toHaveBeenCalled()
  expect(scrolling).toHaveBeenCalledExactlyOnceWith(true)
  await waitFor(() => expect(latestChange).toHaveBeenCalledExactlyOnceWith(28))
  expect(scrolling.mock.calls).toEqual([[true], [false]])
  expect(oldChange).not.toHaveBeenCalled()
})

it('cancels pending scroll callbacks when the picker closes', async () => {
  const changed = vi.fn()
  const view = render(<TimeWheel id="minutes" label="Минуты" optionLabel="Минута" min={0} max={59} value={0} onChange={changed} onScrollingChange={() => {}} />)
  fireEvent.scroll(screen.getByRole('listbox'), { target: { scrollTop: 20 * 44 } })
  view.unmount()
  await new Promise(resolve => setTimeout(resolve, 220))
  expect(changed).not.toHaveBeenCalled()
})

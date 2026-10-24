import { useEffect, useLayoutEffect, useRef } from 'react'

const ROW_HEIGHT = 44
interface TimeWheelProps {
  id: string
  label: string
  optionLabel: string
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  onScrollingChange: (scrolling: boolean) => void
}

export function TimeWheel({ id, label, optionLabel, min, max, value, onChange, onScrollingChange }: TimeWheelProps) {
  const list = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const latest = useRef({ value, min, max, onChange, onScrollingChange })
  useLayoutEffect(() => { latest.current = { value, min, max, onChange, onScrollingChange } }, [value, min, max, onChange, onScrollingChange])
  const values = Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => min + index)

  useLayoutEffect(() => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current)
      timer.current = undefined
      onScrollingChange(false)
    }
    if (list.current) list.current.scrollTop = (Math.max(min, Math.min(max, value)) - min) * ROW_HEIGHT
  }, [min, max, value, onScrollingChange])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  function finish() {
    if (timer.current === undefined || !list.current) return
    window.clearTimeout(timer.current)
    timer.current = undefined
    const current = latest.current
    const next = Math.max(current.min, Math.min(current.max, current.min + Math.round(list.current.scrollTop / ROW_HEIGHT)))
    if (next !== current.value) current.onChange(next)
    current.onScrollingChange(false)
  }

  return <div className="min-w-0 text-center">
    <p id={`${id}-label`} className="mb-2 text-xs text-stone-500">{label}</p>
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[88px] h-11 rounded-lg border-y border-teal-200 bg-teal-50" />
      <div ref={list} role="listbox" aria-labelledby={`${id}-label`} aria-activedescendant={`${id}-${value}`} tabIndex={0}
        className="time-wheel relative h-[220px] overflow-y-auto overscroll-contain rounded-lg py-[88px] outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        onScroll={() => {
          if (timer.current === undefined) onScrollingChange(true)
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(finish, 180)
        }} onScrollEnd={finish}
        onKeyDown={event => {
          const offsets: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }
          if (!(event.key in offsets) && event.key !== 'Home' && event.key !== 'End') return
          event.preventDefault()
          const next = event.key === 'Home' ? min : event.key === 'End' ? max : Math.max(min, Math.min(max, value + offsets[event.key]!))
          onChange(next)
        }}>
        {values.map(option => <button key={option} id={`${id}-${option}`} type="button" role="option"
          aria-label={`${optionLabel} ${option}`} aria-selected={option === value} tabIndex={-1}
          onMouseDown={event => event.preventDefault()} onClick={() => onChange(option)}
          className="relative flex h-11 w-full shrink-0 snap-center items-center justify-center text-lg tabular-nums text-stone-500 aria-selected:font-semibold aria-selected:text-teal-900">{String(option).padStart(2, '0')}</button>)}
      </div>
    </div>
  </div>
}

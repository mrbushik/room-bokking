import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { formatTime, parseTime } from '../domain/time'
import { TimeWheel } from './TimeWheel'

interface TimeFieldProps {
  id: string
  label: string
  value: string
  min: string
  max: string
  disabled: boolean
  error?: string[] | undefined
  onChange: (value: string) => void
}

export function TimeField({ id, label, value, min, max, disabled, error, onChange }: TimeFieldProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(0)
  const [scrolling, setScrolling] = useState({ hours: false, minutes: false })
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const first = parseTime(min) ?? 0
  const last = parseTime(max) ?? -1
  const hours = Array.from({ length: Math.max(0, Math.floor(last / 60) - Math.floor(first / 60) + 1) }, (_, index) => Math.floor(first / 60) + index)
  const bounded = Math.max(first, Math.min(last, pending))
  const hour = Math.floor(bounded / 60)
  const minute = bounded % 60
  const minutes = Array.from({ length: 60 }, (_, index) => index).filter(value => hour * 60 + value >= first && hour * 60 + value <= last)
  const expanded = open && !disabled
  const valid = pending >= first && pending <= last
  const markHours = useCallback((hours: boolean) => setScrolling(previous => previous.hours === hours ? previous : { ...previous, hours }), [])
  const markMinutes = useCallback((minutes: boolean) => setScrolling(previous => previous.minutes === minutes ? previous : { ...previous, minutes }), [])

  useLayoutEffect(() => {
    if (!expanded || !panel.current || !input.current) return
    const field = input.current.getBoundingClientRect()
    const popup = panel.current.getBoundingClientRect()
    setPosition({
      left: Math.max(12, Math.min(field.left, window.innerWidth - popup.width - 12)),
      top: Math.max(12, Math.min(field.bottom + 6, window.innerHeight - popup.height - 12)),
    })
    panel.current.querySelector<HTMLDivElement>('[role="listbox"]')?.focus({ preventScroll: true })
  }, [expanded])

  function show() {
    setScrolling({ hours: false, minutes: false })
    setPending(Math.max(first, Math.min(last, parseTime(value) ?? first)))
    setOpen(true)
  }
  function close() {
    setOpen(false)
    input.current?.focus({ preventScroll: true })
  }
  function chooseHour(next: number) {
    setPending(Math.max(first, Math.min(last, next * 60 + minute)))
  }

  return <div className="relative min-w-0" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }} onKeyDown={event => {
    if (expanded && event.key === 'Escape') { event.preventDefault(); close() }
  }}>
    <label htmlFor={id} className="field-label">{label}</label>
    <div className="relative">
      <input ref={input} id={id} type="text" inputMode="numeric" placeholder="ЧЧ:ММ" autoComplete="off" maxLength={5}
        role="combobox" aria-haspopup="dialog" aria-expanded={expanded} aria-controls={`${id}-options`}
        required disabled={disabled} value={value} onChange={event => {
          const text = event.target.value
          onChange(/^\d{4}$/.test(text) ? `${text.slice(0, 2)}:${text.slice(2)}` : text)
          setOpen(false)
        }}
        aria-invalid={!!error?.length} aria-describedby={error?.length ? `${id}-error` : undefined}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show() }
        }} className="field-input pr-10 tabular-nums" />
      <button type="button" disabled={disabled} aria-label={`Выбрать время: ${label.toLowerCase()}`}
        aria-haspopup="dialog" aria-expanded={expanded} aria-controls={`${id}-options`}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-stone-500 focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-50"
        onClick={() => { if (expanded) close(); else show() }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m7 10 5 5 5-5" /></svg>
      </button>
    </div>
    {expanded && <div ref={panel} id={`${id}-options`} role="dialog" aria-label={`Выбор времени: ${label.toLowerCase()}`}
      style={position} className="fixed z-30 max-h-[calc(100dvh-24px)] w-64 max-w-[calc(100vw-24px)] overflow-y-auto overscroll-contain rounded-xl border border-stone-200 bg-white p-3 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-800">{label}</p>
        <button type="button" aria-label="Закрыть выбор времени" onClick={close}
          className="flex size-7 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-teal-700">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>
      {hours.length ? <>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TimeWheel id={`${id}-hours`} label="Часы" optionLabel="Час" min={hours[0]!} max={hours[hours.length - 1]!} value={hour}
            onChange={chooseHour} onScrollingChange={markHours} />
          <span aria-hidden="true" className="pt-6 text-xl text-stone-400">:</span>
          <TimeWheel id={`${id}-minutes`} label="Минуты" optionLabel="Минута" min={minutes[0]!} max={minutes[minutes.length - 1]!} value={minute}
            onChange={value => setPending(hour * 60 + value)} onScrollingChange={markMinutes} />
        </div>
        <button type="button" disabled={!valid || scrolling.hours || scrolling.minutes} className="primary-button mt-3 w-full !py-2" onClick={() => { if (valid) onChange(formatTime(pending)); close() }}>Выбрать {formatTime(pending)}</button>
      </> : <p className="text-sm text-stone-500">Нет доступного времени</p>}
    </div>}
    {!!error?.length && <p id={`${id}-error`} className="field-error">{error.join(' ')}</p>}
  </div>
}

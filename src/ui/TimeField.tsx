import { useEffect, useRef, useState } from 'react'
import { formatTime, parseTime } from '../domain/time'

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
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const first = parseTime(min) ?? 0
  const last = parseTime(max) ?? -1
  const options = Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => formatTime(first + index))
  const expanded = open && !disabled

  useEffect(() => {
    const container = list.current
    const option = container?.children[active] as HTMLElement | undefined
    if (expanded && container && option) {
      container.scrollTop = option.offsetTop - container.clientHeight / 2 + option.offsetHeight / 2
    }
  }, [active, expanded])

  function show() {
    const index = options.indexOf(value)
    setActive(index < 0 ? 0 : index)
    setOpen(true)
  }
  function select(index: number) {
    const selected = options[index]
    if (selected) onChange(selected)
    setOpen(false)
    input.current?.focus()
  }

  return <div className="relative min-w-0" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <label htmlFor={id} className="field-label">{label}</label>
    <div className="relative">
      <input ref={input} id={id} type="text" inputMode="numeric" placeholder="ЧЧ:ММ" autoComplete="off" maxLength={5}
        role="combobox" aria-autocomplete="none" aria-expanded={expanded} aria-controls={`${id}-options`}
        aria-activedescendant={expanded && options[active] ? `${id}-option-${active}` : undefined}
        required disabled={disabled} value={value} onChange={event => {
          const text = event.target.value
          onChange(/^\d{4}$/.test(text) ? `${text.slice(0, 2)}:${text.slice(2)}` : text)
          setOpen(false)
        }}
        aria-invalid={!!error?.length} aria-describedby={error?.length ? `${id}-error` : undefined}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!expanded) show()
            else setActive(index => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
          } else if (expanded && event.key === 'Enter') { event.preventDefault(); select(active) }
          else if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
        }} className="field-input pr-10 tabular-nums" />
      <button type="button" disabled={disabled} aria-label={`Выбрать время: ${label.toLowerCase()}`}
        aria-expanded={expanded} aria-controls={`${id}-options`}
        className="absolute inset-y-0 right-0 w-10 rounded-r-lg text-stone-500 focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-50"
        onClick={() => { if (expanded) setOpen(false); else show(); input.current?.focus() }}>⌄</button>
    </div>
    {expanded && <div ref={list} id={`${id}-options`} role="listbox" aria-label={`Варианты времени: ${label.toLowerCase()}`}
      className="absolute inset-x-0 top-full z-20 mt-1 max-h-52 overflow-y-auto overscroll-contain rounded-lg border border-stone-200 bg-white p-1 shadow-lg">
      {options.map((time, index) => <div key={time} id={`${id}-option-${index}`} role="option"
        aria-selected={value === time} onMouseDown={event => event.preventDefault()} onClick={() => select(index)}
        className={`cursor-pointer rounded px-3 py-2 text-sm tabular-nums hover:bg-teal-50 ${active === index ? 'bg-teal-50 text-teal-900' : 'text-stone-700'}`}>{time}</div>)}
      {!options.length && <p className="px-3 py-2 text-sm text-stone-500">Нет доступного времени</p>}
    </div>}
    {!!error?.length && <p id={`${id}-error`} className="field-error">{error.join(' ')}</p>}
  </div>
}

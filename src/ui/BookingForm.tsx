import { useEffect, useRef, useState } from 'react'
import type { BookingController } from '../application/useBookingController'
import type { BookingField } from '../domain/booking'
import { TimeField } from './TimeField'

export function BookingForm({ controller: c }: { controller: BookingController }) {
  const pendingFocus = useRef<BookingField | undefined>(undefined)
  const [focusRequest, setFocusRequest] = useState(0)
  useEffect(() => {
    if (!c.isBusy && pendingFocus.current) {
      document.getElementById(`booking-${pendingFocus.current}`)?.focus()
      pendingFocus.current = undefined
    }
  }, [focusRequest, c.isBusy])
  return <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6" aria-labelledby="form-heading">
    <p className="text-xs font-semibold tracking-widest text-teal-700 uppercase">{c.editing ? 'Редактирование' : 'Новая встреча'}</p>
    <h2 id="form-heading" className="mt-2 text-xl font-semibold tracking-tight">{c.editing ? 'Изменить бронирование' : 'Забронировать комнату'}</h2>
    <p className="mt-2 text-sm leading-6 text-stone-500">Рабочий день: 09:00–18:00. От 30 минут до 2 часов. Формат времени — 24 часа, с точностью до минуты.</p>
    <form noValidate className="mt-6 space-y-5" onSubmit={event => {
      event.preventDefault()
      void c.save().then(field => {
        if (field) { pendingFocus.current = field; setFocusRequest(value => value + 1) }
      })
    }} aria-busy={c.isBusy}>
      <div className="grid grid-cols-2 gap-3">
        {(['start', 'end'] as const).map(field => <TimeField key={field}
          id={`booking-${field}`} label={field === 'start' ? 'Начало' : 'Окончание'}
          min={field === 'start' ? c.startMin : '09:30'} max={field === 'start' ? '17:30' : '18:00'}
          disabled={c.isBusy} value={c.draft[field]} error={c.errors[field]}
          onChange={value => c.changeField(field, value)} />)}
      </div>
      <div>
        <label htmlFor="booking-title" className="field-label">Название <span className="font-normal text-stone-500">· необязательно</span></label>
        <input id="booking-title" type="text" autoComplete="off" placeholder="Например, встреча команды" value={c.draft.title} disabled={c.isBusy} onChange={e => c.changeField('title', e.target.value)} aria-invalid={!!c.errors.title?.length} aria-describedby={c.errors.title?.length ? 'title-error' : undefined} className="field-input" />
        {!!c.errors.title?.length && <p id="title-error" className="field-error">{c.errors.title.join(' ')}</p>}
      </div>
      {c.unavailable && <p className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900" role="status">{c.unavailable}</p>}
      {c.notice && <p role={c.notice.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm leading-6 ${c.notice.kind === 'error' ? 'bg-red-50 text-red-800' : 'bg-teal-50 text-teal-800'}`}>{c.notice.text}</p>}
      <button type="submit" disabled={!c.canSave} className="primary-button w-full">{c.isBusy ? 'Сохраняем изменения…' : c.editing ? 'Сохранить изменения' : 'Создать бронирование'}</button>
      {c.editing && <div className="flex items-center justify-between gap-3 border-t border-stone-100 pt-4">
        <button type="button" onClick={c.cancel} disabled={c.isBusy} className="secondary-button">Отмена</button>
        <button type="button" disabled={c.isBusy} onClick={() => { if (window.confirm('Удалить это бронирование?')) void c.remove() }} className="secondary-button text-red-700 hover:bg-red-50">Удалить бронь</button>
      </div>}
    </form>
  </section>
}

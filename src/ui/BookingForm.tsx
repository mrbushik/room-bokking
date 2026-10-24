import { useRef } from 'react'
import type { BookingController } from '../application/useBookingController'

export function BookingForm({ controller: c }: { controller: BookingController }) {
  const heading = useRef<HTMLHeadingElement>(null)
  return <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6" aria-labelledby="form-heading">
    <p className="text-xs font-semibold tracking-widest text-teal-700 uppercase">{c.editing ? 'Редактирование' : 'Новая встреча'}</p>
    <h2 id="form-heading" ref={heading} className="mt-2 text-xl font-semibold tracking-tight">{c.editing ? 'Изменить бронирование' : 'Забронировать комнату'}</h2>
    <p className="mt-2 text-sm leading-6 text-stone-500">От 30 минут до 2 часов. Начать можно в любую минуту.</p>
    <form noValidate className="mt-6 space-y-5" onSubmit={event => {
      event.preventDefault()
      void c.save().then(field => { if (field) document.getElementById(`booking-${field}`)?.focus() })
    }} aria-busy={c.isBusy}>
      <div className="grid grid-cols-2 gap-3">
        {(['start', 'end'] as const).map(field => <div key={field} className="min-w-0">
          <label htmlFor={`booking-${field}`} className="field-label">{field === 'start' ? 'Начало' : 'Окончание'}</label>
          <input id={`booking-${field}`} type="time" step="60" min={field === 'start' ? c.startMin : '09:30'} max={field === 'start' ? '17:30' : '18:00'} required disabled={c.isBusy} value={c.draft[field]} onChange={e => c.changeField(field, e.target.value)} aria-invalid={!!c.errors[field]?.length} aria-describedby={c.errors[field]?.length ? `${field}-error` : undefined} className="field-input" />
          {!!c.errors[field]?.length && <p id={`${field}-error`} className="field-error">{c.errors[field]?.join(' ')}</p>}
        </div>)}
      </div>
      <div>
        <label htmlFor="booking-title" className="field-label">Название <span className="font-normal text-stone-400">· необязательно</span></label>
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

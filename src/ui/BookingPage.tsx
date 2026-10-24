import type { BookingController } from '../application/useBookingController'
import { BookingForm } from './BookingForm'
import { DayTimeline } from './DayTimeline'

export function BookingPage({ controller: c }: { controller: BookingController }) {
  return <main className="mx-auto max-w-6xl px-4 py-7 sm:px-8 sm:py-12">
    <header className="flex flex-wrap items-start justify-between gap-5 border-b border-stone-200 pb-7">
      <div><p className="text-xs font-semibold tracking-[0.2em] text-teal-700 uppercase">Переговорная / 01</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Место для ваших встреч</h1><p className="mt-3 text-sm leading-6 text-stone-500">Одна комната. Понятное расписание. Рабочий день 09:00–18:00.</p></div>
      <span className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs text-stone-500">Демо · данные в этом браузере</span>
    </header>
    <div className="my-7 flex flex-wrap items-end justify-between gap-4">
      <div><label htmlFor="booking-date" className="field-label">Дата</label><input id="booking-date" type="date" required value={c.date} disabled={c.isBusy} onChange={e => c.changeDate(e.target.value)} aria-invalid={!!c.errors.date?.length} aria-describedby={c.errors.date?.length ? 'date-error' : 'timezone-note'} className="field-input w-auto max-w-full" />{!!c.errors.date?.length && <p id="date-error" className="field-error">{c.errors.date.join(' ')}</p>}</div>
      <p id="timezone-note" className="text-xs leading-5 text-stone-500">Время местное · {c.timezone}<br />{c.editing ? 'Изменение даты переносит выбранную бронь.' : 'Дата общая для расписания и новой брони.'}</p>
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="schedule-heading" className="min-w-0 rounded-2xl border border-stone-200 bg-stone-50/70 p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 id="schedule-heading" className="text-xl font-semibold">{c.dayLabel}</h2><p className="mt-1 text-xs text-stone-500">09:00 — 18:00 · {c.bookings.length} бронирований</p></div><button type="button" className="secondary-button text-sm" onClick={() => { void c.refresh() }} disabled={c.query.isFetching || c.isBusy}>Обновить расписание</button></div>
        {c.query.isFetching && <p role="status" className="mb-4 text-sm text-stone-500">{c.query.data === undefined ? 'Загружаем расписание…' : 'Обновляем расписание…'}</p>}
        {c.query.fetchStatus === 'paused' && <p role="status" className="mb-4 text-sm text-amber-800">Загрузка ожидает подключения к сети.</p>}
        {(c.query.isError || c.refreshWarning) && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800">{c.refreshWarning || 'Не удалось загрузить расписание. Повторите загрузку.'}</p>}
        {c.query.data !== undefined && <DayTimeline bookings={c.bookings} busy={c.isBusy} onEdit={c.edit} />}
        {c.query.data === undefined && !c.query.isFetching && !c.query.isError && <p className="py-10 text-center text-stone-500">Выберите корректную дату.</p>}
      </section>
      <BookingForm controller={c} />
    </div>
    <footer className="mt-8 border-t border-stone-200 pt-5 text-xs leading-6 text-stone-400">Брони не пересекаются. Соседние интервалы могут начинаться сразу друг за другом.</footer>
  </main>
}

import type { Booking } from '../domain/booking'

export function DayTimeline({ bookings, busy, onEdit }: { bookings: readonly Booking[]; busy: boolean; onEdit(booking: Booking): void }) {
  if (!bookings.length) return <div className="rounded-xl border border-dashed border-stone-200 px-6 py-14 text-center"><p className="font-medium text-stone-700">На этот день пока нет бронирований</p><p className="mt-2 text-sm text-stone-500">Выберите время в форме, чтобы забронировать комнату.</p></div>
  return <ol className="space-y-3" aria-label="Бронирования дня">
    {bookings.map(booking => <li key={booking.id}>
      <button type="button" disabled={busy} onClick={() => onEdit(booking)} aria-label={`Редактировать ${booking.title || 'бронь без названия'} ${booking.start}–${booking.end}`} className="group flex w-full min-w-0 items-center gap-4 rounded-xl border border-stone-200 bg-white p-4 text-left transition hover:border-teal-400 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60">
        <span className="w-1 self-stretch rounded-full bg-teal-600" aria-hidden="true" />
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-teal-800">{booking.start} — {booking.end}</span><span className="mt-1 block truncate font-medium text-stone-800">{booking.title || 'Без названия'}</span></span>
        <span className="shrink-0 text-xl text-stone-400" aria-hidden="true">↗</span>
      </button>
    </li>)}
  </ol>
}

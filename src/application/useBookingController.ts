import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BookingsApi } from '../api/contracts'
import { ApiError } from '../api/errors'
import type { Booking, BookingField, BookingInput, FieldErrors } from '../domain/booking'
import { issueFields, validateBooking } from '../domain/bookingRules'
import { earliestStart, formatTime, isValidDate, localDate, WORK_END, type Clock } from '../domain/time'
import { bookingsOptions } from './bookingQueries'
import { useNow } from './useNow'

const emptyDraft = () => ({ start: '', end: '', title: '' })
type Command = { kind: 'create'; input: BookingInput } | { kind: 'update'; input: BookingInput; id: string } | { kind: 'delete'; id: string }
type Notice = { kind: 'error' | 'success'; text: string } | null

export function useBookingController(api: BookingsApi, clock: Clock) {
  const now = useNow(clock)
  const [date, setDate] = useState(() => localDate(clock.now()))
  const [draft, setDraft] = useState(emptyDraft)
  const [editing, setEditing] = useState<Booking | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [notice, setNotice] = useState<Notice>(null)
  const [refreshWarning, setRefreshWarning] = useState('')
  const busy = useRef(false)
  const client = useQueryClient()
  const query = useQuery(bookingsOptions(api, date))

  async function refresh() {
    setRefreshWarning('')
    try { await client.invalidateQueries({ queryKey: ['bookings'], refetchType: 'active' }, { throwOnError: true }) }
    catch { setRefreshWarning('Не удалось обновить расписание. Отображаемые данные могут быть неактуальны.') }
  }

  const mutation = useMutation({
    retry: false,
    mutationFn: async (command: Command) => {
      if (command.kind === 'delete') { await api.remove(command.id); return }
      if (command.kind === 'update') return api.update(command.id, command.input)
      return api.create(command.input)
    },
    onSuccess: async (_saved, command) => {
      setNotice({ kind: 'success', text: command.kind === 'delete' ? 'Бронирование удалено.' : 'Бронирование сохранено.' })
      setDraft(emptyDraft())
      setEditing(null)
      setErrors({})
      await refresh()
    },
    onError: async (error) => {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Не удалось сохранить изменения.' })
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors)
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) await refresh()
    },
  })

  async function save(): Promise<BookingField | undefined> {
    if (busy.current || query.data === undefined) return
    const input = { date, ...draft }
    const issues = validateBooking(input, query.data, clock.now(), editing?.id)
    if (issues.length) {
      setErrors(issueFields(issues))
      setNotice({ kind: 'error', text: 'Проверьте дату и время бронирования.' })
      return issues[0]?.field
    }
    busy.current = true
    setErrors({})
    setNotice(null)
    try { await mutation.mutateAsync(editing ? { kind: 'update', id: editing.id, input } : { kind: 'create', input }) }
    catch (error) {
      if (error instanceof ApiError) return (['date', 'start', 'end', 'title'] as const).find(field => error.fieldErrors?.[field]?.length)
    } finally { busy.current = false }
  }

  async function remove() {
    if (!editing || busy.current) return
    busy.current = true
    setNotice(null)
    try { await mutation.mutateAsync({ kind: 'delete', id: editing.id }) }
    catch { /* onError keeps the current draft and reports the failure. */ }
    finally { busy.current = false }
  }

  function changeDate(value: string) {
    if (busy.current) return
    setDate(value)
    setErrors({})
    setNotice(null)
    setRefreshWarning('')
  }
  function changeField(field: 'start' | 'end' | 'title', value: string) {
    if (busy.current) return
    setDraft(previous => ({ ...previous, [field]: value }))
    setErrors(previous => ({ ...previous, [field]: [] }))
  }
  function edit(booking: Booking) {
    if (busy.current) return
    setDate(booking.date)
    setEditing(booking)
    setDraft({ start: booking.start, end: booking.end, title: booking.title ?? '' })
    setErrors({})
    setNotice(null)
  }
  function cancel() {
    if (busy.current) return
    setEditing(null)
    setDraft(emptyDraft())
    setErrors({})
    setNotice(null)
  }
  const earliest = earliestStart(date, now)
  const validDate = isValidDate(date)
  const unavailable = !validDate ? 'Выберите дату.' : date < localDate(now) ? 'Прошедший день доступен только для просмотра. Для сохранения выберите будущую дату.' : earliest > WORK_END - 30 ? 'Сегодня уже не осталось времени для новой брони. Выберите другой день.' : ''
  return {
    date, draft, editing, errors, notice, refreshWarning, query,
    bookings: query.data ?? [], now, isBusy: mutation.isPending,
    unavailable, startMin: formatTime(Math.min(earliest, WORK_END)),
    canSave: validDate && query.data !== undefined && !unavailable && !mutation.isPending,
    dayLabel: validDate ? new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Выберите дату',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    changeDate, changeField, edit, cancel, save, remove, refresh,
  }
}

export type BookingController = ReturnType<typeof useBookingController>

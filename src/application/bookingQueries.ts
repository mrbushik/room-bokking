import { queryOptions } from '@tanstack/react-query'
import type { BookingsApi } from '../api/contracts'
import { isValidDate } from '../domain/time'

export const bookingKey = (date: string) => ['bookings', date] as const

export function bookingsOptions(api: BookingsApi, date: string) {
  return queryOptions({
    queryKey: bookingKey(date),
    queryFn: ({ signal }) => api.list(date, signal),
    enabled: isValidDate(date),
    refetchOnWindowFocus: false,
    staleTime: 0,
  })
}

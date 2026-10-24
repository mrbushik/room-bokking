import type { BookingsApi } from '../api/contracts'
import type { Clock } from '../domain/time'
import { useBookingController } from '../application/useBookingController'
import { BookingPage } from '../ui/BookingPage'

export function App({ api, clock }: { api: BookingsApi; clock: Clock }) {
  const controller = useBookingController(api, clock)
  return <BookingPage controller={controller} />
}

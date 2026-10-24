import type { Booking, BookingInput, FieldErrors } from '../domain/booking'

export type CreateBookingDto = BookingInput
export type UpdateBookingDto = Partial<BookingInput>
export type ErrorCode = 'INVALID_REQUEST' | 'VALIDATION_ERROR' | 'BOOKING_NOT_FOUND' | 'BOOKING_CONFLICT' | 'STORAGE_ERROR' | 'INTERNAL_ERROR'
export interface ErrorEnvelope { error: { code: ErrorCode; message: string; fieldErrors?: FieldErrors } }
export interface BookingsApi {
  list(date: string, signal?: AbortSignal): Promise<Booking[]>
  create(input: CreateBookingDto): Promise<Booking>
  update(id: string, input: UpdateBookingDto): Promise<Booking>
  remove(id: string): Promise<void>
}

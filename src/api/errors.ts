import type { FieldErrors } from '../domain/booking'

export class ApiError extends Error {
  readonly kind: 'http' | 'network' | 'protocol'
  readonly status: number | undefined
  readonly code: string
  readonly fieldErrors: FieldErrors | undefined

  constructor(message: string, options: { kind: ApiError['kind']; status?: number; code: string; fieldErrors?: FieldErrors }) {
    super(message)
    this.name = 'ApiError'
    this.kind = options.kind
    this.status = options.status
    this.code = options.code
    this.fieldErrors = options.fieldErrors
  }
}

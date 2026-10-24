import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/errors'

export function createQueryClient() {
  return new QueryClient({ defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: false,
      retry: (count, error) => count < 1 && error instanceof ApiError && (error.kind === 'network' || (error.status ?? 0) >= 500),
    },
    mutations: { retry: false },
  } })
}

export const queryClient = createQueryClient()

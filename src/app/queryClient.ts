import { QueryClient } from '@tanstack/react-query'

// HTTP retry rules and booking queries are added with the API/application layer.
export const queryClient = new QueryClient()

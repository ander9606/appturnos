import { QueryClient } from '@tanstack/react-query';
import { isClientError } from './apiErrorMessage';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minute — workers in the field need fresh-enough data
      retry: (failureCount, error: unknown) => {
        if (isClientError(error)) return false; // 4xx: repetir el mismo request nunca lo arregla
        return failureCount < 2;
      },
    },
  },
});

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import axios from 'axios';
import { Toaster, toast } from 'sonner';
import App from './App';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import './index.css';

function getErrMsg(err: unknown) {
  return axios.isAxiosError(err)
    ? (err.response?.data?.message as string | undefined) ?? 'No se pudo cargar la información'
    : 'No se pudo cargar la información';
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
  // Sin esto, una petición fallida se veía igual que "no hay datos" — el usuario
  // nunca se enteraba de que fue un error de red, no una lista vacía real.
  queryCache: new QueryCache({
    onError: (err) => toast.error(getErrMsg(err)),
  }),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);

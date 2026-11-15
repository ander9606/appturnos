/**
 * useTodasLasOfertasDisponibles: a diferencia de useOfertas, no se puede quedar con la primera página —
 * si hay más ofertas que el límite de una página, debe seguir pidiendo hasta agotar el total.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTodasLasOfertasDisponibles } from '../useTurnos';

const mockListar = jest.fn();
jest.mock('@api-client', () => ({ turnosApi: { listarOfertas: (...a: unknown[]) => mockListar(...a) } }));
jest.mock('@/features/auth/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ usuario: { rol: 'trabajador_turnos', id: 1 } }) }));

let qc: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  mockListar.mockReset();
});
afterEach(() => { qc.clear(); });

const oferta = (id: number) => ({ id, grupo_id: 1, puestos: [] });

test('una sola página alcanza con una sola llamada', async () => {
  mockListar.mockResolvedValue({ data: [oferta(1), oferta(2)], pagination: { page: 1, limit: 200, total: 2 } });
  const { result } = renderHook(() => useTodasLasOfertasDisponibles(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.data).toEqual([oferta(1), oferta(2)]);
  expect(mockListar).toHaveBeenCalledTimes(1);
});

test('con más ofertas que el límite de una página, pide las páginas que falten', async () => {
  mockListar
    .mockResolvedValueOnce({ data: [oferta(1), oferta(2)], pagination: { page: 1, limit: 2, total: 5 } })
    .mockResolvedValueOnce({ data: [oferta(3), oferta(4)], pagination: { page: 2, limit: 2, total: 5 } })
    .mockResolvedValueOnce({ data: [oferta(5)], pagination: { page: 3, limit: 2, total: 5 } });
  const { result } = renderHook(() => useTodasLasOfertasDisponibles(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.data).toEqual([oferta(1), oferta(2), oferta(3), oferta(4), oferta(5)]);
  expect(mockListar).toHaveBeenCalledTimes(3);
  expect(mockListar).toHaveBeenNthCalledWith(2, { disponibles: true, limit: 200, page: 2 });
});

test('si el backend se queda corto (nunca debería pasar), no entra en loop infinito', async () => {
  mockListar.mockResolvedValue({ data: [], pagination: { page: 1, limit: 200, total: 999 } });
  const { result } = renderHook(() => useTodasLasOfertasDisponibles(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.data).toEqual([]);
});

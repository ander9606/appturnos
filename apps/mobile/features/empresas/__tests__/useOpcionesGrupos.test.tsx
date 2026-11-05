/**
 * useOpcionesGrupos: ¿usa la empresa los grupos de turnos y cómo los llama? Lo que importa es el valor
 * seguro mientras no se sabe (apagado, "Grupo") y que un cambio del admin se vea al instante.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOpcionesGrupos, ETIQUETA_GRUPO_DEFECTO } from '../useOpcionesGrupos';

const mockObtener = jest.fn();
jest.mock('@api-client', () => ({
  empresasApi: { obtenerOpcionesGrupos: (...a: unknown[]) => mockObtener(...a) },
}));

let qc: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  mockObtener.mockReset();
});
// El temporizador de recolección de la caché mantendría vivo el proceso de Jest.
afterEach(() => { qc.clear(); });

test('mientras carga: apagado y con el nombre por defecto', () => {
  mockObtener.mockReturnValue(new Promise(() => {}));
  const { result } = renderHook(() => useOpcionesGrupos(), { wrapper });
  expect(result.current).toEqual({ usa: false, etiqueta: ETIQUETA_GRUPO_DEFECTO, isLoading: true });
});

test('empresa con grupos y nombre propio', async () => {
  mockObtener.mockResolvedValue({ usa_grupos_turno: true, etiqueta_grupo: 'Evento' });
  const { result } = renderHook(() => useOpcionesGrupos(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current).toEqual({ usa: true, etiqueta: 'Evento', isLoading: false });
});

test('sin nombre propio (null, vacío o solo espacios) usa "Grupo"; con espacios sobrantes los recorta', async () => {
  for (const [guardado, esperado] of [[null, 'Grupo'], ['', 'Grupo'], ['   ', 'Grupo'], ['  Obra  ', 'Obra']] as const) {
    qc.clear();
    mockObtener.mockResolvedValue({ usa_grupos_turno: true, etiqueta_grupo: guardado });
    const { result } = renderHook(() => useOpcionesGrupos(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.etiqueta).toBe(esperado);
  }
});

test('empresa que no usa grupos: apagado', async () => {
  mockObtener.mockResolvedValue({ usa_grupos_turno: false, etiqueta_grupo: null });
  const { result } = renderHook(() => useOpcionesGrupos(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.usa).toBe(false);
});

test('si la consulta falla, queda apagado (lo nuevo no aparece sin saber que la empresa lo encendió)', async () => {
  mockObtener.mockRejectedValue(new Error('red'));
  const { result } = renderHook(() => useOpcionesGrupos(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current).toEqual({ usa: false, etiqueta: ETIQUETA_GRUPO_DEFECTO, isLoading: false });
});

test('cuando el admin cambia las opciones y se invalida la consulta, el hook se actualiza solo', async () => {
  mockObtener.mockResolvedValue({ usa_grupos_turno: false, etiqueta_grupo: null });
  const { result } = renderHook(() => useOpcionesGrupos(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.usa).toBe(false);

  mockObtener.mockResolvedValue({ usa_grupos_turno: true, etiqueta_grupo: 'Evento' });
  await qc.invalidateQueries({ queryKey: ['opciones-grupos'] });
  await waitFor(() => expect(result.current).toEqual({ usa: true, etiqueta: 'Evento', isLoading: false }));
});

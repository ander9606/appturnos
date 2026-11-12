/**
 * Paso 1 de crear turno con grupos: elegir un grupo prellena el lugar del turno (valor por defecto); nunca pisa un
 * lugar que el usuario ya escribió; sin la función no se dibuja nada de esto. (El aviso de dónde salió el lugar se
 * muestra en el paso «Lugar»: ver StepLugar.test.tsx.)
 */
import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Step1Basicos } from '@/features/turnos/crear/Step1Basicos';
import { INITIAL, type WizardData } from '@/features/turnos/crear/types';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
jest.mock('@/components/ui/PlanetIllustration', () => ({ PlanetIllustration: () => null }));
jest.mock('@/components/ui/Spinner', () => {
  const { View } = require('react-native');
  return { Spinner: () => <View testID="spinner" /> };
});
jest.mock('@/lib/theme', () => ({ useTheme: () => ({ primary: '#111111', primaryLight: '#222222' }) }));
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('@/features/turnos/crear/TrabajadorPickerModal', () => ({ TrabajadorPickerModal: () => null }));

const mockOpciones = jest.fn();
const mockListar = jest.fn();
jest.mock('@api-client', () => ({
  ...jest.requireActual('@api-client'),
  empresasApi: { obtenerOpcionesGrupos: (...a: unknown[]) => mockOpciones(...a) },
  gruposTurnoApi: { listar: (...a: unknown[]) => mockListar(...a) },
}));
jest.mock('@/lib/alertDialog', () => ({ showAlert: jest.fn() }));

const FERIA = { id: 3, empresa_id: 1, nombre: 'Feria del Libro', descripcion: null, lugar: 'Corferias', latitud: 4.63, longitud: -74.09,
  estado: 'activo', cerrado_at: null, created_at: '', total_turnos: 2, fecha_inicio: '2026-11-09', fecha_fin: '2026-11-10', fase: 'proximo' };

let qc: QueryClient;
let ultimo: WizardData;
function Arnes({ inicial }: { inicial: WizardData }) {
  const [data, setData] = useState(inicial);
  ultimo = data;
  return <Step1Basicos data={data} onChange={(p) => setData((d) => ({ ...d, ...p }))} onNext={() => {}} />;
}
function montar(inicial: Partial<WizardData> = {}) {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={qc}><Arnes inicial={{ ...INITIAL, ...inicial }} /></QueryClientProvider>);
}
const elegirFeria = async () => {
  const abrir = await screen.findByRole('button', { name: 'Elegir Evento' });
  await act(async () => { fireEvent.press(abrir); });
  const fila = await screen.findByText('Feria del Libro');
  await act(async () => { fireEvent.press(fila); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListar.mockResolvedValue([FERIA]);
  mockOpciones.mockResolvedValue({ usa_grupos_turno: true, etiqueta_grupo: 'Evento' });
});
afterEach(() => { qc?.clear(); });

test('turno sin lugar: al elegir el grupo toma su lugar', async () => {
  montar();
  await elegirFeria();
  expect(ultimo.grupo).toEqual({ id: 3, nombre: 'Feria del Libro', lugar: 'Corferias', lugar_alias: null, latitud: 4.63, longitud: -74.09 });
  expect(ultimo).toMatchObject({ lugar: 'Corferias', latitud: 4.63, longitud: -74.09 });
});

test('un lugar que el usuario ya escribió no se pisa', async () => {
  montar({ lugar: 'Mi bodega' });
  await elegirFeria();
  expect(ultimo.grupo?.id).toBe(3);
  expect(ultimo.lugar).toBe('Mi bodega');
});

test('quitar el grupo no borra el lugar', async () => {
  montar();
  await elegirFeria();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Quitar Evento' })); });
  expect(ultimo.grupo).toBeNull();
  expect(ultimo.lugar).toBe('Corferias');
});

test('turno de ubicación libre: elegir grupo no le pone lugar', async () => {
  montar({ ubicacion_libre: true });
  await elegirFeria();
  expect(ultimo.grupo?.id).toBe(3);
  expect(ultimo.lugar).toBe('');
});

test('empresa que no usa grupos: el paso 1 es el de siempre', async () => {
  mockOpciones.mockResolvedValue({ usa_grupos_turno: false, etiqueta_grupo: null });
  montar();
  await screen.findByText('Título del turno *');
  await waitFor(() => expect(mockOpciones).toHaveBeenCalled());
  await act(async () => {}); // deja que la respuesta se refleje antes de comprobar que no hay nada
  expect(screen.queryByText('Elegir…')).toBeNull();
  expect(screen.queryByText('+ Crear')).toBeNull();
  expect(mockListar).not.toHaveBeenCalled();
});

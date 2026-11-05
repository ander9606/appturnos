/**
 * Textos de la tarjeta de oferta del gestor: dicen de qué hablan (postulantes por revisar, no un "pendiente" suelto)
 * y usan las mismas palabras que la web.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { GestorTurnosView } from '../GestorTurnosView';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
jest.mock('@/components/ui/PlanetIllustration', () => ({ PlanetIllustration: () => null }));
jest.mock('@/components/ui/Spinner', () => {
  const { View } = require('react-native');
  return { Spinner: () => <View testID="spinner" /> };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/confirmDialog', () => ({ confirm: jest.fn() }));
jest.mock('@/lib/alertDialog', () => ({ showAlert: jest.fn(), alertError: jest.fn() }));

const mockOfertas = jest.fn();
const mockOferta = jest.fn();
jest.mock('@/features/turnos/useTurnos', () => ({
  useOfertas: (...a: unknown[]) => mockOfertas(...a),
  useOferta: (...a: unknown[]) => mockOferta(...a),
  useConfirmar: () => ({}), useRechazar: () => ({}), useCancelar: () => ({}), useNoPresentado: () => ({}),
  useEliminarOfertaDefinitivo: () => ({}),
}));

const oferta = (extra = {}) => ({
  id: 5, titulo: 'Montaje stand', fecha: '2099-01-15', hora_inicio: '08:00:00', hora_fin_estimada: '17:00:00', lugar: 'Corferias',
  estado: 'abierta', puestos: [{ id: 1, cargo_id: 1, cargo_nombre: 'Auxiliar', plazas: 3, plazas_cubiertas: 1, tarifa_dia: 50000 }],
  grupo_nombre: null, necesita_completar: false, ...extra,
}) as never;
const detalle = (estados: string[]) => ({ data: { asignaciones: estados.map((estado, i) => ({ id: i, estado })) }, isLoading: false });

function montar(o: unknown, det: unknown = { data: undefined, isLoading: false }, selectedDate = '2099-01-15') {
  mockOfertas.mockReturnValue({ data: { data: [o] }, isLoading: false, isError: false, refetch: () => {}, isRefetching: false });
  mockOferta.mockReturnValue(det);
  render(<GestorTurnosView selectedDate={selectedDate} puedeGestionar />);
}

beforeEach(() => jest.clearAllMocks());

test('postulantes sin revisar: dice cuántos', () => {
  montar(oferta(), detalle(['pendiente', 'pendiente', 'confirmado']));
  expect(screen.getByText('2 postulantes por revisar')).toBeTruthy();
});

test('un solo postulante: singular', () => {
  montar(oferta(), detalle(['pendiente']));
  expect(screen.getByText('1 postulante por revisar')).toBeTruthy();
});

test('nadie por revisar: "Postulaciones al día", como en la web', () => {
  montar(oferta(), detalle(['confirmado', 'rechazado']));
  expect(screen.getByText('Postulaciones al día')).toBeTruthy();
  expect(screen.queryByText(/por revisar/)).toBeNull();
});

test('turno terminado que nadie marcó como completado: "Falta marcar completado"', () => {
  montar(oferta({ necesita_completar: true }), undefined, '2020-01-15');
  expect(screen.getByText('Falta marcar completado')).toBeTruthy();
});

test('los textos viejos ya no aparecen', () => {
  montar(oferta({ necesita_completar: true }), detalle(['pendiente']));
  for (const viejo of ['Falta completar', '1 pendiente', 'Sin pendientes']) expect(screen.queryByText(viejo)).toBeNull();
});

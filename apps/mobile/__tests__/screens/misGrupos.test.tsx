/**
 * «Mis eventos»: la pantalla propia del trabajador con sus turnos agrupados. Dos pestañas (por hacer / terminados),
 * solo eventos (sin los turnos sueltos), el nombre que la empresa le puso a los grupos y los estados de carga y error.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import MisGruposScreen from '../../app/mis-grupos';

let mockTitulo: string | undefined;
jest.mock('expo-router', () => ({
  Stack: { Screen: (p: { options: { title?: string } }) => { mockTitulo = p.options.title; return null; } },
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
jest.mock('@/components/ui/PlanetIllustration', () => ({ PlanetIllustration: () => null }));
jest.mock('@/lib/theme', () => ({ useTheme: () => ({ primary: '#111111' }) }));
jest.mock('@/components/RoleGuard', () => ({ useRoleGuard: () => mockDenied }));
jest.mock('@/components/ui/Skeleton', () => {
  const { View } = require('react-native');
  return { SkeletonList: () => <View testID="skeleton" /> };
});
jest.mock('@/lib/formatters', () => ({ ...jest.requireActual('@/lib/formatters'), bogotaToday: () => '2030-01-10' }));
jest.mock('@/features/turnos/ShiftCard', () => {
  const { Text } = require('react-native');
  return { ShiftCard: (p: { asignacion: { id: number } }) => <Text>{`turno ${p.asignacion.id}`}</Text> };
});
let mockDenied: React.ReactElement | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockQuery: any;
jest.mock('@/features/turnos/useTurnos', () => ({ useMisTurnos: () => mockQuery }));

let n = 0;
const A = (o: Record<string, unknown> = {}) => ({
  id: ++n, empresa_id: 1, oferta_id: n, estado: 'confirmado', oferta_fecha: '2030-01-20', hora_inicio: '08:00:00',
  grupo_id: 3, grupo_nombre: 'Feria del Libro', grupo_etiqueta: 'Evento', contrato_firmado: 1, ...o,
});
const ok = (data: unknown[]) => ({ data, isLoading: false, isError: false, error: null, refetch: jest.fn(), isRefetching: false });

beforeEach(() => { mockDenied = null; mockTitulo = undefined; mockQuery = ok([]); });

test('muestra solo eventos, separados en «Por hacer» y «Terminados» con su cuenta', () => {
  mockQuery = ok([
    A({ id: 1 }),
    A({ id: 2, grupo_id: 4, grupo_nombre: 'Obra Norte', estado: 'completado', oferta_fecha: '2030-01-05' }),
    A({ id: 3, grupo_id: null, grupo_nombre: null }), // turno suelto: no es un evento
  ]);
  render(<MisGruposScreen />);
  expect(screen.getByText('Por hacer (1)')).toBeTruthy();
  expect(screen.getByText('Terminados (1)')).toBeTruthy();
  expect(screen.getByText('Feria del Libro')).toBeTruthy();
  expect(screen.queryByText('Obra Norte')).toBeNull();
  expect(screen.queryByText('Sin nombre')).toBeNull();
  fireEvent.press(screen.getByText('Terminados (1)'));
  expect(screen.getByText('Obra Norte')).toBeTruthy();
  expect(screen.queryByText('Feria del Libro')).toBeNull();
});

test('el título usa el nombre que la empresa de sus turnos le puso a los grupos', () => {
  mockQuery = ok([A({ id: 1 })]);
  render(<MisGruposScreen />);
  expect(mockTitulo).toBe('Mis eventos');
});

test('en dos empresas que los llaman distinto, el título los nombra a los dos y cada tarjeta lleva el suyo', () => {
  mockQuery = ok([A({ id: 1 }), A({ id: 2, empresa_id: 2, grupo_id: 9, grupo_nombre: 'Casa Norte', grupo_etiqueta: 'Obra', empresa_nombre: 'Constructora Sur' })]);
  render(<MisGruposScreen />);
  expect(mockTitulo).toBe('Mis eventos y obras');
  expect(screen.getByText('Obra · Constructora Sur')).toBeTruthy();
});

test('sin ningún evento lo explica y manda a Turnos para el resto', () => {
  mockQuery = ok([A({ grupo_id: null, grupo_nombre: null })]);
  render(<MisGruposScreen />);
  expect(screen.getByText('Todavía no tienes grupos')).toBeTruthy(); // sin grupos que nombrar, el nombre por defecto
  expect(screen.getByText(/pestaña Turnos/)).toBeTruthy();
});

test('vacíos por pestaña cuando sí hay eventos', () => {
  mockQuery = ok([A({ id: 1, estado: 'completado', oferta_fecha: '2030-01-05' })]);
  render(<MisGruposScreen />);
  expect(screen.getByText('Nada por hacer')).toBeTruthy();
  mockQuery = ok([A({ id: 2 })]);
  const { unmount } = render(<MisGruposScreen />);
  fireEvent.press(screen.getAllByText('Terminados (0)')[0]);
  expect(screen.getAllByText('Nada terminado todavía').length).toBeGreaterThan(0);
  unmount();
});

test('carga con esqueleto, y un error ofrece reintentar', () => {
  mockQuery = { ...ok([]), data: undefined, isLoading: true };
  const { unmount } = render(<MisGruposScreen />);
  expect(screen.getByTestId('skeleton')).toBeTruthy();
  unmount();
  const refetch = jest.fn();
  mockQuery = { ...ok([]), data: undefined, isError: true, error: new Error('x'), refetch };
  render(<MisGruposScreen />);
  fireEvent.press(screen.getByText('Reintentar'));
  expect(refetch).toHaveBeenCalled();
});

test('quien no es trabajador de turnos no la ve', () => {
  const { Text } = require('react-native');
  mockDenied = <Text>Sin acceso</Text>;
  render(<MisGruposScreen />);
  expect(screen.getByText('Sin acceso')).toBeTruthy();
  expect(screen.queryByText(/Por hacer/)).toBeNull();
});

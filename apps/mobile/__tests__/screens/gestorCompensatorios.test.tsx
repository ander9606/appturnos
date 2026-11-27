/**
 * Compensatorios del gestor: una tabla (tarjeta) por empleado, con su nombre una sola vez, quienes tienen
 * pendientes arriba y las filas del compensatorio más antiguo al más nuevo — antes era una tarjeta por
 * compensatorio con el nombre repetido en cada una. Cada tarjeta es plegable: abiertos por defecto solo quienes
 * tienen pendientes (hasta 3).
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import GestorCompensatoriosScreen from '../../app/gestor-compensatorios';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
jest.mock('@/components/ui/PlanetIllustration', () => ({ PlanetIllustration: () => null }));
jest.mock('@/lib/theme', () => ({ useTheme: () => ({ primary: '#111111' }) }));
jest.mock('@/lib/formatters', () => ({ ...jest.requireActual('@/lib/formatters'), bogotaToday: () => '2026-11-10' }));
jest.mock('@/components/RoleGuard', () => ({ useRoleGuard: () => null }));
jest.mock('@/components/ui/Skeleton', () => {
  const { View } = require('react-native');
  return { SkeletonList: () => <View testID="skeleton" /> };
});
jest.mock('@/features/nomina/compensatorios/RangoFechasCompensatorio', () => ({ RangoFechasCompensatorio: () => null }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockLista: any[] = [];
const mockMutation = { mutate: jest.fn(), isPending: false };
jest.mock('@/features/nomina/compensatorios/useCompensatorios', () => ({
  useCompensatoriosTodos: () => ({ data: mockLista, isLoading: false, isRefetching: false, refetch: jest.fn() }),
  useAsignarCompensatorio: () => mockMutation,
  useReasignarCompensatorio: () => mockMutation,
}));

const c = (id: number, trabajador_id: number, nombre: string, origen_fecha: string, estado: string, fecha_asignada: string | null = null) => ({
  id, trabajador_id, trabajador_nombre: nombre, trabajador_apellido: 'Prueba', periodo_id: 1,
  origen_fecha, estado, fecha_asignada, clasificacion: 'habitual',
});

beforeEach(() => {
  mockLista = [
    c(1, 1, 'Laura', '2026-11-01', 'pendiente'),
    c(2, 1, 'Laura', '2026-11-15', 'pendiente'),
    c(3, 2, 'Carlos', '2026-11-08', 'asignado', '2026-11-26'),
  ];
});

test('muestra el nombre de cada empleado una sola vez, con su cuenta de pendientes', () => {
  render(<GestorCompensatoriosScreen />);
  expect(screen.getAllByText('Laura Prueba')).toHaveLength(1);
  expect(screen.getByText('2 pendientes')).toBeTruthy();
  expect(screen.getByText('2 descansos')).toBeTruthy();
  // Carlos solo tiene un asignado: con el filtro por defecto (Pendientes) no aparece.
  expect(screen.queryByText('Carlos Prueba')).toBeNull();
});

test('«Todos» agrega a los empleados con descansos asignados, sin repetir el nombre en las filas', () => {
  render(<GestorCompensatoriosScreen />);
  fireEvent.press(screen.getByText('Todos'));
  expect(screen.getAllByText('Carlos Prueba')).toHaveLength(1);
  expect(screen.getByText('1 descanso')).toBeTruthy();
  // Carlos no tiene pendientes: llega plegado; se abre tocando su cabecera.
  expect(screen.getAllByText(/^Trabajó el/).length).toBe(2);
  fireEvent.press(screen.getByLabelText(/^Desplegar compensatorios de Carlos Prueba/));
  // Las filas dicen cuándo trabajó, no repiten el nombre.
  expect(screen.getAllByText(/^Trabajó el/).length).toBe(3);
});

test('plegado: el resumen dice cuándo vence el pendiente más antiguo, y el estado queda en accessibilityState', () => {
  render(<GestorCompensatoriosScreen />);
  // Laura: el más antiguo es del 1 nov → vence el 29 nov; hoy (mockeado) es el 10 → 19 días.
  expect(screen.getAllByText('Vence en 19 días').length).toBeGreaterThan(0);
  const cab = screen.getByLabelText(/^Contraer compensatorios de Laura Prueba/);
  expect(cab.props.accessibilityState).toEqual({ expanded: true });
  fireEvent.press(cab);
  expect(screen.queryByText(/^Trabajó el/)).toBeNull();
  expect(screen.getByLabelText(/^Desplegar compensatorios de Laura Prueba/).props.accessibilityState).toEqual({ expanded: false });
});

test('«Expandir todo» / «Contraer todo» con varios empleados', () => {
  render(<GestorCompensatoriosScreen />);
  fireEvent.press(screen.getByText('Todos'));
  fireEvent.press(screen.getByText('Expandir todo'));
  expect(screen.getAllByText(/^Trabajó el/).length).toBe(3);
  fireEvent.press(screen.getByText('Contraer todo'));
  expect(screen.queryByText(/^Trabajó el/)).toBeNull();
});

test('empleado con pendientes y asignados: los asignados van en un subgrupo plegado con su próximo descanso', () => {
  mockLista = [
    c(1, 1, 'Laura', '2026-11-01', 'pendiente'),
    c(2, 1, 'Laura', '2026-10-20', 'asignado', '2026-11-18'),
    c(3, 1, 'Laura', '2026-10-10', 'tomado', '2026-11-02'),
  ];
  render(<GestorCompensatoriosScreen />);
  fireEvent.press(screen.getByText('Todos'));
  // Abierta (tiene pendientes): se ve la fila pendiente, no las asignadas.
  expect(screen.getAllByText(/^Trabajó el/)).toHaveLength(1);
  const sub = screen.getByLabelText('Ver 2 descansos asignados o tomados');
  expect(screen.getByText(/^Asignados y tomados · 2 · próximo .*18 Nov$/)).toBeTruthy();
  fireEvent.press(sub);
  expect(screen.getAllByText(/^Trabajó el/)).toHaveLength(3);
  expect(screen.getByLabelText('Ocultar 2 descansos asignados o tomados').props.accessibilityState).toEqual({ expanded: true });
});

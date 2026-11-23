/**
 * Compensatorios del gestor: una tabla (tarjeta) por empleado, con su nombre una sola vez, quienes tienen
 * pendientes arriba y las filas del compensatorio más antiguo al más nuevo — antes era una tarjeta por
 * compensatorio con el nombre repetido en cada una.
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
  // Las filas dicen cuándo trabajó, no repiten el nombre.
  expect(screen.getAllByText(/^Trabajó el/).length).toBe(3);
});

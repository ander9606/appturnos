/**
 * Registros del equipo (gestor): quien tiene algo por revisar va primero, con ícono + número en lugar de frases;
 * el período se ve arriba; si la lista llegó recortada se avisa; y cargando / vacío usan los componentes de marca.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import RegistrosPeriodoScreen from '../../app/registros-periodo';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ periodoId: '5', fechaInicio: '2026-11-16', fechaFin: '2026-11-30' }),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
jest.mock('@/components/ui/PlanetIllustration', () => ({ PlanetIllustration: () => null }));
jest.mock('@/components/RoleGuard', () => ({ useRoleGuard: () => null }));
jest.mock('@/features/auth/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ usuario: { rol: 'jefe_nomina' } }) }));
jest.mock('@/lib/formatters', () => ({ ...jest.requireActual('@/lib/formatters'), bogotaToday: () => '2026-11-25' }));
jest.mock('@/components/ui/Skeleton', () => {
  const { View } = require('react-native');
  return { SkeletonList: () => <View testID="skeleton" /> };
});
jest.mock('@/features/nomina/useHorasPreviasSemana', () => ({ useHorasPreviasSemana: () => ({ lunes: null, porTrabajador: new Map() }) }));
jest.mock('@/features/nomina/registros/CrearRegistroModal', () => ({ CrearRegistroModal: () => null }));
jest.mock('@/features/nomina/registros/EditarRegistroModal', () => ({ EditarRegistroModal: () => null }));
jest.mock('@/features/nomina/registros/ReasignarCompensatorioModal', () => ({ ReasignarCompensatorioModal: () => null }));
jest.mock('@/features/nomina/registros/UbicacionMarcajeModal', () => ({ UbicacionMarcajeModal: () => null }));
jest.mock('@/features/nomina/registros/RegistroRow', () => ({ RegistroRow: () => null }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockRegistros: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockComp: any[] = [];
jest.mock('@/features/nomina/useNomina', () => ({ useRegistros: () => mockRegistros }));
jest.mock('@/features/nomina/compensatorios/useCompensatorios', () => ({ useCompensatoriosTodos: () => ({ data: mockComp }) }));

const ok = (data: unknown[], total = data.length) => ({
  data: { data, pagination: { page: 1, limit: 500, total } }, isLoading: false, isError: false, error: null, refetch: jest.fn(),
});
const reg = (id: number, trabajador_id: number, nombre: string, fecha: string, hora_salida: string | null = '16:00:00', sospechoso: 0 | 1 = 0) => ({
  id, trabajador_id, trabajador_nombre: nombre, trabajador_apellido: 'Prueba', fecha, hora_entrada: '08:00:00', hora_salida, sospechoso,
  tipo_dia: 'ordinario', horas_ordinarias: 8, horas_extra_diurnas: 0, horas_extra_nocturnas: 0, horas_nocturnas: 0, horas_festivo: 0,
});

beforeEach(() => { mockComp = []; });

test('quien tiene novedades va primero, con íconos y números; el período se ve arriba', () => {
  mockRegistros = ok([
    reg(1, 1, 'Ana', '2026-11-20'),                          // sin novedades
    reg(2, 2, 'Beto', '2026-11-20', null),                   // olvidó marcar salida
    reg(3, 2, 'Beto', '2026-11-21', '16:00:00', 1),          // sospechoso
  ]);
  mockComp = [{ trabajador_id: 2, estado: 'pendiente' }, { trabajador_id: 1, estado: 'tomado' }];
  render(<RegistrosPeriodoScreen />);

  const nombres = screen.getAllByText(/Prueba$/).map((n) => [n.props.children].flat().join(''));
  expect(nombres).toEqual(['Beto Prueba', 'Ana Prueba']);
  expect(screen.getByLabelText('1 días sin salida')).toBeTruthy();
  expect(screen.getByLabelText('1 marcajes sospechosos')).toBeTruthy();
  expect(screen.getByLabelText('1 compensatorios pendientes')).toBeTruthy();
  expect(screen.getByText(/Quincena · /)).toBeTruthy();
  expect(screen.queryByText(/Se muestran/)).toBeNull();
});

test('si la lista llegó recortada, lo dice', () => {
  mockRegistros = ok([reg(1, 1, 'Ana', '2026-11-20')], 900);
  render(<RegistrosPeriodoScreen />);
  expect(screen.getByText(/Se muestran 1 de 900 registros/)).toBeTruthy();
});

test('cargando → skeleton; sin registros → estado vacío de marca', () => {
  mockRegistros = { data: undefined, isLoading: true, isError: false, error: null, refetch: jest.fn() };
  const { unmount } = render(<RegistrosPeriodoScreen />);
  expect(screen.getByTestId('skeleton')).toBeTruthy();
  unmount();

  mockRegistros = ok([]);
  render(<RegistrosPeriodoScreen />);
  expect(screen.getByText('Sin registros en este período')).toBeTruthy();
});

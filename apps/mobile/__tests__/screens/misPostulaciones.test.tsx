import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Asignacion } from '@api-client';
import MisPostulacionesScreen from '../../app/mis-postulaciones';

// ── Bordes simulados: la navegación y los datos del servidor ─────────────────
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  Stack: { Screen: () => null },
}));

let mockQuery: { data: Asignacion[]; isLoading: boolean; refetch: () => void };
jest.mock('@/features/turnos/useTurnos', () => ({
  useMisTurnos: () => mockQuery,
}));

const asignacion = (over: Partial<Asignacion>): Asignacion => ({
  id: 1,
  estado: 'pendiente',
  oferta_titulo: 'Turno base',
  oferta_fecha: '2026-06-03',
  hora_inicio: '08:00',
  hora_fin_estimada: null,
  lugar: null,
  pago_total: null,
  ...over,
} as Asignacion);

beforeEach(() => {
  mockPush.mockClear();
  mockQuery = { data: [], isLoading: false, refetch: jest.fn() };
});

describe('MisPostulacionesScreen', () => {
  test('sin turnos: muestra el vacío', () => {
    render(<MisPostulacionesScreen />);
    expect(screen.getByText('Sin postulaciones')).toBeTruthy();
  });

  test('agrupa por estado, en el orden de la pantalla, y omite los grupos vacíos', () => {
    mockQuery.data = [
      asignacion({ id: 1, estado: 'completado', oferta_titulo: 'Evento A', pago_total: 150000 }),
      asignacion({ id: 2, estado: 'pendiente', oferta_titulo: 'Evento B' }),
      asignacion({ id: 3, estado: 'confirmado', oferta_titulo: 'Evento C' }),
      asignacion({ id: 4, estado: 'en_progreso', oferta_titulo: 'Evento D' }),
    ];
    render(<MisPostulacionesScreen />);

    expect(screen.getByText('Esperando confirmación')).toBeTruthy();
    expect(screen.getByText('Confirmadas')).toBeTruthy();
    expect(screen.getByText('Completadas')).toBeTruthy();
    expect(screen.queryByText('Debes reconfirmar')).toBeNull();
    expect(screen.queryByText('Sin postulaciones')).toBeNull();

    // orden de los grupos de arriba abajo
    const textos = screen.getAllByText(/Esperando confirmación|Confirmadas|Completadas/).map((n) => n.props.children);
    expect(textos).toEqual(['Esperando confirmación', 'Confirmadas', 'Completadas']);
  });

  test('muestra el pago solo en turnos completados o fallidos', () => {
    mockQuery.data = [
      asignacion({ id: 1, estado: 'completado', pago_total: 150000 }),
      asignacion({ id: 2, estado: 'pendiente', pago_total: 99000 }),
    ];
    render(<MisPostulacionesScreen />);
    expect(screen.getAllByText(/150\.000/)).toHaveLength(1);
    expect(screen.queryByText(/99\.000/)).toBeNull();
  });

  test('tocar una tarjeta navega al detalle del turno', () => {
    mockQuery.data = [asignacion({ id: 42, oferta_titulo: 'Evento Z' })];
    render(<MisPostulacionesScreen />);
    fireEvent.press(screen.getByText('Evento Z'));
    expect(mockPush).toHaveBeenCalledWith('/turno/42');
  });

  test('cargando: no muestra el vacío', () => {
    mockQuery.isLoading = true;
    render(<MisPostulacionesScreen />);
    expect(screen.queryByText('Sin postulaciones')).toBeNull();
  });
});

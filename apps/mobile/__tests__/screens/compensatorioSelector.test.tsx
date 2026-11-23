/**
 * Selector de compensatorio al marcar un día a mano: lista solo los pendientes del trabajador que se pueden
 * tomar ese día, deja preseleccionado el más antiguo y avisa cuando no hay ninguno.
 */
import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CompensatorioSelector } from '../../features/nomina/compensatorios/CompensatorioSelector';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockLista: any[] = [];
jest.mock('@/features/nomina/compensatorios/useCompensatorios', () => ({
  useCompensatoriosTodos: () => ({ data: mockLista, isLoading: false }),
}));

const c = (id: number, origen_fecha: string, o: Record<string, unknown> = {}) =>
  ({ id, trabajador_id: 7, origen_fecha, estado: 'pendiente', clasificacion: 'habitual', ...o });

let elegido: number | null = null;
function Probe({ fecha = '2026-11-24' }: { fecha?: string }) {
  const [v, setV] = useState<number | null>(null);
  elegido = v;
  return <CompensatorioSelector trabajadorId={7} fecha={fecha} value={v} onChange={setV} />;
}

beforeEach(() => { elegido = null; });

test('preselecciona el más antiguo y deja elegir otro', () => {
  mockLista = [c(1, '2026-11-15'), c(2, '2026-11-01'), c(3, '2026-11-20')];
  render(<Probe />);
  expect(elegido).toBe(2); // el del 1 nov es el más antiguo
  expect(screen.getByText(/el más antiguo/)).toBeTruthy();
  expect(screen.getAllByRole('radio')).toHaveLength(3);

  fireEvent.press(screen.getAllByRole('radio')[2]); // el último de la lista (20 nov)
  expect(elegido).toBe(3);
});

test('no ofrece los vencidos, los ajenos ni los que ya no están pendientes', () => {
  mockLista = [
    c(1, '2026-10-04'),                       // vencido para el 24 nov
    c(2, '2026-11-15', { trabajador_id: 9 }), // otro trabajador
    c(3, '2026-11-08', { estado: 'tomado' }), // ya tomado
    c(4, '2026-11-15'),                       // sirve
  ];
  render(<Probe />);
  expect(screen.getAllByRole('radio')).toHaveLength(1);
  expect(elegido).toBe(4);
});

test('sin compensatorios disponibles avisa y no elige nada', () => {
  mockLista = [c(1, '2026-10-04')];
  render(<Probe />);
  expect(screen.getByText(/no tiene compensatorios pendientes/)).toBeTruthy();
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
  expect(elegido).toBeNull();
});

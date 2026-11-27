/** Banner del trabajador: pendientes y asignados cortos, con ícono de cama y sin prosa de relleno. */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CompensatorioBanner } from '../../features/nomina/compensatorios/CompensatorioBanner';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
jest.mock('@/lib/formatters', () => ({ ...jest.requireActual('@/lib/formatters'), bogotaToday: () => '2026-11-10' }));

const base = { trabajador_id: 1, clasificacion: 'ocasional', origen_fecha: '2026-11-02' };

test('pendientes: título con el conteo y una línea por día trabajado, el habitual con recargo', () => {
  const comps = [
    { ...base, id: 1, estado: 'pendiente' },
    { ...base, id: 2, estado: 'pendiente', clasificacion: 'habitual', origen_fecha: '2026-11-03' },
  ] as never;
  render(<CompensatorioBanner compensatorios={comps} />);
  expect(screen.getByText('2 descansos compensatorios pendientes')).toBeTruthy();
  expect(screen.getAllByText(/Trabajaste el/)).toHaveLength(2);
  expect(screen.getAllByText(/con recargo/)).toHaveLength(1);
  expect(screen.getAllByTestId('icon-bed-outline')).toHaveLength(1);
});

test('asignado próximo: dos líneas, fecha del descanso primero', () => {
  const comps = [{ ...base, id: 3, estado: 'tomado', fecha_asignada: '2026-11-15' }] as never;
  render(<CompensatorioBanner compensatorios={comps} />);
  expect(screen.getByText(/^Descanso el .*: no asistes$/)).toBeTruthy();
  expect(screen.getByText(/^Por tu trabajo el /)).toBeTruthy();
});

test('sin pendientes ni próximos no pinta nada', () => {
  const { toJSON } = render(<CompensatorioBanner compensatorios={[{ ...base, id: 4, estado: 'tomado', fecha_asignada: '2026-11-01' }] as never} />);
  expect(toJSON()).toBeNull();
});

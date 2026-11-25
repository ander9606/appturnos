/**
 * Franja de la semana: los 7 días con lo que cae dentro del período en color y lo de fuera atenuado, una etiqueta corta
 * por tramo (en vez de tres líneas de texto) y una cama en el día del compensatorio.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SemanaRow } from '../../features/nomina/trabajador/components/ResumenCards';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});

const PERIODO = { fecha_inicio: '2026-10-16', fecha_fin: '2026-10-31' };
const semana = (o: Record<string, unknown> = {}) => ({
  inicioSemana: '2026-10-12', horasTotales: 47.5, limiteHoras: 42, horasExtra: 5.5, horasPrevias: 42, ...o,
}) as never;

test('semana partida por el inicio del período: etiquetas cortas por tramo, sin las tres líneas de texto', () => {
  render(<SemanaRow semana={semana()} valorHora={0} periodo={PERIODO} />);
  expect(screen.getByText('Anterior · 42.0h')).toBeTruthy();
  expect(screen.getByText('Este período · 5.5h')).toBeTruthy();
  expect(screen.getByLabelText(/4 días del período anterior, 3 días de este período/)).toBeTruthy();
  // El texto de antes ya no está.
  expect(screen.queryByText(/Período anterior ·/)).toBeNull();
  expect(screen.queryByText(/Este período · Vie/)).toBeNull();
});

test('semana que sigue en el período siguiente', () => {
  render(<SemanaRow semana={semana({ inicioSemana: '2026-10-26', horasPrevias: 0, horasTotales: 20, horasExtra: 0 })} valorHora={0} periodo={PERIODO} />);
  expect(screen.getByText('Siguiente')).toBeTruthy();
  expect(screen.getByLabelText(/6 días de este período, 1 día del período siguiente/)).toBeTruthy();
});

test('semana completa dentro del período: sin franja', () => {
  render(<SemanaRow semana={semana({ inicioSemana: '2026-10-19', horasPrevias: 0, horasTotales: 30, horasExtra: 0 })} valorHora={0} periodo={PERIODO} />);
  expect(screen.queryByText('Siguiente')).toBeNull();
  expect(screen.queryByText(/Anterior/)).toBeNull();
});

test('compensatorio: cama en el día del descanso y una línea corta con el festivo de origen', () => {
  render(<SemanaRow
    semana={semana({ inicioSemana: '2026-10-19', horasPrevias: 0, horasTotales: 38, horasExtra: 0, horasCompensatorio: 8,
      origenesCompensatorio: ['2026-10-18'], fechasCompensatorio: ['2026-10-22'] })}
    valorHora={0}
    periodo={PERIODO}
  />);
  expect(screen.getAllByTestId('icon-bed-outline').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText(/\+8\.0h por el compensatorio del Dom 18 Oct/)).toBeTruthy();
  expect(screen.getByLabelText(/Descanso compensatorio el Jue 22 Oct/)).toBeTruthy();
});

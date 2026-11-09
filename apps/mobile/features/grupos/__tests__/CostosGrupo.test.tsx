/** Costos del evento: para pagar, sin firmar (frenado), por hacer (estimado), en espera y el total proyectado. */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CostosGrupo } from '../CostosGrupo';
import { formatCOP } from '@/lib/formatters';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('@/components/ui/Text');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
jest.mock('@/components/ui/Skeleton', () => {
  const { View } = require('react-native');
  return { Skeleton: () => <View testID="skeleton" /> };
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockQuery: any;
jest.mock('../useGrupos', () => ({ useCostosGrupo: () => mockQuery }));

const C = (o: Record<string, unknown> = {}) => ({
  real: { total: 140000, tarifas: 130000, bonos: 15000, descuentos: 5000, turnos_pagados: 2 },
  sin_firmar: { cantidad: 0, monto: 0 }, en_espera: { cantidad: 0 }, estimado: { total: 0, turnos: 0 },
  proyectado: 140000, trabajadores: 3, horas: 12.5, ...o,
});
const ok = (data: unknown) => ({ data, isLoading: false, isError: false, refetch: jest.fn() });
const montar = () => render(<CostosGrupo grupoId={3} />);

test('muestra el costo proyectado y «Para pagar» con su desglose de bonos y descuentos', () => {
  mockQuery = ok(C());
  montar();
  expect(screen.getByText('Costo proyectado')).toBeTruthy();
  expect(screen.getByLabelText(`Costo proyectado ${formatCOP(140000)}`)).toBeTruthy();
  expect(screen.getByText('Para pagar')).toBeTruthy();
  expect(screen.getByText(`2 turnos · bonos ${formatCOP(15000)} · descuentos −${formatCOP(5000)}`)).toBeTruthy();
  expect(screen.getByText('3 trabajadores · 12,5 h trabajadas')).toBeTruthy();
  expect(screen.queryByText('Sin firmar')).toBeNull();
  expect(screen.queryByText('Por hacer')).toBeNull();
});

test('lo sin firmar y lo que falta por hacer salen aparte, con su monto; el proyectado los incluye', () => {
  mockQuery = ok(C({ sin_firmar: { cantidad: 1, monto: 60000 }, estimado: { total: 170000, turnos: 2 }, proyectado: 370000 }));
  montar();
  expect(screen.getByText('Sin firmar')).toBeTruthy();
  expect(screen.getByText(/1 turno · su pago sigue frenado/)).toBeTruthy();
  expect(screen.getByText(formatCOP(60000))).toBeTruthy();
  expect(screen.getByText('Por hacer')).toBeTruthy();
  expect(screen.getByText(/2 turnos · estimado con la tarifa/)).toBeTruthy();
  expect(screen.getByText(formatCOP(170000))).toBeTruthy();
  expect(screen.getByLabelText(`Costo proyectado ${formatCOP(370000)}`)).toBeTruthy();
});

test('los turnos con compensación sin responder se avisan (singular y plural) y no suman', () => {
  mockQuery = ok(C({ en_espera: { cantidad: 1 } }));
  const { unmount } = montar();
  expect(screen.getByText(/1 turno con una compensación sin responder: no suma hasta/)).toBeTruthy();
  unmount();
  mockQuery = ok(C({ en_espera: { cantidad: 2 } }));
  montar();
  expect(screen.getByText(/2 turnos con una compensación sin responder: no suman hasta/)).toBeTruthy();
});

test('un grupo sin costos (nada terminado ni comprometido) no dibuja la tarjeta', () => {
  mockQuery = ok(C({ real: { total: 0, tarifas: 0, bonos: 0, descuentos: 0, turnos_pagados: 0 }, proyectado: 0, trabajadores: 0, horas: 0 }));
  const { toJSON } = montar();
  expect(toJSON()).toBeNull();
});

test('con solo turnos en espera sí se muestra (hay algo que avisar)', () => {
  mockQuery = ok(C({ proyectado: 0, en_espera: { cantidad: 1 }, real: { total: 0, tarifas: 0, bonos: 0, descuentos: 0, turnos_pagados: 0 } }));
  montar();
  expect(screen.getByText(/compensación sin responder/)).toBeTruthy();
});

test('carga con esqueleto y, si falla, ofrece reintentar', () => {
  mockQuery = { data: undefined, isLoading: true, isError: false, refetch: jest.fn() };
  const { unmount } = montar();
  expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  unmount();
  const refetch = jest.fn();
  mockQuery = { data: undefined, isLoading: false, isError: true, refetch };
  montar();
  fireEvent.press(screen.getByText('Reintentar'));
  expect(refetch).toHaveBeenCalled();
});

test('no nombra al grupo con una palabra fija: cada empresa le pone la suya («Evento», «Obra»…)', () => {
  mockQuery = ok(C({ sin_firmar: { cantidad: 1, monto: 60000 }, estimado: { total: 170000, turnos: 2 }, en_espera: { cantidad: 1 } }));
  const { toJSON } = montar();
  expect(JSON.stringify(toJSON())).not.toMatch(/evento|obra|proyecto/i);
});

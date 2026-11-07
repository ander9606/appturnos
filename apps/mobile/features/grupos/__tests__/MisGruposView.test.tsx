/** «Mis turnos» por grupo: tarjeta con avance, aviso de contratos sin firmar y turnos que se despliegan. */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MisGruposView } from '../MisGruposView';

const mockPush = jest.fn();
let mockEtiqueta = 'Grupo';
jest.mock('@/features/empresas/useOpcionesGrupos', () => ({ useOpcionesGrupos: () => ({ usa: true, etiqueta: mockEtiqueta, etiquetaPlural: `${mockEtiqueta}s`, isLoading: false }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
jest.mock('@/components/ui/PlanetIllustration', () => ({ PlanetIllustration: () => null }));
jest.mock('@/features/turnos/ShiftCard', () => {
  const { Text, Pressable } = require('react-native');
  return { ShiftCard: (p: { asignacion: { id: number }; onPress: () => void }) => <Pressable testID={`shift-${p.asignacion.id}`} onPress={p.onPress}><Text>{`turno ${p.asignacion.id}`}</Text></Pressable> };
});

let n = 0;
const A = (o: Record<string, unknown> = {}) => ({
  id: ++n, empresa_id: 1, oferta_id: n, estado: 'confirmado', oferta_fecha: '2030-01-10', hora_inicio: '08:00:00',
  grupo_id: 3, grupo_nombre: 'Feria del Libro', empresa_nombre: 'Acme', contrato_firmado: 1, ...o,
}) as never;

test('muestra avance y próximo turno, y los turnos solo al desplegar', () => {
  const asig = [A({ id: 1, estado: 'completado', oferta_fecha: '2030-01-05' }), A({ id: 2, oferta_fecha: '2030-01-20' })];
  render(<MisGruposView asignaciones={asig} />);
  expect(screen.getByText('Feria del Libro')).toBeTruthy();
  expect(screen.getByText(/1 de 2 terminado · 1 por hacer/)).toBeTruthy();
  expect(screen.getByText(/Próximo:/)).toBeTruthy();
  expect(screen.getByText('Acme')).toBeTruthy();
  expect(screen.queryByTestId('shift-1')).toBeNull();

  const tarjeta = screen.getByRole('button', { name: /Feria del Libro/ });
  fireEvent.press(tarjeta);
  expect(tarjeta.props.accessibilityState.expanded).toBe(true);
  fireEvent.press(screen.getByTestId('shift-2'));
  expect(mockPush).toHaveBeenCalledWith('/turno/2');
  fireEvent.press(screen.getByRole('button', { name: /Feria del Libro/ }));
  expect(screen.queryByTestId('shift-1')).toBeNull();
});

test('avisa de los contratos sin firmar, y no avisa si todo está firmado', () => {
  const { rerender } = render(<MisGruposView asignaciones={[A({ estado: 'completado', contrato_firmado: 0 })]} />);
  expect(screen.getByText(/Tienes 1 turno terminado sin firmar el contrato/)).toBeTruthy();
  rerender(<MisGruposView asignaciones={[A({ estado: 'completado', contrato_firmado: 1 })]} />);
  expect(screen.queryByText(/sin firmar el contrato/)).toBeNull();
});

test('un grupo ya terminado no muestra «Próximo»', () => {
  render(<MisGruposView asignaciones={[A({ estado: 'completado' })]} />);
  expect(screen.queryByText(/Próximo:/)).toBeNull();
});

test('puede desplegar varios a la vez y distingue «Sin grupo»', () => {
  render(<MisGruposView asignaciones={[A({ id: 1 }), A({ id: 2, grupo_id: null, grupo_nombre: null })]} />);
  fireEvent.press(screen.getByRole('button', { name: /Feria del Libro/ }));
  fireEvent.press(screen.getByRole('button', { name: /Sin grupo/ }));
  expect(screen.getByTestId('shift-1')).toBeTruthy();
  expect(screen.getByTestId('shift-2')).toBeTruthy();
});

test('sin turnos muestra el vacío', () => {
  render(<MisGruposView asignaciones={[]} />);
  expect(screen.getByText('Sin turnos todavía')).toBeTruthy();
});

test('«Sin …» usa el nombre que la empresa le puso a los grupos', () => {
  mockEtiqueta = 'Evento';
  render(<MisGruposView asignaciones={[A({ id: 1, grupo_id: null, grupo_nombre: null })]} />);
  expect(screen.getByText('Sin evento')).toBeTruthy();
  expect(screen.queryByText('Sin grupo')).toBeNull();
  mockEtiqueta = 'Grupo';
});

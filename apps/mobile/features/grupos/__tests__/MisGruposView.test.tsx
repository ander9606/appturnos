/** Los eventos del trabajador: tarjeta con momento, avance, aviso de contratos sin firmar y turnos que se despliegan. */
import React from 'react';
import { Text } from '@/components/ui/Text';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MisGruposView } from '../MisGruposView';
import { agruparMisTurnos } from '../misGrupos';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@expo/vector-icons', () => {
  const { Text: T } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <T testID={`icon-${name}`} /> });
});
jest.mock('@/lib/formatters', () => ({ ...jest.requireActual('@/lib/formatters'), bogotaToday: () => '2030-01-10' }));
jest.mock('@/features/turnos/ShiftCard', () => {
  const { Text: T, Pressable } = require('react-native');
  return { ShiftCard: (p: { asignacion: { id: number }; onPress: () => void }) => <Pressable testID={`shift-${p.asignacion.id}`} onPress={p.onPress}><T>{`turno ${p.asignacion.id}`}</T></Pressable> };
});

let n = 0;
const A = (o: Record<string, unknown> = {}) => ({
  id: ++n, empresa_id: 1, oferta_id: n, estado: 'confirmado', oferta_fecha: '2030-01-20', hora_inicio: '08:00:00',
  grupo_id: 3, grupo_nombre: 'Feria del Libro', grupo_etiqueta: 'Evento', empresa_nombre: 'Acme', contrato_firmado: 1, ...o,
}) as never;
const montar = (asig: unknown[]) => render(<MisGruposView grupos={agruparMisTurnos(asig as never)} vacio={<Text>VACÍO</Text>} />);

test('muestra momento, fechas, avance y próximo turno, y los turnos solo al desplegar', () => {
  montar([A({ id: 1, estado: 'completado', oferta_fecha: '2030-01-05' }), A({ id: 2, oferta_fecha: '2030-01-20' })]);
  expect(screen.getByText('Feria del Libro')).toBeTruthy();
  expect(screen.getByText('En curso')).toBeTruthy(); // ya empezó (5 ene) y le falta uno
  expect(screen.getByText(/1 de 2 terminado · 1 por hacer/)).toBeTruthy();
  expect(screen.getByLabelText('50% de tus turnos terminados')).toBeTruthy();
  expect(screen.getByText(/Próximo:/)).toBeTruthy();
  expect(screen.getByText('Evento · Acme')).toBeTruthy(); // el nombre que su empresa le da a los grupos, y cuál empresa es
  expect(screen.queryByTestId('shift-1')).toBeNull();

  const tarjeta = screen.getByRole('button', { name: /Feria del Libro/ });
  fireEvent.press(tarjeta);
  expect(tarjeta.props.accessibilityState.expanded).toBe(true);
  expect(screen.getByTestId('icon-chevron-up')).toBeTruthy();
  fireEvent.press(screen.getByTestId('shift-2'));
  expect(mockPush).toHaveBeenCalledWith('/turno/2');
  fireEvent.press(screen.getByRole('button', { name: /Feria del Libro/ }));
  expect(screen.queryByTestId('shift-1')).toBeNull();
});

test('un evento que aún no empieza es «Próximo» y uno sin nada por hacer es «Terminado» (sin «Próximo:»)', () => {
  const { unmount } = montar([A({ oferta_fecha: '2030-02-01' })]);
  expect(screen.getByText('Próximo', { exact: true })).toBeTruthy();
  unmount();
  montar([A({ estado: 'completado', oferta_fecha: '2030-01-05' })]);
  expect(screen.getByText('Terminado')).toBeTruthy();
  expect(screen.queryByText(/Próximo:/)).toBeNull();
});

test('avisa de los contratos sin firmar, y no avisa si todo está firmado', () => {
  const { unmount } = montar([A({ estado: 'completado', contrato_firmado: 0, oferta_fecha: '2030-01-05' })]);
  expect(screen.getByText(/Tienes 1 turno terminado sin firmar el contrato/)).toBeTruthy();
  unmount();
  montar([A({ estado: 'completado', contrato_firmado: 1, oferta_fecha: '2030-01-05' })]);
  expect(screen.queryByText(/sin firmar el contrato/)).toBeNull();
});

test('puede desplegar varios eventos a la vez', () => {
  montar([A({ id: 1 }), A({ id: 2, grupo_id: 4, grupo_nombre: 'Obra Norte' })]);
  fireEvent.press(screen.getByRole('button', { name: /Feria del Libro/ }));
  fireEvent.press(screen.getByRole('button', { name: /Obra Norte/ }));
  expect(screen.getByTestId('shift-1')).toBeTruthy();
  expect(screen.getByTestId('shift-2')).toBeTruthy();
});

test('sin eventos muestra lo que le pasaron como vacío', () => {
  montar([]);
  expect(screen.getByText('VACÍO')).toBeTruthy();
});

test('dos empresas que llaman distinto a sus grupos: cada tarjeta lleva el suyo', () => {
  montar([A({ id: 1 }), A({ id: 2, empresa_id: 2, grupo_id: 9, grupo_nombre: 'Casa Norte', grupo_etiqueta: 'Obra', empresa_nombre: 'Constructora Sur' })]);
  expect(screen.getByText('Evento · Acme')).toBeTruthy();
  expect(screen.getByText('Obra · Constructora Sur')).toBeTruthy();
});

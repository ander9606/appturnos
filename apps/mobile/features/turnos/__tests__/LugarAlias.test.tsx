/**
 * "Nombre corto" del lugar en los formularios: aparece solo con una dirección que no es de la biblioteca,
 * sugiere un nombre, y deja guardar el lugar en la biblioteca con ese nombre (opcional, lo decide el usuario).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { LugarAlias } from '../crear/LugarAlias';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
const mockCrear = jest.fn();
let mockPuntos: { id: number; nombre: string }[] = [];
jest.mock('@/features/turnos/usePuntosMarcaje', () => ({
  usePuntosParaTurnos: () => ({ data: mockPuntos }),
  useCrearPuntoMarcaje: () => ({ mutateAsync: (...a: unknown[]) => mockCrear(...a), isPending: false }),
}));
const mockAlert = jest.fn();
jest.mock('@/lib/alertDialog', () => ({ showAlert: (...a: unknown[]) => mockAlert(...a) }));

const LARGA = 'Corferias, Carrera 37, Quinta Paredes, Teusaquillo, Bogotá, Colombia';
const props = (extra = {}) => ({ lugar: LARGA, latitud: 4.63, longitud: -74.09, alias: '', onChange: jest.fn(), ...extra });

beforeEach(() => { jest.clearAllMocks(); mockPuntos = [{ id: 1, nombre: 'Bodega Central' }]; });

test('sin lugar no aparece', () => {
  render(<LugarAlias {...props({ lugar: '   ' })} />);
  expect(screen.toJSON()).toBeNull();
});

test('un lugar de la biblioteca ya tiene nombre corto: no lo pide', () => {
  render(<LugarAlias {...props({ lugar: 'bodega central' })} />);
  expect(screen.toJSON()).toBeNull();
});

test('con una dirección larga ofrece el campo y una sugerencia que se aplica con un toque', () => {
  const p = props();
  render(<LugarAlias {...p} />);
  expect(screen.getByText('Nombre corto (opcional)')).toBeTruthy();
  fireEvent.press(screen.getByText('Usar «Corferias»'));
  expect(p.onChange).toHaveBeenCalledWith('Corferias');
});

test('escribir el nombre llama a onChange', () => {
  const p = props();
  render(<LugarAlias {...p} />);
  fireEvent.changeText(screen.getByLabelText('Nombre corto del lugar'), 'Feria');
  expect(p.onChange).toHaveBeenCalledWith('Feria');
});

test('con nombre y coordenadas deja guardarlo en la biblioteca (alcance todos, radio 100)', async () => {
  mockCrear.mockResolvedValue({});
  render(<LugarAlias {...props({ alias: '  Corferias ' })} />);
  expect(screen.queryByText(/Usar «/)).toBeNull(); // ya hay nombre: no sugiere
  fireEvent.press(screen.getByText('Guardar en mi biblioteca'));
  await waitFor(() => expect(mockCrear).toHaveBeenCalledWith({ nombre: 'Corferias', latitud: 4.63, longitud: -74.09, radio_metros: 100, alcance: 'todos', tipo: 'fijo' }));
});

test('sin coordenadas (dirección escrita a mano) no ofrece guardar en la biblioteca', () => {
  render(<LugarAlias {...props({ alias: 'Corferias', latitud: null, longitud: null })} />);
  expect(screen.queryByText('Guardar en mi biblioteca')).toBeNull();
});

test('si ese nombre ya está en la biblioteca lo dice y no ofrece guardarlo otra vez', () => {
  mockPuntos = [{ id: 1, nombre: 'Corferias' }];
  render(<LugarAlias {...props({ alias: 'corferias' })} />);
  expect(screen.getByText('En tu biblioteca')).toBeTruthy();
  expect(screen.queryByText('Guardar en mi biblioteca')).toBeNull();
});

test('si el servidor rechaza guardarlo, avisa con su motivo', async () => {
  const { ApiError } = jest.requireActual('@api-client');
  mockCrear.mockRejectedValue(new ApiError('Nombre inválido', undefined, 422));
  render(<LugarAlias {...props({ alias: 'Corferias' })} />);
  fireEvent.press(screen.getByText('Guardar en mi biblioteca'));
  await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('No se pudo guardar', 'Nombre inválido'));
});

/**
 * Editar un grupo desde su tarjeta o su detalle: parte de lo guardado, valida el nombre y el lugar, guarda solo lo que
 * el servidor acepta (vaciar un texto lo quita), avisa un nombre repetido sin llamarlo "grupo" y no arrastra lo que
 * se escribió y no se guardó.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { EditarGrupoModal } from '../EditarGrupoModal';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
// El buscador de direcciones y el nombre corto tienen sus propias pruebas: aquí se simula lo que le pasan al formulario.
jest.mock('@/features/turnos/crear/LugarInput', () => {
  const { Text, Pressable } = require('react-native');
  return { LugarInput: ({ value, onChange }: { value: string; onChange: (l: string, a: number | null, b: number | null) => void }) => (
    <>
      <Text testID="lugar-valor">{value}</Text>
      <Pressable testID="elegir-lugar" onPress={() => onChange('Plaza de Bolívar, Carrera 7, Bogotá', 4.598, -74.076)}><Text>elegir</Text></Pressable>
      <Pressable testID="escribir-lugar" onPress={() => onChange('Calle escrita a mano', null, null)}><Text>escribir</Text></Pressable>
      <Pressable testID="vaciar-lugar" onPress={() => onChange('', null, null)}><Text>vaciar</Text></Pressable>
    </>
  ) };
});
jest.mock('@/features/turnos/crear/LugarAlias', () => {
  const { Text } = require('react-native');
  return { LugarAlias: ({ alias }: { alias: string }) => <Text testID="alias-valor">{alias}</Text> };
});
const mockActualizar = jest.fn();
jest.mock('../useGrupos', () => ({ useActualizarGrupo: () => ({ mutateAsync: (...a: unknown[]) => mockActualizar(...a), isPending: false }) }));
const mockAlert = jest.fn();
jest.mock('@/lib/alertDialog', () => ({ showAlert: (...a: unknown[]) => mockAlert(...a) }));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({ showToast: (...a: unknown[]) => mockToast(...a) }));

const GRUPO = {
  id: 3, empresa_id: 1, nombre: 'Feria del Libro', descripcion: 'Dos semanas', lugar: 'Corferias, Carrera 37, Bogotá', lugar_alias: 'Corferias',
  latitud: 4.63, longitud: -74.09, estado: 'activo', cerrado_at: null, created_at: '', total_turnos: 2, fecha_inicio: null, fecha_fin: null, fase: 'proximo',
} as never;

const montar = (props = {}) => {
  const p = { onClose: jest.fn(), ...props };
  const r = render(<EditarGrupoModal visible grupo={GRUPO} etiqueta="Evento" {...p} />);
  return { ...r, p };
};

beforeEach(() => jest.clearAllMocks());

test('arranca con lo guardado y usa la etiqueta de la empresa en el título', () => {
  montar();
  expect(screen.getByText('Editar Evento')).toBeTruthy();
  expect(screen.getByDisplayValue('Feria del Libro')).toBeTruthy();
  expect(screen.getByDisplayValue('Dos semanas')).toBeTruthy();
  expect(screen.getByTestId('lugar-valor').props.children).toBe('Corferias, Carrera 37, Bogotá');
  expect(screen.getByTestId('alias-valor').props.children).toBe('Corferias');
});

test('guardar manda los cambios, avisa y cierra', async () => {
  mockActualizar.mockResolvedValue({});
  const { p } = montar();
  fireEvent.changeText(screen.getByDisplayValue('Feria del Libro'), '  Feria 2030 ');
  fireEvent.press(screen.getByText('Guardar cambios'));
  await waitFor(() => expect(mockActualizar).toHaveBeenCalledWith({
    id: 3,
    payload: { nombre: 'Feria 2030', descripcion: 'Dos semanas', lugar: 'Corferias, Carrera 37, Bogotá', lugar_alias: 'Corferias', latitud: 4.63, longitud: -74.09 },
  }));
  expect(mockToast).toHaveBeenCalledWith('Cambios guardados.');
  expect(p.onClose).toHaveBeenCalled();
});

test('sin nombre no guarda y lo dice', () => {
  montar();
  fireEvent.changeText(screen.getByDisplayValue('Feria del Libro'), '   ');
  fireEvent.press(screen.getByText('Guardar cambios'));
  expect(screen.getByText('Escribe un nombre.')).toBeTruthy();
  expect(mockActualizar).not.toHaveBeenCalled();
});

test('una dirección escrita a mano no se guarda: pide elegirla de la lista', () => {
  montar();
  fireEvent.press(screen.getByTestId('escribir-lugar'));
  fireEvent.press(screen.getByText('Guardar cambios'));
  expect(screen.getByText('Elige una dirección de la lista, o deja el lugar vacío.')).toBeTruthy();
  expect(mockActualizar).not.toHaveBeenCalled();
});

test('elegir otro lugar deja sin efecto el nombre corto del anterior y se guarda el nuevo', async () => {
  mockActualizar.mockResolvedValue({});
  montar();
  fireEvent.press(screen.getByTestId('elegir-lugar'));
  expect(screen.getByTestId('alias-valor').props.children).toBe('');
  fireEvent.press(screen.getByText('Guardar cambios'));
  await waitFor(() => expect(mockActualizar).toHaveBeenCalledWith({
    id: 3,
    payload: expect.objectContaining({ lugar: 'Plaza de Bolívar, Carrera 7, Bogotá', lugar_alias: null, latitud: 4.598, longitud: -74.076 }),
  }));
});

test('vaciar el lugar lo quita (lugar, nombre corto y coordenadas en null)', async () => {
  mockActualizar.mockResolvedValue({});
  montar();
  fireEvent.press(screen.getByTestId('vaciar-lugar'));
  fireEvent.press(screen.getByText('Guardar cambios'));
  await waitFor(() => expect(mockActualizar).toHaveBeenCalledWith({
    id: 3,
    payload: { nombre: 'Feria del Libro', descripcion: 'Dos semanas', lugar: null, lugar_alias: null, latitud: null, longitud: null },
  }));
});

test('nombre repetido: lo avisa con el nombre escrito (sin decir "grupo") y no cierra', async () => {
  const { ApiError } = jest.requireActual('@api-client');
  mockActualizar.mockRejectedValue(new ApiError('Ya existe un grupo llamado "Obra".', undefined, 409, [{ campo: 'nombre', grupo_id: 9 }]));
  const { p } = montar();
  fireEvent.changeText(screen.getByDisplayValue('Feria del Libro'), 'Obra');
  fireEvent.press(screen.getByText('Guardar cambios'));
  expect(await screen.findByText('Ya existe «Obra».')).toBeTruthy();
  expect(p.onClose).not.toHaveBeenCalled();
  expect(mockAlert).not.toHaveBeenCalled();
});

test('otro error del servidor se muestra con su motivo', async () => {
  const { ApiError } = jest.requireActual('@api-client');
  mockActualizar.mockRejectedValue(new ApiError('Los grupos de turnos no están activados para tu empresa.', undefined, 403));
  montar();
  fireEvent.press(screen.getByText('Guardar cambios'));
  await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('No se pudo guardar', 'Los grupos de turnos no están activados para tu empresa.'));
});

test('al volver a abrirlo no arrastra lo que se escribió y no se guardó', () => {
  const { rerender } = montar();
  fireEvent.changeText(screen.getByDisplayValue('Feria del Libro'), 'Algo a medias');
  rerender(<EditarGrupoModal visible={false} grupo={GRUPO} etiqueta="Evento" onClose={jest.fn()} />);
  rerender(<EditarGrupoModal visible grupo={GRUPO} etiqueta="Evento" onClose={jest.fn()} />);
  expect(screen.getByDisplayValue('Feria del Libro')).toBeTruthy();
});

/**
 * Vincular un turno ya creado a un grupo desde su detalle: el gestor elige, cambia o quita el grupo;
 * quien no gestiona (o si la empresa no usa grupos) solo ve la etiqueta.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { GrupoDeLaOferta } from '../GrupoDeLaOferta';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
jest.mock('@/components/ui/PlanetIllustration', () => ({ PlanetIllustration: () => null }));
let mockUsa = true;
jest.mock('@/features/empresas/useOpcionesGrupos', () => ({
  useOpcionesGrupos: () => ({ usa: mockUsa, etiqueta: 'Evento', isLoading: false }),
}));
const mockVincular = jest.fn();
jest.mock('@/features/turnos/useTurnos', () => ({ useVincularGrupo: () => ({ mutateAsync: (...a: unknown[]) => mockVincular(...a) }) }));
// El selector abre una lista de grupos: se simula para pulsar uno sin servidor.
jest.mock('../ElegirGrupoModal', () => {
  const { Pressable, Text } = require('react-native');
  return { ElegirGrupoModal: ({ visible, onSelect }: { visible: boolean; onSelect: (g: unknown) => void }) =>
    (visible ? <Pressable onPress={() => onSelect({ id: 9, nombre: 'Obra Norte', lugar: null, latitud: null, longitud: null })}><Text>Obra Norte</Text></Pressable> : null) };
});
jest.mock('../CrearGrupoModal', () => ({ CrearGrupoModal: () => null }));
const mockAlert = jest.fn();
jest.mock('@/lib/alertDialog', () => ({ showAlert: (...a: unknown[]) => mockAlert(...a) }));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({ showToast: (...a: unknown[]) => mockToast(...a) }));

const sin = { id: 5, grupo_id: null, grupo_nombre: null };
const con = { id: 5, grupo_id: 3, grupo_nombre: 'Feria del Libro' };

beforeEach(() => { jest.clearAllMocks(); mockUsa = true; });

test('quien no gestiona solo ve la etiqueta, sin botones', () => {
  render(<GrupoDeLaOferta oferta={con} puedeGestionar={false} />);
  expect(screen.getByText('Feria del Libro')).toBeTruthy();
  expect(screen.queryByText('Cambiar')).toBeNull();
});

test('si la empresa no usa grupos, el gestor tampoco ve el selector', () => {
  mockUsa = false;
  render(<GrupoDeLaOferta oferta={sin} puedeGestionar />);
  expect(screen.queryByText('Elegir…')).toBeNull();
});

test('turno sin grupo: el gestor elige uno y se vincula', async () => {
  mockVincular.mockResolvedValue({});
  render(<GrupoDeLaOferta oferta={sin} puedeGestionar />);
  fireEvent.press(screen.getByLabelText('Elegir Evento'));
  fireEvent.press(screen.getByText('Obra Norte'));
  await waitFor(() => expect(mockVincular).toHaveBeenCalledWith({ ofertaId: 5, grupoId: 9 }));
  expect(mockToast).toHaveBeenCalledWith('Turno agregado a «Obra Norte».');
});

test('turno con grupo: se puede quitar', async () => {
  mockVincular.mockResolvedValue({});
  render(<GrupoDeLaOferta oferta={con} puedeGestionar />);
  fireEvent.press(screen.getByLabelText('Quitar Evento'));
  await waitFor(() => expect(mockVincular).toHaveBeenCalledWith({ ofertaId: 5, grupoId: null }));
  expect(mockToast).toHaveBeenCalledWith('Turno quitado del grupo.');
});

test('si el servidor rechaza (grupo cerrado), muestra su motivo y no avisa de éxito', async () => {
  const { ApiError } = jest.requireActual('@api-client');
  mockVincular.mockRejectedValue(new ApiError('El grupo está cerrado.', 409));
  render(<GrupoDeLaOferta oferta={sin} puedeGestionar />);
  fireEvent.press(screen.getByLabelText('Elegir Evento'));
  fireEvent.press(screen.getByText('Obra Norte'));
  await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('No se pudo cambiar', 'El grupo está cerrado.'));
  expect(mockToast).not.toHaveBeenCalled();
});

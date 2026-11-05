/**
 * Paso «Lugar» del asistente de crear turno: dirección, nombre corto, ubicación libre y encargado, aparte del paso 1
 * para que el formulario no sea larguísimo. Nada es obligatorio; avisa cuando el lugar viene del grupo.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StepLugar } from '../crear/StepLugar';
import { INITIAL, type WizardData } from '../crear/types';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
jest.mock('@/lib/theme', () => ({ useTheme: () => ({ primary: '#111111', primaryLight: '#222222' }) }));
// El buscador de direcciones es otro componente (con mapa y GPS): aquí solo importa lo que le pasa el paso.
jest.mock('../crear/LugarInput', () => {
  const { Text, Pressable } = require('react-native');
  return { LugarInput: ({ value, onChange }: { value: string; onChange: (l: string, a: number | null, b: number | null) => void }) => (
    <>
      <Text testID="lugar-valor">{value}</Text>
      <Pressable testID="elegir-otro" onPress={() => onChange('Plaza de Bolívar, Carrera 7, Bogotá', 4.598, -74.076)}><Text>elegir otro</Text></Pressable>
      <Pressable testID="escribir" onPress={() => onChange(`${value}x`, null, null)}><Text>escribir</Text></Pressable>
    </>
  ) };
});
jest.mock('../crear/LugarAlias', () => {
  const { Text } = require('react-native');
  return { LugarAlias: ({ alias }: { alias: string }) => <Text testID="alias-valor">{alias}</Text> };
});

const FERIA = { id: 3, nombre: 'Feria del Libro', lugar: 'Corferias', lugar_alias: null, latitud: 4.63, longitud: -74.09 };
const datos = (extra: Partial<WizardData> = {}): WizardData => ({ ...INITIAL, ...extra });
const montar = (data: WizardData) => {
  const p = { onChange: jest.fn(), onNext: jest.fn(), onBack: jest.fn() };
  render(<StepLugar data={data} {...p} />);
  return p;
};

test('muestra el lugar, la ubicación libre y el encargado, con Atrás y Siguiente', () => {
  const p = montar(datos({ lugar: 'Corferias' }));
  expect(screen.getByTestId('lugar-valor').props.children).toBe('Corferias');
  expect(screen.getByText('Ubicación libre')).toBeTruthy();
  expect(screen.getByText('Encargado en el punto')).toBeTruthy();
  fireEvent.press(screen.getByText('← Atrás'));
  fireEvent.press(screen.getByText('Siguiente →'));
  expect(p.onBack).toHaveBeenCalledTimes(1);
  expect(p.onNext).toHaveBeenCalledTimes(1);
});

test('nada es obligatorio: se puede seguir sin lugar', () => {
  const p = montar(datos());
  fireEvent.press(screen.getByText('Siguiente →'));
  expect(p.onNext).toHaveBeenCalledTimes(1);
});

test('con ubicación libre el lugar pasa a ser opcional', () => {
  montar(datos({ ubicacion_libre: true }));
  expect(screen.getByText('Lugar (opcional)')).toBeTruthy();
});

test('avisa de dónde salió el lugar cuando es el del grupo, y no cuando lo cambió', () => {
  const { unmount } = render(<StepLugar data={datos({ grupo: FERIA, lugar: 'Corferias', latitud: 4.63, longitud: -74.09 })} onChange={jest.fn()} onNext={jest.fn()} onBack={jest.fn()} />);
  expect(screen.getByText('Tomado de «Feria del Libro». Puedes cambiarlo.')).toBeTruthy();
  unmount();
  render(<StepLugar data={datos({ grupo: FERIA, lugar: 'Mi bodega', latitud: 4.7, longitud: -74.1 })} onChange={jest.fn()} onNext={jest.fn()} onBack={jest.fn()} />);
  expect(screen.queryByText(/Tomado de/)).toBeNull();
});

test('elegir otro lugar (con coordenadas) deja sin efecto el nombre corto del anterior; escribir a mano no', () => {
  const p = montar(datos({ lugar: 'Corferias, Carrera 37', lugar_alias: 'Feria', latitud: 4.63, longitud: -74.09 }));
  fireEvent.press(screen.getByTestId('elegir-otro'));
  expect(p.onChange).toHaveBeenLastCalledWith({ lugar: 'Plaza de Bolívar, Carrera 7, Bogotá', latitud: 4.598, longitud: -74.076, lugar_alias: '' });
  fireEvent.press(screen.getByTestId('escribir'));
  expect(p.onChange).toHaveBeenLastCalledWith({ lugar: 'Corferias, Carrera 37x', latitud: null, longitud: null });
});

test('escribir el encargado y activar la ubicación libre actualizan los datos', () => {
  const p = montar(datos());
  fireEvent.changeText(screen.getByPlaceholderText('Nombre del encargado'), 'Luis');
  expect(p.onChange).toHaveBeenLastCalledWith({ encargado_nombre: 'Luis' });
  fireEvent(screen.getAllByRole('switch')[0], 'valueChange', true);
  expect(p.onChange).toHaveBeenLastCalledWith({ ubicacion_libre: true });
});

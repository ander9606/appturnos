import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  test('muestra título y mensaje', () => {
    render(<EmptyState title="Sin turnos" message="Aún no hay nada" />);
    expect(screen.getByText('Sin turnos')).toBeTruthy();
    expect(screen.getByText('Aún no hay nada')).toBeTruthy();
  });

  test('el botón de acción llama a onPress', () => {
    const onPress = jest.fn();
    render(<EmptyState title="Sin turnos" action={{ label: 'Crear el primero', onPress }} />);
    fireEvent.press(screen.getByText('Crear el primero'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

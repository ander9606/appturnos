import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { AvisoFuerzaMayor } from '../AvisoFuerzaMayor';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

// Aviso al trabajador antes de postularse: fuerza mayor → compensación (si la tarea no se realiza);
// labor realizada → se paga según contrato.
describe('AvisoFuerzaMayor', () => {
  test('explica la compensación cuando la tarea no se realiza, con el mínimo vigente', () => {
    render(<AvisoFuerzaMayor />);
    expect(screen.getByText('Si el turno se cancela por fuerza mayor')).toBeTruthy();
    expect(screen.getByText(/la tarea no se realiza/)).toBeTruthy();
    expect(screen.getByText(/al menos el 50 % de la tarifa de tu puesto/)).toBeTruthy();
  });

  test('aclara que si la labor se realiza se paga según el contrato', () => {
    render(<AvisoFuerzaMayor />);
    expect(screen.getByText('Si la labor sí se realiza, se te paga según tu contrato.')).toBeTruthy();
  });
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AvisoFuerzaMayor } from '../AvisoFuerzaMayor';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const TITULO = 'Si el turno se cancela por fuerza mayor';
const PAGO_SEGUN_CONTRATO = 'Si la labor sí se realiza, se te paga según tu contrato.';

// Aviso al trabajador antes de postularse, plegado detrás de un «!»: fuerza mayor → compensación (si ya
// marcó ingreso y la tarea no se realiza); labor realizada → se paga según el contrato.
describe('AvisoFuerzaMayor', () => {
  test('arranca plegado: se ve el «!» y el título, no el detalle', () => {
    render(<AvisoFuerzaMayor />);
    expect(screen.getByText('!')).toBeTruthy();
    expect(screen.getByText(TITULO)).toBeTruthy();
    expect(screen.queryByText(PAGO_SEGUN_CONTRATO)).toBeNull();
    expect(screen.getByRole('button', { name: TITULO }).props.accessibilityState).toEqual({ expanded: false });
  });

  test('al tocarlo se despliega: compensación mínima con la condición de haber marcado ingreso, y pago según contrato', () => {
    render(<AvisoFuerzaMayor />);
    fireEvent.press(screen.getByText(TITULO));
    expect(screen.getByText(/después de que marcaste tu ingreso y la tarea no se realiza/)).toBeTruthy();
    expect(screen.getByText(/al menos el 50 % de la tarifa de tu puesto/)).toBeTruthy();
    expect(screen.getByText(PAGO_SEGUN_CONTRATO)).toBeTruthy();
    expect(screen.getByRole('button', { name: TITULO }).props.accessibilityState).toEqual({ expanded: true });
  });

  test('tocarlo otra vez lo pliega', () => {
    render(<AvisoFuerzaMayor />);
    fireEvent.press(screen.getByText(TITULO));
    fireEvent.press(screen.getByText(TITULO));
    expect(screen.queryByText(PAGO_SEGUN_CONTRATO)).toBeNull();
  });
});

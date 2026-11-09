import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { CompensacionPropuestaCard } from '../CompensacionPropuestaCard';

// Bajarle el pago a quien ya trabajó necesita SU autorización: la tarjeta pide el sí explícito (con el antes y el
// después) y deja claro que sin él se le paga según su contrato.
const mockConfirm = jest.fn();
jest.mock('@/lib/confirmDialog', () => ({ confirm: (...a: unknown[]) => mockConfirm(...a) }));

const onDecidir = jest.fn();
const base = { pagoActual: 135000, propuesta: 120000, bono: 0, motivo: 'Fuerza mayor', pendiente: false, onDecidir };

beforeEach(() => { jest.clearAllMocks(); mockConfirm.mockResolvedValue(true); });

describe('CompensacionPropuestaCard — trabajador', () => {
  test('pendiente: explica el cambio, que no se aplica sin su autorización y que si no, se paga según contrato', () => {
    render(<CompensacionPropuestaCard {...base} decision="pendiente" esGestor={false} />);
    expect(screen.getByText('Necesitamos tu autorización')).toBeTruthy();
    expect(screen.getByText(/de \$135\.000 a \$120\.000/)).toBeTruthy();
    expect(screen.getByText(/Tu pago no cambia hasta que lo autorices; si no lo autorizas, se te paga según tu contrato/)).toBeTruthy();
  });

  test('«Autorizo» pide confirmar con el antes y el después y recién ahí decide que sí', async () => {
    render(<CompensacionPropuestaCard {...base} decision="pendiente" esGestor={false} />);
    await act(async () => { fireEvent.press(screen.getByText('Autorizo')); });
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Autorizar el cambio de pago',
      message: expect.stringMatching(/pasará de \$135\.000 a \$120\.000/),
    }));
    expect(onDecidir).toHaveBeenCalledWith(true);
  });

  test('si en la confirmación vuelve atrás, no se decide nada', async () => {
    mockConfirm.mockResolvedValue(false);
    render(<CompensacionPropuestaCard {...base} decision="pendiente" esGestor={false} />);
    await act(async () => { fireEvent.press(screen.getByText('Autorizo')); });
    expect(onDecidir).not.toHaveBeenCalled();
  });

  test('«No autorizo» decide que no, sin diálogo', async () => {
    render(<CompensacionPropuestaCard {...base} decision="pendiente" esGestor={false} />);
    await act(async () => { fireEvent.press(screen.getByText('No autorizo')); });
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(onDecidir).toHaveBeenCalledWith(false);
  });

  test('el bono ya otorgado se suma al pago propuesto', () => {
    render(<CompensacionPropuestaCard {...base} bono={10000} decision="pendiente" esGestor={false} />);
    expect(screen.getByText(/de \$135\.000 a \$130\.000/)).toBeTruthy();
  });

  test('rechazada: sin botones, se le paga según su contrato', () => {
    render(<CompensacionPropuestaCard {...base} decision="rechazada" esGestor={false} />);
    expect(screen.getByText('No autorizaste el cambio de pago')).toBeTruthy();
    expect(screen.getByText('Se te paga según tu contrato ($135.000).')).toBeTruthy();
    expect(screen.queryByText('Autorizo')).toBeNull();
  });
});

describe('CompensacionPropuestaCard — gestor', () => {
  test('pendiente: ve que espera al trabajador y no tiene botones', () => {
    render(<CompensacionPropuestaCard {...base} decision="pendiente" esGestor />);
    expect(screen.getByText('Esperando la autorización del trabajador')).toBeTruthy();
    expect(screen.getByText(/mientras tanto se le paga según su contrato/)).toBeTruthy();
    expect(screen.queryByText('Autorizo')).toBeNull();
    expect(screen.queryByText('No autorizo')).toBeNull();
  });

  test('rechazada: ve que no autorizó y que se le paga según contrato', () => {
    render(<CompensacionPropuestaCard {...base} decision="rechazada" esGestor />);
    expect(screen.getByText('El trabajador no autorizó el cambio de pago')).toBeTruthy();
    expect(screen.getByText('Se le paga según su contrato ($135.000).')).toBeTruthy();
  });
});

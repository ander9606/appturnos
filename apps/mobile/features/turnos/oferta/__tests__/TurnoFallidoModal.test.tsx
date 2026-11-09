import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { TurnoFallidoModal } from '../TurnoFallidoModal';

// Modal «Turno fallido» (gestor): piso de compensación = mitad de la tarifa del puesto y
// paso de confirmación con el antes/después de cada persona. Dinero real: se prueba aparte.
const mockShowAlert = jest.fn();
const mockConfirm = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/lib/alertDialog', () => ({ showAlert: (...a: unknown[]) => mockShowAlert(...a) }));
jest.mock('@/lib/confirmDialog', () => ({ confirm: (...a: unknown[]) => mockConfirm(...a) }));
jest.mock('@/features/turnos/useTurnos', () => ({ useMarcarOfertaFallida: jest.fn() }));

const mutateAsync = jest.fn();
const onDone = jest.fn();

const oferta = {
  id: 5,
  titulo: 'Evento Gala',
  puestos: [{ id: 1, tarifa_dia: 120000 }],
  asignaciones: [
    { id: 100, estado: 'completado', puesto_id: 1, trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz', cargo_nombre: 'Mesero', pago_total: 135000 },
    { id: 101, estado: 'en_progreso', puesto_id: 1, trabajador_nombre: 'Luis', trabajador_apellido: 'Paz', cargo_nombre: 'Mesero', pago_total: null },
    { id: 102, estado: 'confirmado', puesto_id: 1, trabajador_nombre: 'Eva', trabajador_apellido: 'Gil', cargo_nombre: 'Mesero', pago_total: null },
  ],
};

function montar() {
  return render(
    <TurnoFallidoModal
      visible
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      oferta={oferta as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      marcarFallidaM={{ mutateAsync, isPending: false } as any}
      onClose={jest.fn()}
      onDone={onDone}
    />,
  );
}

const confirmar = () => act(async () => { fireEvent.press(screen.getByText('Confirmar turno fallido')); });

beforeEach(() => {
  jest.clearAllMocks();
  mutateAsync.mockResolvedValue(undefined);
  mockConfirm.mockResolvedValue(true);
});

describe('TurnoFallidoModal', () => {
  test('advierte que solo se use si la tarea no se realizó (si se realizó, se paga según contrato)', async () => {
    montar();
    expect(screen.getByText(/Úsalo solo si la tarea no se realizó/)).toBeTruthy();
    await confirmar();
    expect(mockConfirm.mock.calls[0][0].message).toContain('la tarea NO se realizó');
  });

  test('muestra el mínimo (la mitad de la tarifa) bajo cada compensación', () => {
    montar();
    expect(screen.getAllByText(/Mínimo .*60\.000.*mitad de la tarifa/)).toHaveLength(2);
  });

  test('un monto por debajo de la mitad se rechaza: avisa, no confirma ni envía', async () => {
    montar();
    const campos = screen.getAllByDisplayValue('120000');
    fireEvent.changeText(campos[0], '59999');
    await confirmar();
    expect(mockShowAlert).toHaveBeenCalledWith('Compensación muy baja', expect.stringContaining('Ana Ruiz'), 'warning');
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  test('antes de enviar pide confirmar; a quien ya trabajó y baja de pago lo muestra como PROPUESTA que debe autorizar', async () => {
    montar();
    await confirmar();
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    const { message, destructive } = mockConfirm.mock.calls[0][0];
    expect(destructive).toBe(true);
    expect(message).toMatch(/Ana Ruiz: propuesta de .*135\.000.* a .*120\.000.*necesita su autorización/);
    expect(message).toContain('mientras tanto se le paga según su contrato');
    expect(message).toContain('el trabajador debe autorizarlo');
    expect(message).toContain('Luis Paz:');
    expect(message).not.toContain('Luis Paz: propuesta');
  });

  test('si la compensación NO le baja el pago a quien ya trabajó, se aplica directo: «de X a Y», sin autorización', async () => {
    montar();
    const campos = screen.getAllByDisplayValue('120000');
    fireEvent.changeText(campos[0], '135000'); // igual a lo que ya tenía
    await confirmar();
    const { message } = mockConfirm.mock.calls[0][0];
    expect(message).toMatch(/Ana Ruiz: de .*135\.000.* a .*135\.000/);
    expect(message).not.toContain('necesita su autorización');
  });

  test('si el gestor no confirma, no se envía nada', async () => {
    mockConfirm.mockResolvedValue(false);
    montar();
    await confirmar();
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  test('exactamente la mitad se acepta y envía solo a quien ya trabajó', async () => {
    montar();
    const campos = screen.getAllByDisplayValue('120000');
    fireEvent.changeText(campos[0], '60000');
    await confirmar();
    expect(mutateAsync).toHaveBeenCalledWith({
      ofertaId: 5,
      motivo: 'Fuerza mayor',
      compensaciones: [{ asignacion_id: 100, monto: 60000 }, { asignacion_id: 101, monto: 120000 }],
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

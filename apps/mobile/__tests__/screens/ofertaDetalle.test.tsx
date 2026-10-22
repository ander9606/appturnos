/**
 * Caracterización de la pantalla de detalle de oferta ANTES de partirla: congela lo que dibuja y lo que
 * hace según el rol (trabajador / gestor / jefe_nomina) y el estado de la oferta.
 */
import React from 'react';
import { Linking, Switch, View } from 'react-native';
import { COLORS } from '@/lib/designTokens';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError } from '@api-client';
import OfertaDetailScreen from '../../app/oferta/[id]';

// ── Bordes simulados ─────────────────────────────────────────────────────────
const mockRouter = { back: jest.fn() };
let mockParams: { id?: string } = { id: '5' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockStackOptions: any;
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
  Stack: { Screen: (p: { options: unknown }) => { mockStackOptions = p.options; return null; } },
}));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, {
    get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} />,
  });
});
jest.mock('@/components/ui/Spinner', () => {
  const { View } = require('react-native');
  return { Spinner: () => <View testID="spinner" /> };
});
jest.mock('@/lib/theme', () => ({ useTheme: () => ({ primary: '#111111' }) }));

let mockRol: string | undefined;
jest.mock('@/features/auth/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ usuario: { rol: mockRol } }),
}));
jest.mock('@/lib/formatters', () => ({ ...jest.requireActual('@/lib/formatters'), bogotaToday: () => '2026-06-15' }));
let mockIniciado = false;
jest.mock('@/features/turnos/turnosUtils', () => ({ turnoYaInicio: () => mockIniciado }));

const mockShowAlert = jest.fn();
jest.mock('@/lib/alertDialog', () => ({ showAlert: (...a: unknown[]) => mockShowAlert(...a) }));
const mockConfirm = jest.fn();
jest.mock('@/lib/confirmDialog', () => ({ confirm: (...a: unknown[]) => mockConfirm(...a) }));
const mockActionSheet = jest.fn();
jest.mock('@/lib/actionSheet', () => ({ actionSheet: (...a: unknown[]) => mockActionSheet(...a) }));
const mockShowToast = jest.fn();
jest.mock('@/lib/toast', () => ({ showToast: (...a: unknown[]) => mockShowToast(...a) }));
const mockAnuncio = jest.fn();
jest.mock('@/lib/anuncioTurno', () => ({ showAnuncioTurno: (...a: unknown[]) => mockAnuncio(...a) }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mutation = (): any => ({ mutateAsync: jest.fn().mockResolvedValue({}), mutate: jest.fn(), isPending: false });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockOfertaQuery: { data: any; isLoading: boolean; error: unknown };
let mockMisTurnos: { data: unknown[] };
let mockMisTurnosOpts: unknown;
let mockM: Record<string, ReturnType<typeof mutation>>;
jest.mock('@/features/turnos/useTurnos', () => ({
  useOferta: () => mockOfertaQuery,
  useMisTurnos: (opts: unknown) => { mockMisTurnosOpts = opts; return mockMisTurnos; },
  useAplicar: () => mockM.aplicar,
  useRetirar: () => mockM.retirar,
  useConfirmar: () => mockM.confirmar,
  useRechazar: () => mockM.rechazar,
  useCancelar: () => mockM.cancelar,
  useNoPresentado: () => mockM.noPresentado,
  useCancelarOferta: () => mockM.cancelarOferta,
  useMarcarOfertaFallida: () => mockM.marcarFallida,
  useCompletarOferta: () => mockM.completarOferta,
  useActualizarOferta: () => mockM.actualizarOferta,
}));

jest.mock('@/features/nomina/TurnosExtraOptIn', () => {
  const { Text } = require('react-native');
  const { ApiError: AE } = require('@api-client');
  return {
    TurnosExtraOptIn: () => <Text>OPT-IN EXTRAS</Text>,
    esErrorTurnosExtraApagadas: (e: { status?: number; message: string }) => e instanceof AE && e.status === 403 && e.message.includes('turnos extra'),
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockPostulanteProps: any[];
jest.mock('@/features/turnos/oferta/PostulanteRow', () => {
  const { Text } = require('react-native');
  return { PostulanteRow: (p: { asignacion: { id: number } }) => { mockPostulanteProps.push(p); return <Text>{`fila-${p.asignacion.id}`}</Text>; } };
});
jest.mock('@/features/turnos/FuncionesCargoModal', () => {
  const { Text } = require('react-native');
  return {
    FuncionesCargoModal: (p: { visible: boolean; cargoId: number | null; cargoNombre: string }) =>
      <Text testID="funciones-modal">{`${p.visible}|${p.cargoId}|${p.cargoNombre}`}</Text>,
  };
});
jest.mock('@/features/turnos/oferta/DuplicarOfertaModal', () => {
  const { Text } = require('react-native');
  return { DuplicarOfertaModal: (p: { visible: boolean; oferta: { id: number } }) => <Text testID="duplicar-modal">{`${p.visible}|${p.oferta.id}`}</Text> };
});
jest.mock('@/features/turnos/oferta/EditarOfertaModal', () => {
  const { Text } = require('react-native');
  return { EditarOfertaModal: (p: { visible: boolean; oferta: { id: number } }) => <Text testID="editar-modal">{`${p.visible}|${p.oferta.id}`}</Text> };
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockFallidoProps: any;
jest.mock('@/features/turnos/oferta/TurnoFallidoModal', () => {
  const { Text, Pressable, View } = require('react-native');
  return {
    TurnoFallidoModal: (p: { visible: boolean; onDone: () => void; onClose: () => void; marcarFallidaM: unknown }) => {
      mockFallidoProps = p;
      return (
        <View>
          <Text testID="fallido-modal">{`${p.visible}`}</Text>
          <Pressable testID="fallido-done" onPress={p.onDone} />
        </View>
      );
    },
  };
});

// ── Datos ────────────────────────────────────────────────────────────────────
const ASIG = { id: 100, estado: 'pendiente' };
const OFERTA = {
  id: 5,
  titulo: 'Evento Gala',
  fecha: '2026-06-20',
  hora_inicio: '08:00:00',
  hora_fin_estimada: '17:30:00',
  lugar: 'Salón Principal',
  latitud: 4.6,
  longitud: -74.1,
  descripcion: 'Montaje de mesas',
  notas_adicionales: 'Traer uniforme',
  estado: 'abierta',
  ubicacion_libre: 0,
  necesita_completar: false,
  puestos: [
    { id: 1, cargo_id: 10, cargo_nombre: 'Mesero', tarifa_dia: 80000, plazas: 3, plazas_cubiertas: 1, notas: 'Con experiencia' },
    { id: 2, cargo_id: 11, cargo_nombre: 'Bartender', tarifa_dia: 120000, plazas: 2, plazas_cubiertas: 2, notas: null },
    { id: 3, cargo_id: 12, cargo_nombre: 'Auxiliar', tarifa_dia: 60000, plazas: 4, plazas_cubiertas: 0, notas: null },
  ],
  asignaciones: [ASIG, { id: 101, estado: 'confirmado' }],
};
const conOferta = (over: Record<string, unknown> = {}) => { mockOfertaQuery = { data: { ...OFERTA, ...over }, isLoading: false, error: null }; };
const montar = () => render(<OfertaDetailScreen />);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: '5' };
  mockRol = 'trabajador_turnos';
  mockIniciado = false;
  mockStackOptions = undefined;
  mockPostulanteProps = [];
  mockFallidoProps = undefined;
  mockMisTurnos = { data: [] };
  mockMisTurnosOpts = undefined;
  mockM = {
    aplicar: mutation(), retirar: mutation(), confirmar: mutation(), rechazar: mutation(), cancelar: mutation(),
    noPresentado: mutation(), cancelarOferta: mutation(), marcarFallida: mutation(), completarOferta: mutation(),
    actualizarOferta: mutation(),
  };
  conOferta();
  mockConfirm.mockResolvedValue(true);
});

const texto = (t: string | RegExp) => screen.getByText(t);

describe('estados de carga y error', () => {
  test('cargando: ni título ni acciones', () => {
    mockOfertaQuery = { data: undefined, isLoading: true, error: null };
    montar();
    expect(screen.queryByText('Evento Gala')).toBeNull();
    expect(screen.queryByText('Turno no encontrado')).toBeNull();
  });

  test.each([
    ['404', new ApiError('x', undefined, 404), 'Este turno ya no está disponible'],
    ['403 por ranking', new ApiError('Tu ranking no alcanza', undefined, 403), 'Este turno aún no está disponible para tu nivel de calificación'],
    ['otro error', new ApiError('x', undefined, 500), 'Turno no encontrado'],
    ['sin error', null, 'Turno no encontrado'],
  ])('sin oferta (%s): mensaje', (_n, error, mensaje) => {
    mockOfertaQuery = { data: undefined, isLoading: false, error };
    montar();
    expect(texto(mensaje)).toBeTruthy();
    expect(screen.queryByText('OPT-IN EXTRAS')).toBeNull();
  });

  test('403 de turnos extra apagados: muestra la invitación a activarlos', () => {
    mockOfertaQuery = { data: undefined, isLoading: false, error: new ApiError('Los turnos extra están apagados', undefined, 403) };
    montar();
    expect(texto('OPT-IN EXTRAS')).toBeTruthy();
    expect(screen.queryByText('Turno no encontrado')).toBeNull();
  });

  test('un 403 que no es de ranking ni de extras cae en "no encontrado"', () => {
    mockOfertaQuery = { data: undefined, isLoading: false, error: new ApiError('Prohibido', undefined, 403) };
    montar();
    expect(texto('Turno no encontrado')).toBeTruthy();
  });
});

describe('información principal', () => {
  test('título, plazas, fecha, horario, lugar, descripción y detalles', () => {
    montar();
    expect(texto('Evento Gala')).toBeTruthy();
    expect(texto('3/9 plazas')).toBeTruthy();
    expect(texto('Sáb 20 de Jun')).toBeTruthy();
    expect(texto('8:00 – 17:30')).toBeTruthy();
    expect(texto('Salón Principal')).toBeTruthy();
    expect(texto('Montaje de mesas')).toBeTruthy();
    expect(texto('Descripción')).toBeTruthy();
    expect(texto('Traer uniforme')).toBeTruthy();
    expect(texto('Detalles adicionales')).toBeTruthy();
  });

  test('el horario quita el cero a la izquierda tanto del inicio como del fin', () => {
    conOferta({ hora_fin_estimada: '09:05:00' });
    montar();
    expect(texto('8:00 – 9:05')).toBeTruthy();
  });

  test('horario sin hora de fin: solo el inicio', () => {
    conOferta({ hora_fin_estimada: null });
    montar();
    expect(texto('8:00')).toBeTruthy();
  });

  test('sin lugar, descripción ni detalles: no se dibujan', () => {
    conOferta({ lugar: null, descripcion: null, notas_adicionales: null });
    montar();
    expect(screen.queryByText('Lugar')).toBeNull();
    expect(screen.queryByText('Descripción')).toBeNull();
    expect(screen.queryByText('Detalles adicionales')).toBeNull();
  });

  test('botón de mapa solo con coordenadas; abre el mapa nativo y, si falla, Google Maps', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(true as never);
    montar();
    await act(async () => { fireEvent.press(texto('Mapa')); });
    expect(abrir).toHaveBeenCalledWith('maps://app?q=Sal%C3%B3n%20Principal&ll=4.6,-74.1');

    abrir.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(true as never);
    await act(async () => { fireEvent.press(texto('Mapa')); });
    expect(abrir).toHaveBeenLastCalledWith('https://maps.google.com/?q=4.6,-74.1');
    abrir.mockRestore();
  });

  test('sin coordenadas no hay botón de mapa', () => {
    conOferta({ latitud: null });
    montar();
    expect(screen.queryByText('Mapa')).toBeNull();
  });

  test('el aviso de "falta marcar completada" solo lo ve quien gestiona', () => {
    conOferta({ necesita_completar: true });
    mockRol = 'admin_empresa';
    const { unmount } = montar();
    expect(texto('Este turno ya terminó y todos quedaron resueltos, pero nadie lo marcó como completado.')).toBeTruthy();
    unmount();
    mockRol = 'jefe_nomina';
    montar();
    expect(screen.queryByText(/nadie lo marcó como completado/)).toBeNull();
  });

  test('la franja de color distingue un evento pasado', () => {
    const colorFranja = () => {
      const franja = screen.UNSAFE_getAllByType(View)
        .find((v) => v.props.className === 'h-2');
      return franja!.props.style.backgroundColor;
    };
    conOferta({ fecha: '2026-06-01' });
    mockRol = 'admin_empresa';
    const { unmount } = montar();
    expect(texto('Historial de asistencia')).toBeTruthy();
    expect(colorFranja()).toBe(COLORS.borderStrong);
    unmount();
    conOferta();
    montar();
    expect(colorFranja()).toBe(COLORS.primary400);
  });
});

describe('ubicación libre', () => {
  test('el gestor la edita con un interruptor mientras la oferta es editable', async () => {
    mockRol = 'admin_empresa';
    montar();
    const sw = screen.UNSAFE_getByType(Switch);
    expect(sw.props.value).toBe(false);
    expect(texto('Sin restricción al marcar ingreso/egreso')).toBeTruthy();
    await act(async () => { fireEvent(sw, 'valueChange', true); });
    expect(mockM.actualizarOferta.mutateAsync).toHaveBeenCalledWith({ id: 5, ubicacion_libre: true });
    expect(mockShowToast).toHaveBeenCalledWith('Turno marcado con ubicación libre.');
    await act(async () => { fireEvent(sw, 'valueChange', false); });
    expect(mockShowToast).toHaveBeenLastCalledWith('Ubicación libre desactivada.');
  });

  test('errores: mensaje del servidor o el de por defecto', async () => {
    mockRol = 'jefe_turnos';
    montar();
    const sw = screen.UNSAFE_getByType(Switch);
    mockM.actualizarOferta.mutateAsync.mockRejectedValueOnce(new ApiError('Sin permiso', undefined, 403));
    await act(async () => { fireEvent(sw, 'valueChange', true); });
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Sin permiso');
    mockM.actualizarOferta.mutateAsync.mockRejectedValueOnce(new Error('x'));
    await act(async () => { fireEvent(sw, 'valueChange', true); });
    expect(mockShowAlert).toHaveBeenLastCalledWith('Error', 'No se pudo actualizar el turno.');
  });

  test('el interruptor se deshabilita mientras guarda y refleja el valor actual', () => {
    mockRol = 'admin_empresa';
    conOferta({ ubicacion_libre: 1 });
    mockM.actualizarOferta.isPending = true;
    montar();
    const sw = screen.UNSAFE_getByType(Switch);
    expect(sw.props.value).toBe(true);
    expect(sw.props.disabled).toBe(true);
  });

  test('oferta no editable o sin permiso: sin interruptor; el aviso solo si está activa', () => {
    mockRol = 'admin_empresa';
    conOferta({ estado: 'completada', ubicacion_libre: 1 });
    const { unmount } = montar();
    expect(screen.UNSAFE_queryByType(Switch)).toBeNull();
    expect(texto('Libre — sin restricción geográfica')).toBeTruthy();
    unmount();

    mockRol = 'trabajador_turnos';
    conOferta({ ubicacion_libre: 1 });
    const r2 = montar();
    expect(screen.UNSAFE_queryByType(Switch)).toBeNull();
    expect(texto('Libre — sin restricción geográfica')).toBeTruthy();
    r2.unmount();

    conOferta({ ubicacion_libre: 0 });
    montar();
    expect(screen.queryByText('Libre — sin restricción geográfica')).toBeNull();
  });

  test('jefe_nomina no la edita (solo ve)', () => {
    mockRol = 'jefe_nomina';
    montar();
    expect(screen.UNSAFE_queryByType(Switch)).toBeNull();
  });
});

describe('cargos y tarifas', () => {
  test('lista cada cargo con tarifa en pesos, plazas y notas', () => {
    montar();
    expect(texto('Mesero')).toBeTruthy();
    expect(texto('Con experiencia')).toBeTruthy();
    expect(texto('$80.000')).toBeTruthy();
    expect(texto('1/3 plazas')).toBeTruthy();
    expect(texto('$120.000')).toBeTruthy();
    expect(texto('2/2 plazas')).toBeTruthy();
  });

  test('trabajador sin aplicar con varios cargos libres: título de selección y "Ver funciones"', () => {
    montar();
    expect(texto('¿A qué cargo quieres aplicar?')).toBeTruthy();
    expect(screen.getAllByText('Ver funciones')).toHaveLength(3);
  });

  test('el gestor ve "Cargos y tarifas" y no "Ver funciones"', () => {
    mockRol = 'admin_empresa';
    montar();
    expect(texto('Cargos y tarifas')).toBeTruthy();
    expect(screen.queryByText('Ver funciones')).toBeNull();
    expect(screen.queryByText('¿A qué cargo quieres aplicar?')).toBeNull();
  });

  test('con un solo cargo libre no se pide elegir', () => {
    conOferta({ puestos: [OFERTA.puestos[0], OFERTA.puestos[1]] });
    montar();
    expect(texto('Cargos y tarifas')).toBeTruthy();
    expect(texto('Aplicar como Mesero')).toBeTruthy();
  });

  test('"Ver funciones" abre el modal del cargo y se cierra', () => {
    montar();
    expect(texto('false|null|')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Ver funciones')[1]);
    expect(texto('true|11|Bartender')).toBeTruthy();
  });

  test('elegir un cargo cambia el botón de aplicar; los llenos no se pueden elegir', () => {
    montar();
    expect(texto('Aplicar como Mesero')).toBeTruthy(); // el primero con plazas
    fireEvent.press(texto('Auxiliar'));
    expect(texto('Aplicar como Auxiliar')).toBeTruthy();
    fireEvent.press(texto('Bartender')); // lleno: no cambia
    expect(texto('Aplicar como Auxiliar')).toBeTruthy();
    const radios = screen.getAllByTestId(/icon-radio-button/);
    expect(radios).toHaveLength(2); // solo los dos con plazas libres
    // exactamente uno marcado: el elegido (Auxiliar), no los dos
    expect(screen.getAllByTestId('icon-radio-button-on')).toHaveLength(1);
    expect(screen.getAllByTestId('icon-radio-button-off')).toHaveLength(1);
  });
});

describe('postulación del trabajador', () => {
  test('consulta sus turnos solo si es trabajador', () => {
    montar();
    expect(mockMisTurnosOpts).toEqual({ enabled: true });
  });

  test('aplicar envía el cargo elegido, avisa y muestra primero el warning del servidor', async () => {
    mockM.aplicar.mutateAsync.mockResolvedValue({ warnings: ['El turno ya comenzó'] });
    montar();
    fireEvent.press(texto('Auxiliar'));
    await act(async () => { fireEvent.press(texto('Aplicar como Auxiliar')); });
    expect(mockM.aplicar.mutateAsync).toHaveBeenCalledWith({ ofertaId: 5, puestoId: 3 });
    expect(mockShowToast.mock.calls.map((c) => c[0])).toEqual([
      'El turno ya comenzó',
      'Has solicitado el turno como Auxiliar. El gestor revisará tu solicitud.',
    ]);
  });

  test('aplicar sin warnings: un solo aviso; si falla, el mensaje del servidor o el de por defecto', async () => {
    montar();
    await act(async () => { fireEvent.press(texto('Aplicar como Mesero')); });
    expect(mockShowToast).toHaveBeenCalledTimes(1);
    mockM.aplicar.mutateAsync.mockRejectedValueOnce(new ApiError('Cupo lleno', undefined, 409));
    await act(async () => { fireEvent.press(texto('Aplicar como Mesero')); });
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Cupo lleno');
    mockM.aplicar.mutateAsync.mockRejectedValueOnce(new Error('x'));
    await act(async () => { fireEvent.press(texto('Aplicar como Mesero')); });
    expect(mockShowAlert).toHaveBeenLastCalledWith('Error', 'No se pudo aplicar.');
  });

  test('mientras envía muestra el texto de carga', () => {
    mockM.aplicar.isPending = true;
    montar();
    // el botón cambia el texto por un spinner; la etiqueta sigue en su accesibilidad
    expect(screen.getByLabelText('Enviando postulación…')).toBeTruthy();
    expect(screen.queryByText(/Aplicar como/)).toBeNull();
    expect(screen.getByTestId('spinner')).toBeTruthy();
  });

  test('el trabajador de nómina también puede postularse', () => {
    mockRol = 'trabajador_nomina';
    montar();
    expect(mockMisTurnosOpts).toEqual({ enabled: true });
    expect(texto('Aplicar como Mesero')).toBeTruthy();
    expect(screen.queryByText('Postulantes')).toBeNull();
  });

  test('un evento de hoy todavía no es "finalizado" (solo lo es el de días anteriores)', () => {
    conOferta({ fecha: '2026-06-15' });
    montar();
    expect(screen.queryByText('Evento finalizado')).toBeNull();
    expect(texto('Aplicar como Mesero')).toBeTruthy();
  });

  test('evento finalizado: no se puede postular', () => {
    conOferta({ fecha: '2026-06-01' });
    montar();
    expect(texto('Evento finalizado')).toBeTruthy();
    expect(screen.queryByText(/Aplicar como/)).toBeNull();
  });

  test('el turno ya empezó: no se puede postular', () => {
    mockIniciado = true;
    montar();
    expect(texto('El turno ya empezó — ya no se puede postular')).toBeTruthy();
    expect(screen.queryByText(/Aplicar como/)).toBeNull();
    expect(texto('Cargos y tarifas')).toBeTruthy();
  });

  test('sin plazas libres: aviso', () => {
    conOferta({ puestos: [OFERTA.puestos[1]] });
    montar();
    expect(texto('No hay plazas disponibles')).toBeTruthy();
  });

  test('ya postulado (pendiente): lo indica y permite retirarse con confirmación', async () => {
    mockMisTurnos = { data: [{ oferta_id: 5, puesto_id: 1, estado: 'pendiente' }] };
    montar();
    expect(texto('Ya estás postulado a este turno')).toBeTruthy();
    expect(screen.queryByText(/Aplicar como/)).toBeNull();
    await act(async () => { fireEvent.press(texto('Retirar postulación')); });
    expect(mockConfirm).toHaveBeenCalledWith({
      title: 'Retirar postulación', message: '¿Retirar tu postulación a este turno?',
      cancelLabel: 'Volver', confirmLabel: 'Retirar', destructive: true,
    });
    expect(mockM.retirar.mutateAsync).toHaveBeenCalledWith({ ofertaId: 5, puestoId: 1 });
  });

  test('retirar: si no se confirma no hace nada; si falla, alerta', async () => {
    mockMisTurnos = { data: [{ oferta_id: 5, puesto_id: 1, estado: 'pendiente' }] };
    montar();
    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => { fireEvent.press(texto('Retirar postulación')); });
    expect(mockM.retirar.mutateAsync).not.toHaveBeenCalled();
    mockM.retirar.mutateAsync.mockRejectedValueOnce(new ApiError('Ya confirmado', undefined, 409));
    await act(async () => { fireEvent.press(texto('Retirar postulación')); });
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Ya confirmado');
    mockM.retirar.mutateAsync.mockRejectedValueOnce(new Error('x'));
    await act(async () => { fireEvent.press(texto('Retirar postulación')); });
    expect(mockShowAlert).toHaveBeenLastCalledWith('Error', 'No se pudo retirar la postulación.');
  });

  test('mientras retira muestra "Retirando…"', () => {
    mockMisTurnos = { data: [{ oferta_id: 5, puesto_id: 1, estado: 'pendiente' }] };
    mockM.retirar.isPending = true;
    montar();
    expect(screen.getByLabelText('Retirando…')).toBeTruthy();
    expect(screen.queryByText('Retirar postulación')).toBeNull();
  });

  test('postulado pero el cupo se llenó: mensaje de espera, mantiene el botón de retirar', () => {
    mockMisTurnos = { data: [{ oferta_id: 5, puesto_id: 2, estado: 'pendiente' }] };
    montar();
    expect(texto('Cupo lleno — tu postulación se mantiene. Te avisaremos si se libera un cupo o se amplía la oferta.')).toBeTruthy();
    expect(texto('Retirar postulación')).toBeTruthy();
  });

  test('confirmado en un cargo que ya se llenó: no ve el aviso de cupo lleno', () => {
    mockMisTurnos = { data: [{ oferta_id: 5, puesto_id: 2, estado: 'confirmado' }] };
    montar();
    expect(texto('Ya estás confirmado en este turno')).toBeTruthy();
    expect(screen.queryByText(/Cupo lleno/)).toBeNull();
  });

  test('ya confirmado: lo indica y no hay botón de retirar', () => {
    mockMisTurnos = { data: [{ oferta_id: 5, puesto_id: 1, estado: 'confirmado' }] };
    montar();
    expect(texto('Ya estás confirmado en este turno')).toBeTruthy();
    expect(screen.queryByText('Retirar postulación')).toBeNull();
  });

  test('una postulación a otra oferta no cuenta', () => {
    mockMisTurnos = { data: [{ oferta_id: 99, puesto_id: 1, estado: 'pendiente' }] };
    montar();
    expect(texto('Aplicar como Mesero')).toBeTruthy();
  });

  test('el gestor no ve nada de postulación ni consulta mis turnos', () => {
    mockRol = 'admin_empresa';
    montar();
    expect(mockMisTurnosOpts).toEqual({ enabled: false });
    expect(screen.queryByText(/Aplicar como/)).toBeNull();
    expect(screen.queryByText('Evento finalizado')).toBeNull();
  });
});

describe('postulantes (gestores)', () => {
  test('lista una fila por asignación con lo que necesita cada una', () => {
    mockRol = 'admin_empresa';
    mockIniciado = true;
    montar();
    expect(texto('Postulantes')).toBeTruthy();
    expect(texto('fila-100')).toBeTruthy();
    expect(texto('fila-101')).toBeTruthy();
    const p = mockPostulanteProps[0];
    expect(p).toMatchObject({ ofertaId: 5, esPasado: false, turnoIniciado: true, puedeGestionar: true });
    expect(p.confirmarM).toBe(mockM.confirmar);
    expect(p.rechazarM).toBe(mockM.rechazar);
    expect(p.cancelarM).toBe(mockM.cancelar);
    expect(p.noPresentadoM).toBe(mockM.noPresentado);
  });

  test('pasado: "Historial de asistencia"; sin asignaciones: "Sin postulantes."', () => {
    mockRol = 'jefe_turnos';
    conOferta({ fecha: '2026-06-01', asignaciones: [] });
    montar();
    expect(texto('Historial de asistencia')).toBeTruthy();
    expect(texto('Sin postulantes.')).toBeTruthy();
  });

  test('en un evento pasado cada fila lo sabe', () => {
    mockRol = 'admin_empresa';
    conOferta({ fecha: '2026-06-01' });
    montar();
    expect(mockPostulanteProps.length).toBeGreaterThan(0);
    expect(mockPostulanteProps.every((p) => p.esPasado === true)).toBe(true);
  });

  test('jefe_nomina ve los postulantes pero sin poder gestionar', () => {
    mockRol = 'jefe_nomina';
    montar();
    expect(texto('fila-100')).toBeTruthy();
    expect(mockPostulanteProps[0].puedeGestionar).toBe(false);
  });

  test('el trabajador no ve los postulantes', () => {
    montar();
    expect(screen.queryByText('Postulantes')).toBeNull();
    expect(screen.queryByText('fila-100')).toBeNull();
  });
});

describe('encabezado (editar / duplicar)', () => {
  test('el título del encabezado es el de la oferta', () => {
    montar();
    expect(mockStackOptions.title).toBe('Evento Gala');
    expect(mockStackOptions.headerShown).toBe(true);
  });

  test('quien no gestiona no tiene acciones en el encabezado', () => {
    montar();
    expect(mockStackOptions.headerRight).toBeUndefined();
    mockRol = 'jefe_nomina';
    montar();
    expect(mockStackOptions.headerRight).toBeUndefined();
  });

  test('el gestor edita (si es editable) y duplica: abren sus modales', () => {
    mockRol = 'admin_empresa';
    const main = montar();
    expect(main.getByTestId('editar-modal').props.children).toBe('false|5');
    const hdr = render(mockStackOptions.headerRight());
    fireEvent.press(hdr.getByLabelText('Editar turno'));
    expect(main.getByTestId('editar-modal').props.children).toBe('true|5');
    expect(main.getByTestId('duplicar-modal').props.children).toBe('false|5');
    fireEvent.press(hdr.getByLabelText('Duplicar oferta'));
    expect(main.getByTestId('duplicar-modal').props.children).toBe('true|5');
  });

  test('si la oferta ya no es editable, solo se puede duplicar', () => {
    mockRol = 'jefe_turnos';
    conOferta({ estado: 'completada' });
    montar();
    const hdr = render(mockStackOptions.headerRight());
    expect(hdr.queryByLabelText('Editar turno')).toBeNull();
    expect(hdr.getByLabelText('Duplicar oferta')).toBeTruthy();
  });

  test('un borrador también es editable', () => {
    mockRol = 'admin_empresa';
    conOferta({ estado: 'borrador' });
    montar();
    const hdr = render(mockStackOptions.headerRight());
    expect(hdr.getByLabelText('Editar turno')).toBeTruthy();
  });
});

describe('barra de acciones del gestor', () => {
  beforeEach(() => { mockRol = 'admin_empresa'; });

  test('turno sin empezar y oferta abierta: solo "Cancelar oferta"', () => {
    montar();
    expect(screen.queryByText('Marcar completada')).toBeNull();
    expect(texto('Cancelar oferta')).toBeTruthy();
    expect(screen.queryByText('Turno fallido (fuerza mayor)')).toBeNull();
  });

  test('"Marcar completada" aparece cuando el turno ya empezó y la oferta está abierta o en curso', () => {
    mockIniciado = true;
    montar();
    expect(texto('Marcar completada')).toBeTruthy();
  });

  test.each(['completada', 'cancelada', 'borrador'])('con la oferta %s no se puede marcar completada', (estado) => {
    mockIniciado = true;
    conOferta({ estado });
    montar();
    expect(screen.queryByText('Marcar completada')).toBeNull();
  });

  test.each(['completada', 'cancelada'])('con la oferta %s no se puede cancelar', (estado) => {
    conOferta({ estado });
    montar();
    expect(screen.queryByText('Cancelar oferta')).toBeNull();
  });

  test('un borrador sí se puede cancelar', () => {
    conOferta({ estado: 'borrador' });
    montar();
    expect(texto('Cancelar oferta')).toBeTruthy();
  });

  test('jefe_nomina no tiene barra de acciones', () => {
    mockRol = 'jefe_nomina';
    mockIniciado = true;
    montar();
    expect(screen.queryByText('Marcar completada')).toBeNull();
    expect(screen.queryByText('Cancelar oferta')).toBeNull();
  });

  test('el trabajador no tiene barra de acciones', () => {
    mockRol = 'trabajador_turnos';
    mockIniciado = true;
    montar();
    expect(screen.queryByText('Cancelar oferta')).toBeNull();
    expect(screen.queryByText('Marcar completada')).toBeNull();
  });

  describe('marcar completada', () => {
    beforeEach(() => { mockIniciado = true; });

    test('sin nadie en curso: confirma y completa limitando horas', async () => {
      montar();
      await act(async () => { fireEvent.press(texto('Marcar completada')); });
      expect(mockConfirm).toHaveBeenCalledWith({
        title: 'Marcar como completada', message: 'Úsalo cuando el turno ya terminó en la realidad.',
        cancelLabel: 'Volver', confirmLabel: 'Marcar completada',
      });
      expect(mockM.completarOferta.mutateAsync).toHaveBeenCalledWith({ ofertaId: 5, capearHoras: true });
      expect(mockShowToast).toHaveBeenCalledWith('"Evento Gala" marcado como completado.');
      expect(mockActionSheet).not.toHaveBeenCalled();
    });

    test('si no se confirma no completa', async () => {
      mockConfirm.mockResolvedValueOnce(false);
      montar();
      await act(async () => { fireEvent.press(texto('Marcar completada')); });
      expect(mockM.completarOferta.mutateAsync).not.toHaveBeenCalled();
    });

    test('con trabajadores en curso pregunta cómo calcular las horas', async () => {
      conOferta({ asignaciones: [{ id: 100, estado: 'en_progreso' }] });
      mockActionSheet.mockResolvedValueOnce('estipulado');
      montar();
      await act(async () => { fireEvent.press(texto('Marcar completada')); });
      expect(mockActionSheet).toHaveBeenCalledWith({
        title: 'Hay trabajadores sin marcar salida',
        message: 'Si el turno ya lleva más de 2 días sin resolver, esto los cerrará automáticamente. ¿Cómo calculamos sus horas?',
        items: [{ key: 'estipulado', label: 'Horario estipulado' }, { key: 'ahora', label: 'Cerrar ahora' }],
      });
      expect(mockM.completarOferta.mutateAsync).toHaveBeenCalledWith({ ofertaId: 5, capearHoras: true });
      expect(mockConfirm).not.toHaveBeenCalled();
    });

    test('"Cerrar ahora" completa sin limitar horas; cancelar la hoja no hace nada', async () => {
      conOferta({ asignaciones: [{ id: 100, estado: 'en_progreso' }] });
      mockActionSheet.mockResolvedValueOnce('ahora');
      montar();
      await act(async () => { fireEvent.press(texto('Marcar completada')); });
      expect(mockM.completarOferta.mutateAsync).toHaveBeenCalledWith({ ofertaId: 5, capearHoras: false });
      mockM.completarOferta.mutateAsync.mockClear();
      mockActionSheet.mockResolvedValueOnce(null);
      await act(async () => { fireEvent.press(texto('Marcar completada')); });
      expect(mockM.completarOferta.mutateAsync).not.toHaveBeenCalled();
    });

    // OJO: los plurales salen mal escritos hoy ("cerróaron", "quedóaron"): el código pega `cerró` + `aron`.
    // Se fija el texto actual para refactorizar sin cambiar nada; se corrige después en su propio commit.
    test.each([
      ['un forzado con hora actual', { forzados_al_completar: 1, forzados_con_hora_actual: true },
        '"Evento Gala" completado. 1 trabajador que no había marcado salida se cerró con la hora actual.'],
      ['varios forzados con horario estipulado', { forzados_al_completar: 2 },
        '"Evento Gala" completado. 2 trabajadores que no habían marcado salida se cerróaron con el horario estipulado.'],
      ['un no presentado', { no_presentados_al_completar: 1 },
        '"Evento Gala" completado. 1 trabajador sin ingreso quedó como no presentado.'],
      ['varios no presentados', { no_presentados_al_completar: 3 },
        '"Evento Gala" completado. 3 trabajadores sin ingreso quedóaron como no presentados.'],
      ['ambos', { forzados_al_completar: 1, no_presentados_al_completar: 2 },
        '"Evento Gala" completado. 1 trabajador que no había marcado salida se cerró con el horario estipulado; 2 trabajadores sin ingreso quedóaron como no presentados.'],
    ])('el aviso al completar resume lo ocurrido (%s)', async (_n, data, esperado) => {
      mockM.completarOferta.mutateAsync.mockResolvedValueOnce(data);
      montar();
      await act(async () => { fireEvent.press(texto('Marcar completada')); });
      expect(mockShowToast).toHaveBeenCalledWith(esperado);
    });

    test('si falla: mensaje del servidor o el de por defecto', async () => {
      montar();
      mockM.completarOferta.mutateAsync.mockRejectedValueOnce(new ApiError('Ya completada', undefined, 409));
      await act(async () => { fireEvent.press(texto('Marcar completada')); });
      expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Ya completada');
      mockM.completarOferta.mutateAsync.mockRejectedValueOnce(new Error('x'));
      await act(async () => { fireEvent.press(texto('Marcar completada')); });
      expect(mockShowAlert).toHaveBeenLastCalledWith('Error', 'No se pudo completar la oferta.');
    });

    test('mientras completa muestra "Marcando…"', () => {
      mockM.completarOferta.isPending = true;
      montar();
      expect(screen.getByLabelText('Marcando…')).toBeTruthy();
      expect(screen.queryByText('Marcar completada')).toBeNull();
    });
  });

  describe('cancelar oferta', () => {
    test('confirma (destructivo), cancela, anuncia y vuelve', async () => {
      montar();
      await act(async () => { fireEvent.press(texto('Cancelar oferta')); });
      expect(mockConfirm).toHaveBeenCalledWith({
        title: 'Cancelar oferta',
        message: 'Se cancelará "Evento Gala" y se notificará a los trabajadores postulados o asignados. Esta acción no se puede deshacer.',
        cancelLabel: 'Volver', confirmLabel: 'Cancelar oferta', destructive: true,
      });
      expect(mockM.cancelarOferta.mutateAsync).toHaveBeenCalledWith(5);
      expect(mockAnuncio).toHaveBeenCalledWith('"Evento Gala" cancelado.', 'cancelado');
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });

    test('sin confirmar no pasa nada', async () => {
      mockConfirm.mockResolvedValueOnce(false);
      montar();
      await act(async () => { fireEvent.press(texto('Cancelar oferta')); });
      expect(mockM.cancelarOferta.mutateAsync).not.toHaveBeenCalled();
      expect(mockRouter.back).not.toHaveBeenCalled();
    });

    test('si falla: alerta y no sale de la pantalla', async () => {
      mockM.cancelarOferta.mutateAsync.mockRejectedValueOnce(new ApiError('No permitido', undefined, 403));
      montar();
      await act(async () => { fireEvent.press(texto('Cancelar oferta')); });
      expect(mockShowAlert).toHaveBeenCalledWith('Error', 'No permitido');
      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(mockAnuncio).not.toHaveBeenCalled();
      mockM.cancelarOferta.mutateAsync.mockRejectedValueOnce(new Error('x'));
      await act(async () => { fireEvent.press(texto('Cancelar oferta')); });
      expect(mockShowAlert).toHaveBeenLastCalledWith('Error', 'No se pudo cancelar la oferta.');
    });

    test('mientras cancela muestra "Cancelando…"', () => {
      mockM.cancelarOferta.isPending = true;
      montar();
      expect(screen.getByLabelText('Cancelando…')).toBeTruthy();
      expect(screen.queryByText('Cancelar oferta')).toBeNull();
    });
  });

  describe('turno fallido', () => {
    test('solo si se puede cancelar y alguien ya marcó ingreso (en progreso)', () => {
      conOferta({ asignaciones: [{ id: 100, estado: 'en_progreso' }] });
      montar();
      expect(texto('Turno fallido (fuerza mayor)')).toBeTruthy();
    });

    test('abre el modal; al terminar anuncia y vuelve', () => {
      conOferta({ asignaciones: [{ id: 100, estado: 'en_progreso' }] });
      montar();
      expect(screen.getByTestId('fallido-modal').props.children).toBe('false');
      fireEvent.press(texto('Turno fallido (fuerza mayor)'));
      expect(screen.getByTestId('fallido-modal').props.children).toBe('true');
      expect(mockFallidoProps.marcarFallidaM).toBe(mockM.marcarFallida);
      fireEvent.press(screen.getByTestId('fallido-done'));
      expect(screen.getByTestId('fallido-modal').props.children).toBe('false');
      expect(mockAnuncio).toHaveBeenCalledWith('"Evento Gala" marcado como fallido.', 'cancelado');
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });

    test('no aparece si la oferta ya no se puede cancelar', () => {
      conOferta({ estado: 'completada', asignaciones: [{ id: 100, estado: 'en_progreso' }] });
      montar();
      expect(screen.queryByText('Turno fallido (fuerza mayor)')).toBeNull();
    });
  });
});

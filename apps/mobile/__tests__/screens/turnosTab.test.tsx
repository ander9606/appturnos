/**
 * Caracterización de la pestaña Turnos ANTES de partirla: congela lo que dibuja y hace según el rol
 * (gestor / jefe_nomina / trabajador_turnos / trabajador_nomina), la vista (lista / mes) y las pestañas.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { COLORS } from '@/lib/designTokens';
import { ApiError } from '@api-client';
import TurnosScreen from '../../app/(tabs)/turnos';

// ── Bordes simulados ─────────────────────────────────────────────────────────
const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/lib/theme', () => ({ useTheme: () => ({ primary: '#111111' }) }));
jest.mock('@/components/ui/Spinner', () => {
  const { View } = require('react-native');
  return { Spinner: () => <View testID="spinner" /> };
});
jest.mock('@/lib/formatters', () => ({ ...jest.requireActual('@/lib/formatters'), bogotaToday: () => '2026-06-15' }));

let mockRol: string | undefined;
jest.mock('@/features/auth/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ usuario: { rol: mockRol } }),
}));

jest.mock('@/components/ui/EncabezadoPestana', () => {
  const { View, Text } = require('react-native');
  return {
    PantallaPestana: (p: { children: React.ReactNode }) => <View>{p.children}</View>,
    EncabezadoPestana: (p: { titulo: string; derecha?: React.ReactNode; children?: React.ReactNode }) => (
      <View><Text testID="titulo">{p.titulo}</Text>{p.derecha}{p.children}</View>
    ),
  };
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockWeekStrip: any;
jest.mock('@/features/turnos/WeekStrip', () => {
  const { Text, Pressable } = require('react-native');
  return {
    WeekStrip: (p: { selectedDate: string; onSelectDate: (d: string) => void }) => {
      mockWeekStrip = p;
      return (
        <>
          <Pressable testID="weekstrip" onPress={() => p.onSelectDate('2026-06-20')}><Text>{`strip:${p.selectedDate}`}</Text></Pressable>
          <Pressable testID="weekstrip-pasado" onPress={() => p.onSelectDate('2026-06-10')} />
        </>
      );
    },
  };
});
jest.mock('@/features/turnos/ShiftCard', () => {
  const { Text, Pressable } = require('react-native');
  return {
    ShiftCard: (p: { asignacion: { id: number }; showDate: boolean; onPress: () => void }) => (
      <Pressable testID={`shift-${p.asignacion.id}`} onPress={p.onPress}><Text>{`shift:${p.asignacion.id}:${p.showDate}`}</Text></Pressable>
    ),
  };
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockGestorProps: any;
jest.mock('@/features/turnos/GestorTurnosView', () => {
  const { Text } = require('react-native');
  return { GestorTurnosView: (p: { selectedDate: string; puedeGestionar: boolean }) => { mockGestorProps = p; return <Text testID="gestor-view">{`${p.selectedDate}|${p.puedeGestionar}`}</Text>; } };
});
jest.mock('@/features/nomina/TurnosExtraOptIn', () => {
  const { Text } = require('react-native');
  const { ApiError: AE } = require('@api-client');
  return {
    TurnosExtraOptIn: () => <Text>OPT-IN EXTRAS</Text>,
    esErrorTurnosExtraApagadas: (e: { status?: number; message: string }) => e instanceof AE && e.status === 403 && e.message.includes('turnos extra'),
  };
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockMes: any;
jest.mock('@/components/ui/MonthCalendar', () => {
  const { View, Pressable } = require('react-native');
  return {
    MonthCalendar: (p: { weeks: { date: string }[][]; renderDay: (d: unknown) => React.ReactNode; onDayPress: (d: unknown) => void }) => {
      mockMes = p;
      return <View testID="mes">{p.weeks.flat().map((d) => (
        <Pressable key={d.date} testID={`dia-${d.date}`} onPress={() => p.onDayPress(d)}>{p.renderDay(d)}</Pressable>
      ))}</View>;
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = { data?: any; isLoading?: boolean; isError?: boolean; error?: unknown; refetch?: jest.Mock; isRefetching?: boolean };
let mockMis: Q;
let mockOfertas: Q;
let mockOfertasMes: Q;
let mockOfertasCalls: { params: unknown; opts: { enabled?: boolean } }[];
let mockPend: Q;
let mockPendOpts: unknown;
let mockLiq: { data?: { pago_total: number }[] };
let mockLiqCall: { params: unknown; opts: unknown };
let mockAplicar: { mutateAsync: jest.Mock; isPending: boolean };
let mockMisOpts: unknown;
jest.mock('@/features/turnos/useTurnos', () => ({
  useMisTurnos: (o: unknown) => { mockMisOpts = o; return mockMis; },
  useOfertas: (params: { fecha_desde?: string }, opts: { enabled?: boolean }) => {
    mockOfertasCalls.push({ params, opts });
    return params.fecha_desde ? mockOfertasMes : mockOfertas;
  },
  useAplicar: () => mockAplicar,
  usePostulacionesPendientes: (o: unknown) => { mockPendOpts = o; return mockPend; },
  useLiquidacionTurnos: (params: unknown, opts: unknown) => { mockLiqCall = { params, opts }; return mockLiq; },
}));
let mockEventual: { data?: { nomina?: { estado: string; fecha_fin: string } } };
let mockEventualArg: unknown;
jest.mock('@/features/turnos/useTurnosEventual', () => ({
  usePeriodosEventual: (a: unknown) => { mockEventualArg = a; return mockEventual; },
}));
let mockPeriodos: { data?: { data: { fecha_inicio: string }[] } };
let mockPeriodosArgs: unknown[];
let mockNominaArg: unknown;
jest.mock('@/features/nomina/useNomina', () => ({
  useNominaPerfil: (a: unknown) => { mockNominaArg = a; return { data: undefined }; },
  usePeriodos: (...a: unknown[]) => { mockPeriodosArgs = a; return mockPeriodos; },
}));

// ── Datos ────────────────────────────────────────────────────────────────────
const q = (data: unknown, extra: Partial<Q> = {}): Q => ({ data, isLoading: false, isError: false, error: null, refetch: jest.fn(), isRefetching: false, ...extra });
const PUESTO = (o: Record<string, unknown> = {}) => ({ id: 1, cargo_id: 1, cargo_nombre: 'Mesero', tarifa_dia: 80000, plazas: 3, plazas_cubiertas: 1, ...o });
const OFERTA = (o: Record<string, unknown> = {}) => ({
  id: 1, titulo: 'Evento Gala', fecha: '2026-06-15', hora_inicio: '08:00:00', hora_fin_estimada: '17:30:00',
  lugar: 'Salón Norte', empresa_nombre: 'Acme', estado: 'abierta', puestos: [PUESTO()], ...o,
});
const ASIG = (o: Record<string, unknown> = {}) => ({
  id: 100, oferta_id: 900, oferta_fecha: '2026-06-15', hora_inicio: '09:00:00', hora_fin_estimada: '12:00:00', estado: 'confirmado', ...o,
});

function montar(rol: string | undefined) {
  mockRol = rol;
  return render(<TurnosScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMis = q([]);
  mockOfertas = q({ data: [] });
  mockOfertasMes = q({ data: [] });
  mockOfertasCalls = [];
  mockPend = q({ data: [] });
  mockLiq = { data: [] };
  mockAplicar = { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false };
  mockEventual = { data: undefined };
  mockPeriodos = { data: { data: [] } };
});

const colorDe = (testID: string) => {
  const cont = screen.getByTestId(testID);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const puntos = cont.findAll((n: any) => typeof n.type === 'string' && n.props?.style && StyleSheet.flatten(n.props.style)?.backgroundColor);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return puntos.map((n: any) => StyleSheet.flatten(n.props.style).backgroundColor);
};
const bordes = (testID: string) => {
  const cont = screen.getByTestId(testID);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cont.findAll((n: any) => typeof n.type === 'string' && n.props?.style && StyleSheet.flatten(n.props.style)?.borderColor)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((n: any) => StyleSheet.flatten(n.props.style).borderColor);
};

describe('encabezado y roles', () => {
  it.each([
    ['admin_empresa', 'Gestión de Turnos'], ['jefe_turnos', 'Gestión de Turnos'], ['jefe_nomina', 'Gestión de Turnos'],
    ['trabajador_nomina', 'Turnos Extra'], ['trabajador_turnos', 'Mis Turnos'], ['nomina', 'Mis Turnos'],
  ])('rol %s → título %s', (rol, titulo) => {
    montar(rol);
    expect(screen.getByTestId('titulo').props.children).toBe(titulo);
  });

  it('el rol nomina no ve botón de vista mes y no pide ofertas', () => {
    montar('nomina');
    expect(screen.queryByLabelText('Ver mes')).toBeNull();
    expect(mockOfertasCalls.find((c) => !(c.params as { fecha_desde?: string }).fecha_desde)?.opts.enabled).toBe(false);
  });

  it('los demás sí piden ofertas disponibles', () => {
    montar('admin_empresa');
    const c = mockOfertasCalls.find((x) => !(x.params as { fecha_desde?: string }).fecha_desde);
    expect(c?.params).toEqual({ disponibles: true });
    expect(c?.opts.enabled).toBe(true);
  });

  it('flags de datos por rol', () => {
    montar('trabajador_nomina');
    expect(mockMisOpts).toEqual({ enabled: true });
    expect(mockNominaArg).toBe(true);
    expect(mockEventualArg).toBe(true);
    expect(mockPendOpts).toEqual({ enabled: false });
    expect(mockPeriodosArgs).toEqual(['abierto', false]);
  });
  it('flags para trabajador_turnos', () => {
    montar('trabajador_turnos');
    expect(mockMisOpts).toEqual({ enabled: true });
    expect(mockNominaArg).toBe(false);
    expect(mockEventualArg).toBe(false);
  });
  it('flags para jefe_turnos y jefe_nomina', () => {
    montar('jefe_turnos');
    expect(mockMisOpts).toEqual({ enabled: false });
    expect(mockPendOpts).toEqual({ enabled: true });
    expect(mockPeriodosArgs).toEqual(['abierto', true]);
  });
  it('jefe_nomina no gestiona', () => {
    montar('jefe_nomina');
    expect(mockPendOpts).toEqual({ enabled: false });
    expect(mockPeriodosArgs).toEqual(['abierto', false]);
    expect(screen.queryByText('Total a pagar')).toBeNull();
    expect(screen.queryByLabelText('Crear turno')).toBeNull();
    expect(mockGestorProps.puedeGestionar).toBe(false);
  });
});

describe('gestor (vista lista)', () => {
  it('muestra tira semanal, GestorTurnosView con la fecha, total y FAB', () => {
    montar('admin_empresa');
    expect(mockGestorProps).toEqual({ selectedDate: '2026-06-15', puedeGestionar: true });
    expect(screen.getByText('strip:2026-06-15')).toBeTruthy();
    expect(screen.getByText('Total a pagar')).toBeTruthy();
    expect(screen.getByLabelText('Crear turno')).toBeTruthy();
  });
  it('elegir otra fecha en la tira actualiza la vista', () => {
    montar('admin_empresa');
    fireEvent.press(screen.getByTestId('weekstrip'));
    expect(mockGestorProps.selectedDate).toBe('2026-06-20');
  });
  it('FAB navega a crear turno', () => {
    montar('jefe_turnos');
    fireEvent.press(screen.getByLabelText('Crear turno'));
    expect(mockRouter.push).toHaveBeenCalledWith('/turno/nuevo');
  });
  it('total a pagar: suma de la liquidación, formato es-CO y navegación', () => {
    mockLiq = { data: [{ pago_total: 1000000 }, { pago_total: 250500 }] };
    montar('admin_empresa');
    expect(screen.getByText(`$${(1250500).toLocaleString('es-CO')}`)).toBeTruthy();
    fireEvent.press(screen.getByText('Total a pagar'));
    expect(mockRouter.push).toHaveBeenCalledWith('/liquidacion-turnos');
  });
  it('total en 0 sin liquidación', () => {
    mockLiq = { data: undefined };
    montar('admin_empresa');
    expect(screen.getByText('$0')).toBeTruthy();
  });
  it('liquidación pide desde el inicio del período abierto hasta hoy y solo si hay período', () => {
    mockPeriodos = { data: { data: [{ fecha_inicio: '2026-06-01' }] } };
    montar('admin_empresa');
    expect(mockLiqCall.params).toEqual({ fecha_inicio: '2026-06-01', fecha_fin: '2026-06-15' });
    expect(mockLiqCall.opts).toEqual({ enabled: true });
  });
  it('sin período abierto: desde hoy y deshabilitada', () => {
    montar('admin_empresa');
    expect(mockLiqCall.params).toEqual({ fecha_inicio: '2026-06-15', fecha_fin: '2026-06-15' });
    expect(mockLiqCall.opts).toEqual({ enabled: false });
  });
  it('postulaciones: "Al día" sin pendientes', () => {
    montar('admin_empresa');
    expect(screen.getByText('Al día')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Ver postulaciones'));
    expect(mockRouter.push).toHaveBeenCalledWith('/postulaciones');
  });
  it('postulaciones: cuenta de pendientes y color de aviso', () => {
    mockPend = q({ data: [{ oferta_id: 1 }, { oferta_id: 1 }, { oferta_id: 2 }] });
    montar('admin_empresa');
    expect(screen.getByText('3 pend.')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByLabelText('Ver postulaciones').props.style).backgroundColor).toBe(COLORS.warningLight);
  });
  it('sin pendientes el fondo es translúcido, no de aviso', () => {
    montar('admin_empresa');
    expect(StyleSheet.flatten(screen.getByLabelText('Ver postulaciones').props.style).backgroundColor).not.toBe(COLORS.warningLight);
  });
});

describe('vista mes — alternar', () => {
  it('el botón alterna entre mes y lista', () => {
    montar('admin_empresa');
    fireEvent.press(screen.getByLabelText('Ver mes'));
    expect(screen.getByTestId('mes')).toBeTruthy();
    expect(screen.queryByTestId('weekstrip')).toBeNull();
    expect(screen.queryByTestId('gestor-view')).toBeNull();
    fireEvent.press(screen.getByLabelText('Ver lista'));
    expect(screen.getByTestId('weekstrip')).toBeTruthy();
    expect(screen.getByTestId('gestor-view')).toBeTruthy();
  });
  it('pide ofertas del rango visible, tope 200, solo en vista mes', () => {
    montar('admin_empresa');
    const ant = mockOfertasCalls.find((c) => (c.params as { fecha_desde?: string }).fecha_desde);
    expect(ant?.opts.enabled).toBe(false);
    mockOfertasCalls = [];
    fireEvent.press(screen.getByLabelText('Ver mes'));
    const c = mockOfertasCalls.find((x) => (x.params as { fecha_desde?: string }).fecha_desde)!;
    expect(c.opts.enabled).toBe(true);
    const p = c.params as { fecha_desde: string; fecha_hasta: string; limit: number; disponibles?: boolean };
    expect(p.limit).toBe(200);
    expect(p.disponibles).toBeUndefined();
    expect(p.fecha_desde <= '2026-06-01').toBe(true);
    expect(p.fecha_hasta >= '2026-06-30').toBe(true);
  });
  it('trabajador pide solo disponibles', () => {
    montar('trabajador_turnos');
    mockOfertasCalls = [];
    fireEvent.press(screen.getByLabelText('Ver mes'));
    const c = mockOfertasCalls.find((x) => (x.params as { fecha_desde?: string }).fecha_desde)!;
    expect((c.params as { disponibles: boolean }).disponibles).toBe(true);
  });
  it('navegación de meses y encabezado', () => {
    montar('admin_empresa');
    fireEvent.press(screen.getByLabelText('Ver mes'));
    expect(screen.getByText('Junio 2026')).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const icon = (n: string) => screen.UNSAFE_getAllByProps({ name: n } as any);
    expect(icon('chevron-back').length).toBeGreaterThan(0);
  });
});

describe('vista mes — gestor', () => {
  const abrir = () => { montar('admin_empresa'); fireEvent.press(screen.getByLabelText('Ver mes')); };

  it('cargando: skeleton; error: ErrorState con reintentar', () => {
    mockOfertasMes = q(undefined, { isLoading: true });
    abrir();
    expect(screen.queryByTestId('mes')).toBeNull();
  });
  it('error del mes', () => {
    const refetch = jest.fn();
    mockOfertasMes = q(undefined, { isError: true, error: new Error('x'), refetch });
    abrir();
    fireEvent.press(screen.getByText('Reintentar'));
    expect(refetch).toHaveBeenCalled();
    expect(screen.queryByTestId('mes')).toBeNull();
  });
  it('leyenda', () => {
    abrir();
    for (const t of ['Borrador', 'Publicada', 'Necesita atención', 'Completada', 'Cancelada']) expect(screen.getByText(t)).toBeTruthy();
  });
  it('tocar un día lo marca y "Ver en lista" abre la lista con esa fecha', () => {
    abrir();
    fireEvent.press(screen.getByTestId('dia-2026-06-10'));
    fireEvent.press(screen.getByText('Ver en lista'));
    expect(screen.getByTestId('gestor-view').props.children).toBe('2026-06-10|true');
  });
  it('días sin ofertas no dibujan puntos', () => {
    abrir();
    expect(colorDe('dia-2026-06-10')).toEqual([]);
  });
  it('colores por estado', () => {
    mockOfertasMes = q({ data: [
      OFERTA({ id: 1, fecha: '2026-06-20', estado: 'cancelada' }),
      OFERTA({ id: 2, fecha: '2026-06-21', estado: 'completada' }),
      OFERTA({ id: 3, fecha: '2026-06-22', estado: 'borrador' }),
      OFERTA({ id: 4, fecha: '2026-06-28', estado: 'abierta', puestos: [PUESTO({ plazas: 2, plazas_cubiertas: 2 })] }),
      OFERTA({ id: 5, fecha: '2026-06-17', estado: 'abierta', puestos: [PUESTO({ plazas: 3, plazas_cubiertas: 1 })] }),
      OFERTA({ id: 6, fecha: '2026-06-30', estado: 'abierta', puestos: [PUESTO({ plazas: 3, plazas_cubiertas: 1 })] }),
      OFERTA({ id: 7, fecha: '2026-06-18', estado: 'abierta', puestos: [PUESTO({ plazas: 3, plazas_cubiertas: 1 })] }),
      OFERTA({ id: 8, fecha: '2026-06-25', estado: 'abierta', puestos: undefined }),
    ] });
    mockPend = q({ data: [{ oferta_id: 6 }] });
    abrir();
    expect(colorDe('dia-2026-06-20')).toEqual([COLORS.danger]);
    expect(colorDe('dia-2026-06-21')).toEqual([COLORS.success]);
    expect(colorDe('dia-2026-06-22')).toEqual([COLORS.placeholder]);
    expect(colorDe('dia-2026-06-28')).toEqual(['#111111']);     // completa, sin urgencia
    expect(colorDe('dia-2026-06-17')).toEqual([COLORS.warning]); // incompleta y a 2 días
    expect(colorDe('dia-2026-06-30')).toEqual([COLORS.warning]); // lejana pero con pendientes
    expect(colorDe('dia-2026-06-18')).toEqual([COLORS.warning]); // incompleta a exactamente 3 días
    expect(colorDe('dia-2026-06-25')).toEqual(['#111111']);     // sin puestos
  });
  it('incompleta a 4 días no es urgente', () => {
    mockOfertasMes = q({ data: [OFERTA({ id: 1, fecha: '2026-06-19', puestos: [PUESTO({ plazas: 3, plazas_cubiertas: 1 })] })] });
    abrir();
    expect(colorDe('dia-2026-06-19')).toEqual(['#111111']);
  });
  it('máximo 5 puntos por día', () => {
    mockOfertasMes = q({ data: Array.from({ length: 7 }, (_, i) => OFERTA({ id: i + 1, fecha: '2026-06-20', estado: 'completada' })) });
    abrir();
    expect(colorDe('dia-2026-06-20')).toHaveLength(5);
  });
  it('vencida incompleta (fecha pasada) es urgente', () => {
    mockOfertasMes = q({ data: [OFERTA({ id: 1, fecha: '2026-06-10', puestos: [PUESTO({ plazas: 3, plazas_cubiertas: 1 })] })] });
    abrir();
    expect(colorDe('dia-2026-06-10')).toEqual([COLORS.warning]);
  });
});

describe('trabajador — vista mes', () => {
  const abrir = (rol = 'trabajador_turnos') => { montar(rol); fireEvent.press(screen.getByLabelText('Ver mes')); };

  it('cargando por ofertas o por mis turnos', () => {
    mockOfertasMes = q(undefined, { isLoading: true });
    abrir();
    expect(screen.queryByTestId('mes')).toBeNull();
  });
  it('cargando mis turnos', () => {
    mockMis = q(undefined, { isLoading: true });
    abrir();
    expect(screen.queryByTestId('mes')).toBeNull();
  });
  it('error: reintenta ambos', () => {
    const r1 = jest.fn().mockResolvedValue(1); const r2 = jest.fn().mockResolvedValue(1);
    mockOfertasMes = q(undefined, { isError: true, error: new Error('a'), refetch: r1 });
    mockMis = q(undefined, { isError: true, error: new Error('b'), refetch: r2 });
    abrir();
    fireEvent.press(screen.getByText('Reintentar'));
    expect(r1).toHaveBeenCalled();
    expect(r2).toHaveBeenCalled();
  });
  it('error solo en mis turnos', () => {
    mockMis = q(undefined, { isError: true, error: new Error('b') });
    abrir();
    expect(screen.getByText('Reintentar')).toBeTruthy();
  });
  it('trabajador_nomina con extras apagadas ve el opt-in', () => {
    mockOfertasMes = q(undefined, { isError: true, error: new ApiError('turnos extra apagados', undefined, 403) });
    abrir('trabajador_nomina');
    expect(screen.getByText('OPT-IN EXTRAS')).toBeTruthy();
  });
  it('trabajador_turnos con ese error ve ErrorState, no el opt-in', () => {
    mockOfertasMes = q(undefined, { isError: true, error: new ApiError('turnos extra apagados', undefined, 403) });
    abrir('trabajador_turnos');
    expect(screen.queryByText('OPT-IN EXTRAS')).toBeNull();
    expect(screen.getByText('Reintentar')).toBeTruthy();
  });
  it('leyenda', () => {
    abrir();
    for (const t of ['Aceptado', 'Postulación pendiente', 'Disponibles']) expect(screen.getByText(t)).toBeTruthy();
  });
  it('tocar un día lo marca y "Ver en lista" abre la lista con esa fecha', () => {
    abrir();
    fireEvent.press(screen.getByTestId('dia-2026-06-10'));
    fireEvent.press(screen.getByText('Ver en lista'));
    expect(screen.getByText('strip:2026-06-10')).toBeTruthy();
  });
  it('puntos: aceptados (máx 3) sólidos, pendientes (máx 2) y disponibles (máx 3) con borde', () => {
    mockMis = q([
      ASIG({ id: 1, oferta_id: 1, oferta_fecha: '2026-06-20', estado: 'confirmado' }),
      ASIG({ id: 2, oferta_id: 2, oferta_fecha: '2026-06-20', estado: 'en_progreso' }),
      ASIG({ id: 3, oferta_id: 3, oferta_fecha: '2026-06-20', estado: 'completado' }),
      ASIG({ id: 4, oferta_id: 4, oferta_fecha: '2026-06-20', estado: 'confirmado' }),
      ASIG({ id: 5, oferta_id: 5, oferta_fecha: '2026-06-21', estado: 'pendiente' }),
      ASIG({ id: 6, oferta_id: 6, oferta_fecha: '2026-06-21', estado: 'por_reconfirmar' }),
      ASIG({ id: 7, oferta_id: 7, oferta_fecha: '2026-06-21', estado: 'pendiente' }),
      ASIG({ id: 8, oferta_id: 8, oferta_fecha: '2026-06-22', estado: 'rechazado' }),
    ]);
    mockOfertasMes = q({ data: [
      OFERTA({ id: 20, fecha: '2026-06-23' }), OFERTA({ id: 21, fecha: '2026-06-23' }),
      OFERTA({ id: 22, fecha: '2026-06-23' }), OFERTA({ id: 23, fecha: '2026-06-23' }),
      OFERTA({ id: 5, fecha: '2026-06-24' }), // ya postulado → no cuenta como disponible
    ] });
    abrir();
    expect(colorDe('dia-2026-06-20')).toEqual(['#111111', '#111111', '#111111']);
    expect(bordes('dia-2026-06-21')).toEqual(['#111111', '#111111']);
    expect(colorDe('dia-2026-06-22')).toEqual([]);
    expect(bordes('dia-2026-06-22')).toEqual([]);
    expect(bordes('dia-2026-06-23')).toEqual([COLORS.info, COLORS.info, COLORS.info]);
    expect(bordes('dia-2026-06-24')).toEqual([]);
  });
});

describe('trabajador — vista lista', () => {
  it('trabajador ve pestañas y empieza en Mis Turnos', () => {
    montar('trabajador_turnos');
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getAllByRole('tab')[0].props.accessibilityState.selected).toBe(true);
  });
  it('gestor no ve pestañas y empieza en disponibles', () => {
    montar('admin_empresa');
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
  it('rol nomina (sin ser trabajador) no ve pestañas y ve sus turnos', () => {
    mockMis = q([ASIG({ id: 1 })]);
    montar('nomina');
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.getByTestId('shift-1')).toBeTruthy();
  });
  it('cambiar de pestaña', () => {
    montar('trabajador_turnos');
    fireEvent.press(screen.getAllByRole('tab')[1]);
    expect(screen.getAllByRole('tab')[1].props.accessibilityState.selected).toBe(true);
    expect(screen.getAllByRole('tab')[0].props.accessibilityState.selected).toBe(false);
  });

  describe('mis turnos', () => {
    it('lista solo los turnos del día seleccionado y navega al detalle', () => {
      mockMis = q([ASIG({ id: 1 }), ASIG({ id: 2, oferta_fecha: '2026-06-16' })]);
      montar('trabajador_turnos');
      expect(screen.getByText('shift:1:false')).toBeTruthy();
      expect(screen.queryByTestId('shift-2')).toBeNull();
      fireEvent.press(screen.getByTestId('shift-1'));
      expect(mockRouter.push).toHaveBeenCalledWith('/turno/1');
    });
    it('al cambiar el día cambia la lista', () => {
      mockMis = q([ASIG({ id: 1 }), ASIG({ id: 2, oferta_fecha: '2026-06-20' })]);
      montar('trabajador_turnos');
      fireEvent.press(screen.getByTestId('weekstrip'));
      expect(screen.getByTestId('shift-2')).toBeTruthy();
      expect(screen.queryByTestId('shift-1')).toBeNull();
    });
    it('vacío con mensaje del día', () => {
      montar('trabajador_turnos');
      expect(screen.getByText('Sin turnos este día')).toBeTruthy();
      expect(screen.getByText('No tienes turnos asignados el Lun 15 Jun.')).toBeTruthy();
    });
    it('cargando y error', () => {
      mockMis = q(undefined, { isLoading: true });
      montar('trabajador_turnos');
      expect(screen.queryByText('Sin turnos este día')).toBeNull();
    });
    it('error con reintentar', () => {
      const refetch = jest.fn();
      mockMis = q(undefined, { isError: true, error: new Error('x'), refetch });
      montar('trabajador_turnos');
      fireEvent.press(screen.getByText('Reintentar'));
      expect(refetch).toHaveBeenCalled();
    });
    it('la tira marca días con turnos propios u ofertas', () => {
      mockMis = q([ASIG({ oferta_fecha: '2026-06-16' })]);
      mockOfertas = q({ data: [OFERTA({ fecha: '2026-06-17' })] });
      montar('trabajador_turnos');
      expect([...mockWeekStrip.datesWithShifts].sort()).toEqual(['2026-06-16', '2026-06-17']);
    });
    it('refrescar recarga turnos y ofertas', () => {
      const r1 = jest.fn(); const r2 = jest.fn();
      mockMis = q([], { refetch: r1 }); mockOfertas = q({ data: [] }, { refetch: r2 });
      montar('trabajador_turnos');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lista = screen.UNSAFE_getByType(require('react-native').FlatList) as any;
      act(() => lista.props.refreshControl.props.onRefresh());
      expect(r1).toHaveBeenCalled();
      expect(r2).toHaveBeenCalled();
      expect(lista.props.refreshControl.props.refreshing).toBe(false);
    });
    it('refreshing refleja cualquiera de las dos cargas', () => {
      mockOfertas = q({ data: [] }, { isRefetching: true });
      montar('trabajador_turnos');
      expect(screen.UNSAFE_getByType(require('react-native').FlatList).props.refreshControl.props.refreshing).toBe(true);
    });
  });

  describe('banner eventual (trabajador_nomina)', () => {
    it('sin período: atenuado y sin navegación', () => {
      montar('trabajador_nomina');
      expect(screen.getByText('Aún no hay período eventual abierto')).toBeTruthy();
      fireEvent.press(screen.getByText('Turnos eventuales · Pago trimestral'));
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
    it('período abierto: texto y navegación', () => {
      mockEventual = { data: { nomina: { estado: 'abierto', fecha_fin: '2026-09-30' } } };
      montar('trabajador_nomina');
      expect(screen.getByText('Período abierto hasta 2026-09-30')).toBeTruthy();
      fireEvent.press(screen.getByText('Turnos eventuales · Pago trimestral'));
      expect(mockRouter.push).toHaveBeenCalledWith('/liquidacion-eventual');
    });
    it('período liquidado', () => {
      mockEventual = { data: { nomina: { estado: 'liquidado', fecha_fin: '2026-03-31' } } };
      montar('trabajador_nomina');
      expect(screen.getByText('Período liquidado')).toBeTruthy();
    });
    it('trabajador_turnos no lo ve', () => {
      montar('trabajador_turnos');
      expect(screen.queryByText('Turnos eventuales · Pago trimestral')).toBeNull();
    });
  });

  describe('disponibles', () => {
    const irADisponibles = (rol = 'trabajador_turnos') => { montar(rol); fireEvent.press(screen.getAllByRole('tab')[1]); };

    it('filtra por el día seleccionado', () => {
      mockOfertas = q({ data: [OFERTA({ id: 1, titulo: 'Hoy' }), OFERTA({ id: 2, titulo: 'Otro', fecha: '2026-06-16' })] });
      irADisponibles();
      expect(screen.getByText('Hoy')).toBeTruthy();
      expect(screen.queryByText('Otro')).toBeNull();
    });
    it('cargando: sin lista; vacío con mensaje', () => {
      irADisponibles();
      expect(screen.getByText('Sin ofertas este día')).toBeTruthy();
      expect(screen.getByText('No hay turnos disponibles el Lun 15 Jun. Prueba con otra fecha.')).toBeTruthy();
    });
    it('cargando', () => {
      mockOfertas = q(undefined, { isLoading: true });
      irADisponibles();
      expect(screen.queryByText('Sin ofertas este día')).toBeNull();
    });
    it('error con reintentar', () => {
      const refetch = jest.fn();
      mockOfertas = q(undefined, { isError: true, error: new Error('x'), refetch });
      irADisponibles();
      fireEvent.press(screen.getByText('Reintentar'));
      expect(refetch).toHaveBeenCalled();
    });
    it('trabajador_nomina con extras apagadas ve el opt-in', () => {
      mockOfertas = q(undefined, { isError: true, error: new ApiError('turnos extra apagados', undefined, 403) });
      irADisponibles('trabajador_nomina');
      expect(screen.getByText('OPT-IN EXTRAS')).toBeTruthy();
    });
    it('trabajador_turnos con ese error ve ErrorState', () => {
      mockOfertas = q(undefined, { isError: true, error: new ApiError('turnos extra apagados', undefined, 403) });
      irADisponibles('trabajador_turnos');
      expect(screen.queryByText('OPT-IN EXTRAS')).toBeNull();
      expect(screen.getByText('Reintentar')).toBeTruthy();
    });
    it('aviso de calificación solo para no-nómina y navega a mis-empresas', () => {
      irADisponibles('trabajador_turnos');
      fireEvent.press(screen.getByText('Ves las ofertas antes o después según tu calificación en cada empresa.'));
      expect(mockRouter.push).toHaveBeenCalledWith('/mis-empresas');
    });
    it('trabajador_nomina no ve el aviso', () => {
      irADisponibles('trabajador_nomina');
      expect(screen.queryByText('Ver')).toBeNull();
    });
    it('buscador solo si hay ofertas; filtra por título, empresa, lugar y cargo (sin importar mayúsculas)', () => {
      irADisponibles();
      expect(screen.queryByPlaceholderText('Buscar por empresa, cargo o lugar…')).toBeNull();
    });
    it('buscador con ofertas', () => {
      mockOfertas = q({ data: [
        OFERTA({ id: 1, titulo: 'Gala', empresa_nombre: 'Acme', lugar: 'Norte', puestos: [PUESTO({ cargo_nombre: 'Mesero' })] }),
        OFERTA({ id: 2, titulo: 'Feria', empresa_nombre: 'Zeta', lugar: 'Sur', puestos: [PUESTO({ cargo_nombre: 'Cocinero' })] }),
        OFERTA({ id: 3, titulo: 'Otra', empresa_nombre: null, lugar: null, puestos: undefined }),
      ] });
      irADisponibles();
      const input = screen.getByPlaceholderText('Buscar por empresa, cargo o lugar…');
      fireEvent.changeText(input, '  GALA ');
      expect(screen.getByText('Gala')).toBeTruthy();
      expect(screen.queryByText('Feria')).toBeNull();
      fireEvent.changeText(input, 'zeta');
      expect(screen.getByText('Feria')).toBeTruthy();
      fireEvent.changeText(input, 'sur');
      expect(screen.getByText('Feria')).toBeTruthy();
      fireEvent.changeText(input, 'cocin');
      expect(screen.getByText('Feria')).toBeTruthy();
      expect(screen.queryByText('Gala')).toBeNull();
      fireEvent.changeText(input, 'nada');
      expect(screen.getByText('Sin resultados')).toBeTruthy();
      expect(screen.getByText('No hay ofertas que coincidan con "nada".')).toBeTruthy();
      // botón limpiar
      fireEvent.press(screen.UNSAFE_getByProps({ name: 'close-circle' }).parent!.parent!);
      expect(screen.getByDisplayValue('')).toBeTruthy();
    });
    it('búsqueda vacía de solo espacios no filtra', () => {
      mockOfertas = q({ data: [OFERTA({ id: 1, titulo: 'Gala' })] });
      irADisponibles();
      fireEvent.changeText(screen.getByPlaceholderText('Buscar por empresa, cargo o lugar…'), '   ');
      expect(screen.getByText('Gala')).toBeTruthy();
    });
    it('la búsqueda se conserva al cambiar de pestaña y volver', () => {
      mockOfertas = q({ data: [OFERTA({ id: 1, titulo: 'Gala' })] });
      irADisponibles();
      fireEvent.changeText(screen.getByPlaceholderText('Buscar por empresa, cargo o lugar…'), 'gal');
      fireEvent.press(screen.getAllByRole('tab')[0]);
      fireEvent.press(screen.getAllByRole('tab')[1]);
      expect(screen.getByDisplayValue('gal')).toBeTruthy();
    });
  });
});

describe('tarjeta de oferta', () => {
  const ir = (ofertas: unknown[], mis: unknown[] = []) => {
    mockOfertas = q({ data: ofertas });
    mockMis = q(mis);
    montar('trabajador_turnos');
    fireEvent.press(screen.getAllByRole('tab')[1]);
  };

  it('contenido básico', () => {
    ir([OFERTA()]);
    expect(screen.getByText('Acme')).toBeTruthy();
    expect(screen.getByText('Evento Gala')).toBeTruthy();
    expect(screen.getByText('2 libres')).toBeTruthy();
    expect(screen.getByText('Mesero')).toBeTruthy();
    expect(screen.getByText('Lun 15 Jun')).toBeTruthy();
    expect(screen.getByText('8:00 – 17:30')).toBeTruthy();
    expect(screen.getByText('Salón Norte')).toBeTruthy();
    expect(screen.getByText(`$${(80000).toLocaleString('es-CO')} / turno`)).toBeTruthy();
    expect(screen.getByText('Aplicar')).toBeTruthy();
  });
  it('plazas: singular, plural y ninguna', () => {
    ir([OFERTA({ id: 1, titulo: 'A', puestos: [PUESTO({ plazas: 2, plazas_cubiertas: 1 })] }),
        OFERTA({ id: 2, titulo: 'B', puestos: [PUESTO({ plazas: 9, plazas_cubiertas: 0 })] }),
        OFERTA({ id: 3, titulo: 'C', puestos: [PUESTO({ plazas: 2, plazas_cubiertas: 2 })] })]);
    expect(screen.getByText('1 libre')).toBeTruthy();
    expect(screen.getByText('9 libres')).toBeTruthy();
    expect(screen.getByText('Sin plazas')).toBeTruthy();
  });
  it('sin hora fin y sin lugar ni empresa', () => {
    ir([OFERTA({ hora_fin_estimada: null, lugar: null, empresa_nombre: null })]);
    expect(screen.getByText('8:00')).toBeTruthy();
    expect(screen.queryByText('Salón Norte')).toBeNull();
    expect(screen.queryByText('Acme')).toBeNull();
  });
  it('varios cargos: "N cargos disponibles", "Elegir cargo" navega al detalle', () => {
    ir([OFERTA({ puestos: [PUESTO({ id: 1 }), PUESTO({ id: 2, cargo_nombre: 'Cocinero' }), PUESTO({ id: 3, plazas: 1, plazas_cubiertas: 1 })] })]);
    expect(screen.getByText('2 cargos disponibles')).toBeTruthy();
    fireEvent.press(screen.getByText('Elegir cargo'));
    expect(mockRouter.push).toHaveBeenCalledWith('/oferta/1');
  });
  it('tocar la tarjeta navega al detalle', () => {
    ir([OFERTA({ id: 7 })]);
    fireEvent.press(screen.getByText('Evento Gala'));
    expect(mockRouter.push).toHaveBeenCalledWith('/oferta/7');
  });
  it('tarifas: la mínima y "Desde" si hay varias distintas', () => {
    ir([OFERTA({ id: 1, titulo: 'A', puestos: [PUESTO({ tarifa_dia: 90000 }), PUESTO({ id: 2, tarifa_dia: 70000 })] }),
        OFERTA({ id: 2, titulo: 'B', puestos: [PUESTO({ tarifa_dia: 50000 }), PUESTO({ id: 2, tarifa_dia: 50000 })] })]);
    expect(screen.getByText(`Desde $${(70000).toLocaleString('es-CO')} / turno`)).toBeTruthy();
    expect(screen.getByText(`$${(50000).toLocaleString('es-CO')} / turno`)).toBeTruthy();
  });
  it('sin puestos: tarifa 0 y "Sin plazas"', () => {
    ir([OFERTA({ puestos: undefined })]);
    expect(screen.getByText('$0 / turno')).toBeTruthy();
    expect(screen.getByText('Sin plazas')).toBeTruthy();
  });
  it('ya postulado', () => {
    ir([OFERTA({ id: 5 })], [ASIG({ oferta_id: 5, oferta_fecha: '2026-06-01' })]);
    expect(screen.getByText('Ya postulado')).toBeTruthy();
    expect(screen.queryByText('Aplicar')).toBeNull();
  });
  it('Aplicar manda oferta y primer puesto libre; ignora el error', async () => {
    mockAplicar.mutateAsync.mockRejectedValueOnce(new Error('x'));
    ir([OFERTA({ id: 5, puestos: [PUESTO({ id: 11, plazas: 1, plazas_cubiertas: 1 }), PUESTO({ id: 12 })] })]);
    await act(async () => { fireEvent.press(screen.getByText('Aplicar')); });
    expect(mockAplicar.mutateAsync).toHaveBeenCalledWith({ ofertaId: 5, puestoId: 12 });
  });
  it('Aplicando…', () => {
    mockAplicar.isPending = true;
    ir([OFERTA()]);
    expect(screen.queryByText('Aplicar')).toBeNull();
    expect(screen.getByLabelText('Aplicando…')).toBeTruthy();
  });
  it('oferta pasada: badge Pasado, Evento finalizado y sin acciones ni traslape', () => {
    ir([OFERTA({ fecha: '2026-06-10', hora_inicio: '10:00:00', hora_fin_estimada: '11:00:00' })],
      [ASIG({ oferta_id: 99, oferta_fecha: '2026-06-10' })]);
    fireEvent.press(screen.getByTestId('weekstrip-pasado'));
    expect(screen.getByText('Pasado')).toBeTruthy();
    expect(screen.getByText('Evento finalizado')).toBeTruthy();
    expect(screen.queryByText('Aplicar')).toBeNull();
    expect(screen.queryByText('Ya tienes un turno confirmado en este horario')).toBeNull();
    expect(screen.queryByText(/libre/)).toBeNull();
  });
  it('oferta pasada ya postulada sigue diciendo Evento finalizado', () => {
    ir([OFERTA({ id: 5, fecha: '2026-06-10' })], [ASIG({ oferta_id: 5, oferta_fecha: '2026-06-01' })]);
    fireEvent.press(screen.getByTestId('weekstrip-pasado'));
    expect(screen.getByText('Evento finalizado')).toBeTruthy();
    expect(screen.queryByText('Ya postulado')).toBeNull();
  });
  it('color de la franja: pasada, traslape y normal', () => {
    const franja = () => screen.UNSAFE_getAllByType(require('react-native').View)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((v: any) => StyleSheet.flatten(v.props.style)?.backgroundColor).filter(Boolean);
    ir([OFERTA({ fecha: '2026-06-10' })]);
    fireEvent.press(screen.getByTestId('weekstrip-pasado'));
    expect(franja()).toContain(COLORS.borderStrong);
  });
  it('franja normal y de traslape', () => {
    const franja = () => screen.UNSAFE_getAllByType(require('react-native').View)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((v: any) => StyleSheet.flatten(v.props.style)?.backgroundColor).filter(Boolean);
    ir([OFERTA()]);
    expect(franja()).toContain(COLORS.primary400);
  });
  it('franja de traslape', () => {
    const franja = () => screen.UNSAFE_getAllByType(require('react-native').View)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((v: any) => StyleSheet.flatten(v.props.style)?.backgroundColor).filter(Boolean);
    ir([OFERTA({ hora_inicio: '10:00:00', hora_fin_estimada: '11:00:00' })], [ASIG({ oferta_id: 99 })]);
    expect(franja()).toContain(COLORS.warning);
  });
  it('variante del badge de plazas: ≤2 aviso, >2 info', () => {
    ir([OFERTA({ id: 1, titulo: 'A', puestos: [PUESTO({ plazas: 3, plazas_cubiertas: 1 })] }),
        OFERTA({ id: 2, titulo: 'B', puestos: [PUESTO({ plazas: 4, plazas_cubiertas: 1 })] })]);
    const cls = (t: string) => String(screen.getByText(t).parent?.props.className ?? '') + String(screen.getByText(t).props.className ?? '');
    expect(cls('2 libres')).not.toEqual(cls('3 libres'));
  });
  it('traslape con turno confirmado o en progreso', () => {
    ir([OFERTA({ hora_inicio: '10:00:00', hora_fin_estimada: '11:00:00' })], [ASIG({ oferta_id: 99 })]);
    expect(screen.getByText('Ya tienes un turno confirmado en este horario')).toBeTruthy();
  });
  it('sin traslape: horario contiguo, otro día o estado pendiente', () => {
    ir([OFERTA({ hora_inicio: '12:00:00', hora_fin_estimada: '14:00:00' })], [ASIG({ oferta_id: 99 }), ASIG({ id: 5, oferta_id: 98, hora_inicio: '07:00:00', hora_fin_estimada: '08:00:00' })]);
    expect(screen.queryByText('Ya tienes un turno confirmado en este horario')).toBeNull();
  });
  it('turno pendiente no cuenta para traslape', () => {
    ir([OFERTA({ hora_inicio: '10:00:00', hora_fin_estimada: '11:00:00' })], [ASIG({ oferta_id: 99, estado: 'pendiente' })]);
    expect(screen.queryByText('Ya tienes un turno confirmado en este horario')).toBeNull();
  });
  it('traslape con turno en_progreso y sin hora de fin (hasta fin del día)', () => {
    ir([OFERTA({ hora_inicio: '20:00:00', hora_fin_estimada: null })], [ASIG({ oferta_id: 99, estado: 'en_progreso', hora_inicio: '22:00:00', hora_fin_estimada: null })]);
    expect(screen.getByText('Ya tienes un turno confirmado en este horario')).toBeTruthy();
  });
  it('turno en otra fecha no traslapa', () => {
    ir([OFERTA({ hora_inicio: '10:00:00', hora_fin_estimada: '11:00:00' })], [ASIG({ oferta_id: 99, oferta_fecha: '2026-06-16' })]);
    expect(screen.queryByText('Ya tienes un turno confirmado en este horario')).toBeNull();
  });
});

describe('casos extra (sobrevivientes de mutación)', () => {
  const franjas = () => screen.UNSAFE_getAllByType(require('react-native').View)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((v: any) => StyleSheet.flatten(v.props.style) ?? {});
  const irOfertas = (ofertas: unknown[], mis: unknown[] = [], rol = 'trabajador_turnos') => {
    mockOfertas = q({ data: ofertas });
    mockMis = q(mis);
    montar(rol);
    fireEvent.press(screen.getAllByRole('tab')[1]);
  };

  it('formatShortDate cubre todos los días y meses', () => {
    const { formatShortDate, fmtRangeSimple } = require('../../features/turnos/pestana/turnosPestana');
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    for (let m = 0; m < 12; m++) {
      const iso = `2026-${String(m + 1).padStart(2, '0')}-05`;
      const d = new Date(`${iso}T00:00:00`);
      expect(formatShortDate(iso)).toBe(`${dias[d.getDay()]} 5 ${meses[m]}`);
    }
    expect(fmtRangeSimple('08:00:00', '09:30:00')).toBe('8:00 – 9:30');
    expect(fmtRangeSimple('10:00:00', null)).toBe('10:00');
  });

  it('rango horario con cero inicial en la hora de fin', () => {
    irOfertas([OFERTA({ hora_inicio: '08:00:00', hora_fin_estimada: '09:30:00' })]);
    expect(screen.getByText('8:00 – 9:30')).toBeTruthy();
  });
  it('turno que empieza después de que termina la oferta no traslapa', () => {
    irOfertas([OFERTA({ hora_inicio: '08:00:00', hora_fin_estimada: '09:00:00' })],
      [ASIG({ oferta_id: 99, hora_inicio: '13:00:00', hora_fin_estimada: '18:00:00' })]);
    expect(screen.queryByText('Ya tienes un turno confirmado en este horario')).toBeNull();
  });

  it('pasada: sin sombra y atenuada; futura: con sombra', () => {
    irOfertas([OFERTA({ fecha: '2026-06-10' })]);
    fireEvent.press(screen.getByTestId('weekstrip-pasado'));
    expect(franjas().some((s) => s.opacity === 0.65 && s.elevation === 0)).toBe(true);
  });
  it('futura: opacidad completa y elevación 2', () => {
    irOfertas([OFERTA()]);
    expect(franjas().some((s) => s.opacity === 1 && s.elevation === 2)).toBe(true);
  });

  it('pasos del calendario: mes anterior y siguiente (gestor)', () => {
    montar('admin_empresa');
    fireEvent.press(screen.getByLabelText('Ver mes'));
    fireEvent.press(screen.getByLabelText('Mes anterior'));
    expect(screen.getByText('Mayo 2026')).toBeTruthy();
    const sig = () => screen.getByLabelText('Mes siguiente');
    fireEvent.press(sig());
    fireEvent.press(sig());
    expect(screen.getByText('Julio 2026')).toBeTruthy();
  });

  it('gestor: incompleta pero completa por plazas no es urgente aunque falten ≤3 días', () => {
    mockOfertasMes = q({ data: [OFERTA({ id: 1, fecha: '2026-06-16', puestos: [PUESTO({ plazas: 2, plazas_cubiertas: 2 })] })] });
    montar('admin_empresa');
    fireEvent.press(screen.getByLabelText('Ver mes'));
    expect(colorDe('dia-2026-06-16')).toEqual(['#111111']);
  });

  describe('trabajador mes: estados de los puntos', () => {
    const abrir = () => { montar('trabajador_turnos'); fireEvent.press(screen.getByLabelText('Ver mes')); };
    it('solo completado → un punto sólido', () => {
      mockMis = q([ASIG({ oferta_id: 1, oferta_fecha: '2026-06-20', estado: 'completado' })]);
      abrir();
      expect(colorDe('dia-2026-06-20')).toEqual(['#111111']);
    });
    it('solo en_progreso → un punto sólido', () => {
      mockMis = q([ASIG({ oferta_id: 1, oferta_fecha: '2026-06-20', estado: 'en_progreso' })]);
      abrir();
      expect(colorDe('dia-2026-06-20')).toEqual(['#111111']);
    });
    it('solo por_reconfirmar → un punto con borde', () => {
      mockMis = q([ASIG({ oferta_id: 1, oferta_fecha: '2026-06-20', estado: 'por_reconfirmar' })]);
      abrir();
      expect(bordes('dia-2026-06-20')).toEqual(['#111111']);
      expect(colorDe('dia-2026-06-20')).toEqual([]);
    });
    it('error en ofertas y en mis turnos: prevalece el de ofertas', () => {
      mockOfertasMes = q(undefined, { isError: true, error: new ApiError('ERR-OFERTAS', undefined, 400) });
      mockMis = q(undefined, { isError: true, error: new ApiError('ERR-MIOS', undefined, 400) });
      abrir();
      expect(screen.queryByText('ERR-OFERTAS')).toBeTruthy();
      expect(screen.queryByText('ERR-MIOS')).toBeNull();
    });
    it('texto por defecto del error del mes', () => {
      mockOfertasMes = q(undefined, { isError: true, error: new Error('x') });
      abrir();
      expect(screen.getByText('No se pudieron cargar los turnos del mes')).toBeTruthy();
    });
  });
  it('gestor: texto por defecto del error del mes', () => {
    mockOfertasMes = q(undefined, { isError: true, error: new Error('x') });
    montar('admin_empresa');
    fireEvent.press(screen.getByLabelText('Ver mes'));
    expect(screen.getByText('No se pudieron cargar los turnos del mes')).toBeTruthy();
  });

  it('una sola postulación pendiente: "1 pend." y color de aviso', () => {
    mockPend = q({ data: [{ oferta_id: 1 }] });
    montar('admin_empresa');
    expect(screen.getByText('1 pend.')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByLabelText('Ver postulaciones').props.style).backgroundColor).toBe(COLORS.warningLight);
  });

  it('banner eventual: opacidad según haya período', () => {
    montar('trabajador_nomina');
    expect(franjas().some((s) => s.opacity === 0.6)).toBe(true);
  });
  it('banner eventual con período: opacidad completa', () => {
    mockEventual = { data: { nomina: { estado: 'abierto', fecha_fin: '2026-09-30' } } };
    montar('trabajador_nomina');
    expect(franjas().some((s) => s.opacity === 0.6)).toBe(false);
  });

  it('sin texto de búsqueda no hay botón de limpiar; con texto sí', () => {
    irOfertas([OFERTA()]);
    expect(screen.queryByTestId('icon-close-circle')).toBeNull();
    expect(screen.UNSAFE_queryByProps({ name: 'close-circle' })).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText('Buscar por empresa, cargo o lugar…'), 'a');
    expect(screen.UNSAFE_queryByProps({ name: 'close-circle' })).not.toBeNull();
  });
  it('el buscador desactiva la autocorrección', () => {
    irOfertas([OFERTA()]);
    expect(screen.getByPlaceholderText('Buscar por empresa, cargo o lugar…').props.autoCorrect).toBe(false);
  });
  it('búsqueda de solo espacios sin ofertas del día: mensaje de día vacío', () => {
    irOfertas([OFERTA({ fecha: '2026-06-16' })]);
    fireEvent.changeText(screen.getByPlaceholderText('Buscar por empresa, cargo o lugar…'), '   ');
    expect(screen.getByText('Sin ofertas este día')).toBeTruthy();
  });
  it('sin resultados usa la variante de búsqueda', () => {
    irOfertas([OFERTA()]);
    fireEvent.changeText(screen.getByPlaceholderText('Buscar por empresa, cargo o lugar…'), 'zzz');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(screen.UNSAFE_getByType(require('@/components/ui/EmptyState').EmptyState as any).props.variant).toBe('search');
  });

  it('refrescando si solo mis turnos recarga', () => {
    mockMis = q([], { isRefetching: true });
    montar('trabajador_turnos');
    expect(screen.UNSAFE_getByType(require('react-native').FlatList).props.refreshControl.props.refreshing).toBe(true);
  });

  it('la tira cubre 7 días atrás y 42 adelante', () => {
    const { getDateRange } = require('../../features/turnos/turnosUtils');
    montar('trabajador_turnos');
    expect(mockWeekStrip.days).toHaveLength(getDateRange(7, 42).length);
  });
});

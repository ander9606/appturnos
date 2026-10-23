/**
 * Caracterización de la pantalla de detalle de trabajador ANTES de partirla: congela lo que dibuja y hace
 * según rol, tipo y estado del trabajador (ficha, sueldo, calificar, desactivar/eliminar, edición).
 */
import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError } from '@api-client';
import TrabajadorDetailScreen from '../../app/trabajador/[id]';

// ── Bordes simulados ─────────────────────────────────────────────────────────
const mockRouter = { back: jest.fn() };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockStackOptions: any;
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '7' }),
  useRouter: () => mockRouter,
  Stack: { Screen: (p: { options: unknown }) => { mockStackOptions = p.options; return null; } },
}));
jest.mock('@/components/ui/Spinner', () => {
  const { View } = require('react-native');
  return { Spinner: () => <View testID="spinner" /> };
});
jest.mock('@/lib/theme', () => ({ useTheme: () => ({ primary: '#111111' }) }));
jest.mock('@/components/ui/Avatar', () => {
  const { Text } = require('react-native');
  return { Avatar: (p: { nombre: string; apellido: string }) => <Text testID="avatar">{`${p.nombre}|${p.apellido}`}</Text> };
});

let mockRol: string | undefined;
jest.mock('@/features/auth/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ usuario: { rol: mockRol } }),
}));

const mockShowAlert = jest.fn();
jest.mock('@/lib/alertDialog', () => ({ showAlert: (...a: unknown[]) => mockShowAlert(...a) }));
const mockConfirm = jest.fn();
jest.mock('@/lib/confirmDialog', () => ({ confirm: (...a: unknown[]) => mockConfirm(...a) }));
const mockShowToast = jest.fn();
jest.mock('@/lib/toast', () => ({ showToast: (...a: unknown[]) => mockShowToast(...a) }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mutation = (): any => ({ mutateAsync: jest.fn().mockResolvedValue({}), mutate: jest.fn(), isPending: false });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockQuery: { data: any; isLoading: boolean; isError: boolean; error: unknown; refetch: jest.Mock };
let mockM: Record<string, ReturnType<typeof mutation>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockHistorial: { data: any[] | undefined; isLoading: boolean };
let mockHistorialArgs: unknown[];
jest.mock('@/features/equipo/useEquipo', () => ({
  useTrabajador: () => mockQuery,
  useActualizarTrabajador: () => mockM.actualizar,
  useDesactivarTrabajador: () => mockM.desactivar,
  useEliminarTrabajadorDefinitivo: () => mockM.eliminar,
  useActualizarSalario: () => mockM.salario,
  useHistorialSalario: (...a: unknown[]) => { mockHistorialArgs = a; return mockHistorial; },
}));
jest.mock('@/features/empresas/useTrabajadorEmpresa', () => ({
  useInvitar: () => mockM.invitar,
  useBloquearOfertas: () => mockM.bloquear,
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockAsig: { data: { data: any[] } | undefined };
let mockAsigArgs: unknown[];
jest.mock('@/features/turnos/useTurnos', () => ({
  useAsignacionesTrabajador: (...a: unknown[]) => { mockAsigArgs = a; return mockAsig; },
  useCalificar: () => mockM.calificar,
}));
let mockPuntosArg: unknown;
jest.mock('@/features/turnos/usePuntosMarcaje', () => ({
  usePuntosMarcaje: (e: unknown) => { mockPuntosArg = e; return { data: [{ id: 1 }] }; },
}));
jest.mock('@/features/equipo/MarcacionSelector', () => {
  const { Text } = require('react-native');
  return { MarcacionSelector: (p: { puntos: unknown[] }) => <Text testID="marcacion">{`puntos:${p.puntos.length}`}</Text> };
});
jest.mock('@/features/equipo/CargosCertificadosCard', () => {
  const { Text } = require('react-native');
  return { CargosCertificadosCard: (p: { trabajadorId: number; nombre: string }) => <Text testID="cargos">{`${p.trabajadorId}|${p.nombre}`}</Text> };
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockFormProps: any;
jest.mock('@/features/equipo/TrabajadorForm', () => {
  const { Text } = require('react-native');
  return { TrabajadorForm: (p: unknown) => { mockFormProps = p; return <Text testID="form">FORM</Text>; } };
});

// ── Datos ────────────────────────────────────────────────────────────────────
const TRAB = {
  id: 7, nombre: 'Ana', apellido: 'Pérez', tipo: 'ambos', activo: true, usuario_id: 3,
  cedula: '123456', tipo_documento: 'CC', email: 'ana@x.co', telefono: '3001112222',
  fecha_nacimiento: '1990-05-17T00:00:00.000Z', sexo: 'F', cargo: 'Mesera', descripcion: 'Me gusta servir',
  salario_base: 1750905, tarifa_hora: null, created_at: '2025-03-10T12:00:00.000Z',
  contacto_emergencia_nombre: 'Luis', contacto_emergencia_tel: '3009998888', direccion: 'Calle 1 # 2-3',
  eps: 'Sura', afp: 'Porvenir', banco: 'Bancolombia', tipo_cuenta: 'ahorros', numero_cuenta: '555',
  ant_judiciales_fecha: '2026-01-02T00:00:00.000Z', ant_disciplinarios_fecha: '2026-02-03T00:00:00.000Z',
  hora_entrada_esperada: '08:00:00', total_calificaciones: 3, ranking: '4.5', foto_perfil: null,
};
const ASIGS = [
  { id: 11, estado: 'completado', calificacion: null, oferta_titulo: 'Gala', oferta_fecha: '2026-06-01' },
  { id: 12, estado: 'completado', calificacion: 4, oferta_titulo: 'Feria', oferta_fecha: '2026-06-02' },
  { id: 13, estado: 'no_presentado', calificacion: null, oferta_fecha: '2026-06-03' },
  { id: 14, estado: 'pendiente', calificacion: null, oferta_titulo: 'Oculto' },
];

function montar(rol: string | undefined, t: Record<string, unknown> = {}, opts: { activar?: boolean } = {}) {
  mockRol = rol;
  mockQuery = { data: { ...TRAB, ...t }, isLoading: false, isError: false, error: null, refetch: jest.fn() };
  const r = render(<TrabajadorDetailScreen />);
  return opts.activar === false ? r : r;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStackOptions = undefined;
  mockFormProps = undefined;
  mockM = {
    actualizar: mutation(), invitar: mutation(), desactivar: mutation(), eliminar: mutation(),
    bloquear: mutation(), calificar: mutation(), salario: mutation(),
  };
  mockHistorial = { data: [], isLoading: false };
  mockAsig = { data: { data: ASIGS } };
  mockConfirm.mockResolvedValue(true);
});


describe('estados y acceso', () => {
  it('rol sin acceso: muestra "Sin acceso"', () => {
    montar('trabajador_turnos');
    expect(screen.getByText('Sin acceso')).toBeTruthy();
  });

  it('cargando: skeleton, título "Trabajador" y botón Editar si puede', () => {
    mockRol = 'admin_empresa';
    mockQuery = { data: undefined, isLoading: true, isError: false, error: null, refetch: jest.fn() };
    render(<TrabajadorDetailScreen />);
    expect(mockStackOptions.title).toBe('Trabajador');
    expect(mockStackOptions.headerShown).toBe(true);
    expect(mockStackOptions.headerRight).toBeUndefined();
  });

  it('error: ErrorState con reintentar', () => {
    mockRol = 'admin_empresa';
    const refetch = jest.fn();
    mockQuery = { data: undefined, isLoading: false, isError: true, error: new Error('boom'), refetch };
    render(<TrabajadorDetailScreen />);
    expect(mockStackOptions.title).toBe('Trabajador');
    expect(mockStackOptions.headerRight).toBeUndefined();
    fireEvent.press(screen.getByText('Reintentar'));
    expect(refetch).toHaveBeenCalled();
  });

  it('sin datos y sin error también cae en ErrorState', () => {
    mockRol = 'admin_empresa';
    mockQuery = { data: undefined, isLoading: false, isError: false, error: null, refetch: jest.fn() };
    render(<TrabajadorDetailScreen />);
    expect(screen.getByText('Reintentar')).toBeTruthy();
  });
});

describe('ficha (vista)', () => {
  it('encabezado, hero y filas de información', () => {
    montar('admin_empresa');
    expect(mockStackOptions).toMatchObject({ title: 'Pérez, Ana', headerShown: true, animation: 'slide_from_right' });
    expect(screen.getByTestId('avatar').props.children).toBe('Ana|Pérez');
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    expect(screen.getByText('Mesera')).toBeTruthy();
    expect(screen.getByText('Ambos')).toBeTruthy();
    expect(screen.queryByText('Inactivo')).toBeNull();
    expect(screen.getByText('Sobre mí')).toBeTruthy();
    expect(screen.getByText('Me gusta servir')).toBeTruthy();
    expect(screen.getByText('123456')).toBeTruthy();
    expect(screen.getByText('Cédula (CC)')).toBeTruthy();
    expect(screen.getByText('ana@x.co')).toBeTruthy();
    expect(screen.getByText('3001112222')).toBeTruthy();
    expect(screen.getByText('17 de mayo de 1990')).toBeTruthy();
    expect(screen.getByText('Femenino')).toBeTruthy();
    expect(screen.getByText('10 de marzo de 2025')).toBeTruthy();
    expect(screen.getByText('Calle 1 # 2-3')).toBeTruthy();
    expect(screen.getByText('Luis')).toBeTruthy();
  });

  it('etiquetas de sexo/documento/tipo desconocidos o alternos', () => {
    montar('admin_empresa', { sexo: 'M', tipo_documento: 'CE', tipo: 'nomina' });
    expect(screen.getByText('Masculino')).toBeTruthy();
    expect(screen.getByText('Cédula Ext. (CE)')).toBeTruthy();
    expect(screen.getByText('Nómina')).toBeTruthy();
  });

  it('PAS / otro / turnos', () => {
    montar('admin_empresa', { sexo: 'otro', tipo_documento: 'PAS', tipo: 'turnos' });
    expect(screen.getByText('Pasaporte')).toBeTruthy();
    expect(screen.getByText('Otro')).toBeTruthy();
    expect(screen.getByText('Turnos')).toBeTruthy();
  });

  it('sin cargo/descripcion/contacto/dirección no dibuja esas partes', () => {
    montar('admin_empresa', {
      cargo: null, descripcion: null, contacto_emergencia_nombre: null, contacto_emergencia_tel: null,
      direccion: '', cedula: null, tipo_documento: null, email: null, telefono: null, fecha_nacimiento: null, sexo: null,
    });
    expect(screen.queryByText('Sobre mí')).toBeNull();
    expect(screen.queryByText('Contacto de emergencia')).toBeNull();
    expect(screen.queryByText('Dirección')).toBeNull();
    expect(screen.queryByText('Cédula')).toBeNull();
    expect(screen.queryByText('Tipo de documento')).toBeNull();
    expect(screen.queryByText('Correo')).toBeNull();
    expect(screen.queryByText('Teléfono')).toBeNull();
    expect(screen.queryByText('Fecha de nacimiento')).toBeNull();
    expect(screen.queryByText('Sexo')).toBeNull();
  });

  it('inactivo: chip "Inactivo"', () => {
    montar('admin_empresa', { activo: false });
    expect(screen.getByText('Inactivo')).toBeTruthy();
  });

  it('solo contacto de emergencia con teléfono o solo nombre', () => {
    montar('admin_empresa', { contacto_emergencia_nombre: null });
    expect(screen.getByText('3009998888')).toBeTruthy();
    expect(screen.queryByText('Contacto de emergencia')).toBeNull();
  });

  it('llamar abre el marcador con el teléfono (propio y de emergencia)', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    montar('admin_empresa');
    fireEvent.press(screen.getByLabelText('Llamar a Teléfono'));
    expect(open).toHaveBeenCalledWith('tel:3001112222');
    fireEvent.press(screen.getByLabelText('Llamar a Teléfono de emergencia'));
    expect(open).toHaveBeenCalledWith('tel:3009998888');
  });

  it('sin teléfono no hay botón de llamar', () => {
    montar('admin_empresa', { telefono: null, contacto_emergencia_tel: null });
    expect(screen.queryByLabelText(/Llamar a/)).toBeNull();
  });

  it('banner "Cuenta sin activar" solo admin y sin usuario: con y sin cédula', () => {
    montar('admin_empresa', { usuario_id: null });
    expect(screen.getByText('Cuenta sin activar')).toBeTruthy();
    expect(screen.getByText('Pídele que descargue la app y use "Activar cuenta" con la cédula 123456.')).toBeTruthy();
  });

  it('banner sin cédula', () => {
    montar('admin_empresa', { usuario_id: null, cedula: null });
    expect(screen.getByText('Pídele que descargue la app y use "Activar cuenta" con su número de cédula.')).toBeTruthy();
  });

  it('banner no aparece para otros roles ni con usuario', () => {
    montar('jefe_nomina', { usuario_id: null });
    expect(screen.queryByText('Cuenta sin activar')).toBeNull();
  });
});

describe('salario (etiqueta)', () => {
  it('turnos', () => {
    montar('admin_empresa', { tipo: 'turnos' });
    expect(screen.getByText('Por turno aceptado')).toBeTruthy();
  });
  it('salario base mensual', () => {
    montar('admin_empresa');
    expect(screen.getByText(`$${Number(1750905).toLocaleString('es-CO')} / mes`)).toBeTruthy();
  });
  it('tarifa por hora', () => {
    montar('admin_empresa', { salario_base: null, tarifa_hora: 9000 });
    expect(screen.getByText(`$${Number(9000).toLocaleString('es-CO')} / hora`)).toBeTruthy();
  });
  it('sin configurar', () => {
    montar('admin_empresa', { salario_base: null, tarifa_hora: null });
    expect(screen.getByText('Sin configurar')).toBeTruthy();
  });
});

describe('bloque seguridad social / marcación / ranking / cargos', () => {
  it('nómina/ambos muestra EPS, AFP, banco, cuenta y antecedentes', () => {
    montar('admin_empresa');
    expect(screen.getByText('Sura')).toBeTruthy();
    expect(screen.getByText('Porvenir')).toBeTruthy();
    expect(screen.getByText('Bancolombia')).toBeTruthy();
    expect(screen.getByText('Ahorros')).toBeTruthy();
    expect(screen.getByText('555')).toBeTruthy();
    expect(screen.getByText('2 de enero de 2026')).toBeTruthy();
    expect(screen.getByText('3 de febrero de 2026')).toBeTruthy();
  });
  it('tipo cuenta corriente', () => {
    montar('admin_empresa', { tipo_cuenta: 'corriente' });
    expect(screen.getByText('Corriente')).toBeTruthy();
  });
  it('tipo turnos no muestra ese bloque', () => {
    montar('admin_empresa', { tipo: 'turnos' });
    expect(screen.queryByText('EPS')).toBeNull();
    expect(screen.queryByText('Banco')).toBeNull();
  });
  it('sin ninguno de esos datos no dibuja el bloque', () => {
    montar('admin_empresa', {
      eps: null, afp: null, banco: null, numero_cuenta: null, ant_judiciales_fecha: null, ant_disciplinarios_fecha: null,
    });
    expect(screen.queryByText('EPS')).toBeNull();
  });
  it('basta un solo dato para mostrarlo (solo antecedentes disciplinarios)', () => {
    montar('admin_empresa', {
      eps: null, afp: null, banco: null, numero_cuenta: null, ant_judiciales_fecha: null,
    });
    expect(screen.getByText('Antecedentes disciplinarios')).toBeTruthy();
  });
  it.each([
    ['eps', 'EPS'], ['afp', 'AFP'], ['banco', 'Banco'], ['numero_cuenta', 'Número de cuenta'],
    ['ant_judiciales_fecha', 'Antecedentes judiciales'],
  ])('basta %s para dibujar el bloque', (campo, etiqueta) => {
    const base = { eps: null, afp: null, banco: null, numero_cuenta: null, ant_judiciales_fecha: null, ant_disciplinarios_fecha: null };
    montar('admin_empresa', { ...base, [campo]: (TRAB as Record<string, unknown>)[campo] });
    expect(screen.getByText(etiqueta)).toBeTruthy();
  });

  it('marcación solo admin y no turnos; puntos solo se piden a admin no turnos', () => {
    montar('admin_empresa');
    expect(screen.getByText('Marcación')).toBeTruthy();
    expect(screen.getByTestId('marcacion').props.children).toBe('puntos:1');
    expect(mockPuntosArg).toBe(true);
  });
  it('marcación oculta para turnos y para no admin', () => {
    montar('admin_empresa', { tipo: 'turnos' });
    expect(screen.queryByText('Marcación')).toBeNull();
    expect(mockPuntosArg).toBe(false);
  });
  it('marcación oculta para jefe_nomina', () => {
    montar('jefe_nomina');
    expect(screen.queryByText('Marcación')).toBeNull();
    expect(mockPuntosArg).toBe(false);
  });

  it('ranking con calificaciones: plural y singular', () => {
    montar('admin_empresa');
    expect(screen.getByText('(3 turnos)')).toBeTruthy();
  });
  it('ranking singular', () => {
    montar('admin_empresa', { total_calificaciones: 1 });
    expect(screen.getByText('(1 turno)')).toBeTruthy();
  });
  it('sin calificaciones', () => {
    montar('admin_empresa', { total_calificaciones: 0 });
    expect(screen.getByText('Sin calificaciones aún')).toBeTruthy();
  });

  it('cargos certificados: admin/jefe_turnos con cuenta activada', () => {
    montar('jefe_turnos');
    expect(screen.getByTestId('cargos').props.children).toBe('7|Ana');
  });
  it('cargos ocultos sin usuario_id o para jefe_nomina', () => {
    montar('jefe_turnos', { usuario_id: null });
    expect(screen.queryByTestId('cargos')).toBeNull();
  });
  it('cargos ocultos para jefe_nomina', () => {
    montar('jefe_nomina');
    expect(screen.queryByTestId('cargos')).toBeNull();
  });
});

describe('encabezado Editar', () => {
  it('admin con trabajador activo ve Editar; inactivo no', () => {
    montar('admin_empresa');
    expect(mockStackOptions.headerRight).toBeDefined();
  });
  it('inactivo: sin Editar', () => {
    montar('admin_empresa', { activo: false });
    expect(mockStackOptions.headerRight).toBeUndefined();
  });
  it('jefe_nomina puede editar; jefe_turnos y nomina no', () => {
    montar('jefe_nomina');
    expect(mockStackOptions.headerRight).toBeDefined();
  });
  it('jefe_turnos no edita', () => {
    montar('jefe_turnos');
    expect(mockStackOptions.headerRight).toBeUndefined();
  });
  it('nomina no edita', () => {
    montar('nomina');
    expect(mockStackOptions.headerRight).toBeUndefined();
  });
});

describe('sueldo', () => {
  it('admin ve "Editar sueldo" y abre el modal con valores actuales', () => {
    montar('admin_empresa', { tarifa_hora: 9000 });
    fireEvent.press(screen.getByText('Editar sueldo'));
    expect(screen.getByDisplayValue('9000')).toBeTruthy();
    expect(screen.getByDisplayValue('1750905')).toBeTruthy();
    expect(screen.getByText('Tarifa por hora (COP)')).toBeTruthy();
    expect(screen.getByText('Salario base mensual (COP)')).toBeTruthy();
  });
  it('modal sin valores previos empieza vacío', () => {
    montar('admin_empresa', { tarifa_hora: null, salario_base: null });
    fireEvent.press(screen.getByText('Editar sueldo'));
    expect(screen.getByText('Tarifa por hora (COP)')).toBeTruthy();
    expect(screen.queryByDisplayValue('9000')).toBeNull();
  });
  it('jefe_nomina solo para nómina/ambos; turnos no', () => {
    montar('jefe_nomina', { tipo: 'turnos' });
    expect(screen.queryByText('Editar sueldo')).toBeNull();
  });
  it('jefe_nomina con nómina sí', () => {
    montar('jefe_nomina', { tipo: 'nomina' });
    expect(screen.getByText('Editar sueldo')).toBeTruthy();
  });
  it('jefe_turnos y nomina no', () => {
    montar('jefe_turnos');
    expect(screen.queryByText('Editar sueldo')).toBeNull();
  });
  it('inactivo no muestra Editar sueldo', () => {
    montar('admin_empresa', { activo: false });
    expect(screen.queryByText('Editar sueldo')).toBeNull();
  });

  async function guardar(tarifa: string, salario: string) {
    montar('admin_empresa', { tarifa_hora: null, salario_base: null });
    fireEvent.press(screen.getByText('Editar sueldo'));
    const inputs = screen.UNSAFE_getAllByType(require('react-native').TextInput);
    fireEvent.changeText(inputs[0], tarifa);
    fireEvent.changeText(inputs[1], salario);
    await act(async () => { fireEvent.press(screen.getByText('Guardar')); });
  }

  it('guarda números (coma decimal) y cierra con toast', async () => {
    await guardar('9000,5', '1800000');
    expect(mockM.salario.mutateAsync).toHaveBeenCalledWith({ tarifa_hora: 9000.5, salario_base: 1800000 });
    expect(mockShowToast).toHaveBeenCalledWith('Sueldo actualizado.');
    expect(screen.queryByText('Deja vacío para quitar el valor. Los períodos de nómina ya cerrados no cambian.')).toBeNull();
  });
  it('vacío = null', async () => {
    await guardar('', '  ');
    expect(mockM.salario.mutateAsync).toHaveBeenCalledWith({ tarifa_hora: null, salario_base: null });
  });
  it('cero es válido', async () => {
    await guardar('0', '0');
    expect(mockM.salario.mutateAsync).toHaveBeenCalledWith({ tarifa_hora: 0, salario_base: 0 });
  });
  it('negativo o no numérico: error y no llama', async () => {
    await guardar('-1', '100');
    expect(screen.getByText('Ingresa valores numéricos mayores o iguales a 0.')).toBeTruthy();
    expect(mockM.salario.mutateAsync).not.toHaveBeenCalled();
  });
  it('texto: error', async () => {
    await guardar('abc', '');
    expect(screen.getByText('Ingresa valores numéricos mayores o iguales a 0.')).toBeTruthy();
  });
  it('salario inválido: error', async () => {
    await guardar('5', 'x');
    expect(mockM.salario.mutateAsync).not.toHaveBeenCalled();
  });
  it('error de API muestra su mensaje', async () => {
    mockRol = 'admin_empresa';
    montar('admin_empresa');
    mockM.salario.mutateAsync.mockRejectedValueOnce(new ApiError('Sin permiso', undefined, 403));
    fireEvent.press(screen.getByText('Editar sueldo'));
    await act(async () => { fireEvent.press(screen.getByText('Guardar')); });
    expect(screen.getByText('Sin permiso')).toBeTruthy();
    expect(mockShowToast).not.toHaveBeenCalled();
  });
  it('error genérico', async () => {
    montar('admin_empresa');
    mockM.salario.mutateAsync.mockRejectedValueOnce(new Error('x'));
    fireEvent.press(screen.getByText('Editar sueldo'));
    await act(async () => { fireEvent.press(screen.getByText('Guardar')); });
    expect(screen.getByText('No se pudo guardar el sueldo.')).toBeTruthy();
  });
  it('Cancelar cierra el modal', () => {
    montar('admin_empresa');
    fireEvent.press(screen.getByText('Editar sueldo'));
    expect(screen.getByText('Cancelar')).toBeTruthy();
    fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByText('Cancelar')).toBeNull();
  });
  it('abrir limpia el error previo', async () => {
    await guardar('-1', '1');
    fireEvent.press(screen.getByText('Cancelar'));
    fireEvent.press(screen.getByText('Editar sueldo'));
    expect(screen.queryByText('Ingresa valores numéricos mayores o iguales a 0.')).toBeNull();
  });
});

describe('historial de sueldo', () => {
  it('visible para admin y jefe_nomina con args correctos', () => {
    montar('admin_empresa');
    expect(mockHistorialArgs).toEqual([7, true]);
    expect(screen.getByText('Historial de sueldo')).toBeTruthy();
    expect(screen.getByText('Sin cambios registrados.')).toBeTruthy();
  });
  it('oculto y deshabilitado para jefe_turnos', () => {
    montar('jefe_turnos');
    expect(mockHistorialArgs).toEqual([7, false]);
    expect(screen.queryByText('Historial de sueldo')).toBeNull();
  });
  it('cargando: spinner', () => {
    mockHistorial = { data: undefined, isLoading: true };
    montar('admin_empresa');
    expect(screen.getByTestId('spinner')).toBeTruthy();
  });
  it('sin datos (undefined) tras cargar: "Sin cambios registrados."', () => {
    mockHistorial = { data: undefined, isLoading: false };
    montar('admin_empresa');
    expect(screen.getByText('Sin cambios registrados.')).toBeTruthy();
  });
  it('lista cambios con auditoría y "—" para nulos', () => {
    mockHistorial = {
      isLoading: false,
      data: [{
        id: 1, created_at: '2026-03-04T15:30:00.000Z', usuario_nombre: 'Rosa', usuario_rol: 'admin_empresa',
        tarifa_hora_anterior: null, tarifa_hora_nueva: 9000, salario_base_anterior: 1000000, salario_base_nueva: null,
      }],
    };
    montar('jefe_nomina');
    expect(screen.getByText(/Rosa \(admin_empresa\)/)).toBeTruthy();
    expect(screen.getByText(/Tarifa\/h: — → /)).toBeTruthy();
    expect(screen.getByText(/Salario: .* → —/)).toBeTruthy();
    expect(screen.getByText(/Rosa/).props.children.join('')).toMatch(/2026/);
  });
});

describe('turnos recientes y calificar', () => {
  it('pide asignaciones solo a roles que califican; filtra completado/no_presentado', () => {
    montar('admin_empresa');
    expect(mockAsigArgs).toEqual([7, { limit: 10 }]);
    expect(screen.getByText('Turnos recientes')).toBeTruthy();
    expect(screen.getByText('Gala')).toBeTruthy();
    expect(screen.getByText('Feria')).toBeTruthy();
    expect(screen.getByText('Turno #13')).toBeTruthy();
    expect(screen.getByText(/No presentado/)).toBeTruthy();
    expect(screen.queryByText('Oculto')).toBeNull();
  });
  it('máximo 5 filas', () => {
    mockAsig = { data: { data: Array.from({ length: 8 }, (_, i) => ({ id: 100 + i, estado: 'completado', calificacion: 3, oferta_titulo: `T${i}` })) } };
    montar('admin_empresa');
    expect(screen.getByText('T4')).toBeTruthy();
    expect(screen.queryByText('T5')).toBeNull();
  });
  it('roles que no ven turnos: no se piden (null) ni se muestran', () => {
    montar('jefe_nomina');
    expect(mockAsigArgs[0]).toBeNull();
    expect(screen.queryByText('Turnos recientes')).toBeNull();
  });
  it('sin turnos terminados no dibuja la sección', () => {
    mockAsig = { data: undefined };
    montar('admin_empresa');
    expect(screen.queryByText('Turnos recientes')).toBeNull();
  });
  it('turno completado ya calificado no ofrece Calificar', () => {
    montar('admin_empresa');
    expect(screen.getAllByText('Calificar ★')).toHaveLength(1);
  });
  it('jefe_turnos también califica', () => {
    montar('jefe_turnos');
    expect(screen.getAllByText('Calificar ★')).toHaveLength(1);
  });

  it('abre, alterna a Cancelar y cierra el formulario', () => {
    montar('admin_empresa');
    fireEvent.press(screen.getByText('Calificar ★'));
    expect(screen.getByText('CALIFICACIÓN')).toBeTruthy();
    expect(screen.getByText('Confirmar calificación')).toBeTruthy();
    fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByText('CALIFICACIÓN')).toBeNull();
    expect(screen.getByText('Calificar ★')).toBeTruthy();
  });

  it('confirma con 5 estrellas por defecto y comentario recortado', async () => {
    montar('admin_empresa');
    fireEvent.press(screen.getByText('Calificar ★'));
    fireEvent.changeText(screen.getByPlaceholderText('Comentario opcional…'), '  Excelente  ');
    await act(async () => { fireEvent.press(screen.getByText('Confirmar calificación')); });
    expect(mockM.calificar.mutateAsync).toHaveBeenCalledWith({ id: 11, calificacion: 5, comentario: 'Excelente' });
    expect(mockShowToast).toHaveBeenCalledWith('Turno calificado con 5/5 estrellas.');
    expect(screen.queryByText('CALIFICACIÓN')).toBeNull();
  });
  it('sin comentario manda undefined', async () => {
    montar('admin_empresa');
    fireEvent.press(screen.getByText('Calificar ★'));
    fireEvent.changeText(screen.getByPlaceholderText('Comentario opcional…'), '   ');
    await act(async () => { fireEvent.press(screen.getByText('Confirmar calificación')); });
    expect(mockM.calificar.mutateAsync).toHaveBeenCalledWith({ id: 11, calificacion: 5, comentario: undefined });
  });
  it('error: alerta con el mensaje y deja el formulario abierto', async () => {
    montar('admin_empresa');
    mockM.calificar.mutateAsync.mockRejectedValueOnce({ message: 'Ya calificado' });
    fireEvent.press(screen.getByText('Calificar ★'));
    await act(async () => { fireEvent.press(screen.getByText('Confirmar calificación')); });
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Ya calificado');
    expect(screen.getByText('CALIFICACIÓN')).toBeTruthy();
  });
  it('error sin mensaje: texto por defecto', async () => {
    montar('admin_empresa');
    mockM.calificar.mutateAsync.mockRejectedValueOnce('x');
    fireEvent.press(screen.getByText('Calificar ★'));
    await act(async () => { fireEvent.press(screen.getByText('Confirmar calificación')); });
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'No se pudo guardar la calificación.');
  });
  it('pendiente: spinner en vez de la etiqueta', () => {
    montar('admin_empresa');
    fireEvent.press(screen.getByText('Calificar ★'));
    mockM.calificar.isPending = true;
    screen.rerender(<TrabajadorDetailScreen />);
    expect(screen.getByTestId('spinner')).toBeTruthy();
    expect(screen.queryByText('Confirmar calificación')).toBeNull();
  });
  it('reabrir resetea comentario y estrellas', () => {
    montar('admin_empresa');
    fireEvent.press(screen.getByText('Calificar ★'));
    fireEvent.changeText(screen.getByPlaceholderText('Comentario opcional…'), 'algo');
    fireEvent.press(screen.getByText('Cancelar'));
    fireEvent.press(screen.getByText('Calificar ★'));
    expect(screen.getByPlaceholderText('Comentario opcional…').props.value).toBe('');
  });
});

describe('botones de acción', () => {
  it('"Dejar de ofrecerle turnos": turnos/ambos activos para admin y jefe_turnos', () => {
    montar('jefe_turnos');
    expect(screen.getByText('Dejar de ofrecerle turnos')).toBeTruthy();
  });
  it('oculto para nómina, inactivos y jefe_nomina', () => {
    montar('admin_empresa', { tipo: 'nomina' });
    expect(screen.queryByText('Dejar de ofrecerle turnos')).toBeNull();
  });
  it('oculto inactivo', () => {
    montar('admin_empresa', { activo: false });
    expect(screen.queryByText('Dejar de ofrecerle turnos')).toBeNull();
  });
  it('oculto jefe_nomina', () => {
    montar('jefe_nomina');
    expect(screen.queryByText('Dejar de ofrecerle turnos')).toBeNull();
  });
  it('tipo turnos lo muestra', () => {
    montar('admin_empresa', { tipo: 'turnos' });
    expect(screen.getByText('Dejar de ofrecerle turnos')).toBeTruthy();
  });

  it('confirmar bloquear: llama mutate con el id y reporta éxito', async () => {
    montar('admin_empresa');
    await act(async () => { fireEvent.press(screen.getByText('Dejar de ofrecerle turnos')); });
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: '¿Dejar de ofrecerle turnos?', confirmLabel: 'Dejar de ofrecerle turnos', destructive: true,
      message: expect.stringContaining('Ana Pérez ya no verá ofertas tuyas'),
    }));
    const [id, cbs] = mockM.bloquear.mutate.mock.calls[0];
    expect(id).toBe(7);
    cbs.onSuccess();
    expect(mockShowToast).toHaveBeenCalledWith('Ya no se le ofrecerán turnos.');
    cbs.onError(new ApiError('No', undefined, 400));
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'No');
    cbs.onError(new Error('z'));
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'No se pudo completar la acción');
  });
  it('cancelar la confirmación no hace nada', async () => {
    mockConfirm.mockResolvedValue(false);
    montar('admin_empresa');
    await act(async () => { fireEvent.press(screen.getByText('Dejar de ofrecerle turnos')); });
    expect(mockM.bloquear.mutate).not.toHaveBeenCalled();
  });
  it('bloquear pendiente: spinner', () => {
    mockM.bloquear.isPending = true;
    montar('admin_empresa');
    expect(screen.queryByText('Dejar de ofrecerle turnos')).toBeNull();
    expect(screen.getAllByTestId('spinner').length).toBeGreaterThan(0);
  });

  it('desactivar solo admin activo', () => {
    montar('admin_empresa');
    expect(screen.getByText('Desactivar trabajador')).toBeTruthy();
    expect(screen.queryByText('Eliminar trabajador')).toBeNull();
  });
  it('desactivar oculto para jefes', () => {
    montar('jefe_turnos');
    expect(screen.queryByText('Desactivar trabajador')).toBeNull();
  });
  it('confirmar desactivar: mutate, back en éxito, alerta en error', async () => {
    montar('admin_empresa');
    await act(async () => { fireEvent.press(screen.getByText('Desactivar trabajador')); });
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: '¿Desactivar trabajador?', confirmLabel: 'Desactivar', destructive: true,
      message: 'Ana Pérez no podrá iniciar sesión ni recibir turnos.',
    }));
    const [id, cbs] = mockM.desactivar.mutate.mock.calls[0];
    expect(id).toBe(7);
    cbs.onSuccess();
    expect(mockRouter.back).toHaveBeenCalled();
    cbs.onError();
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'No se pudo desactivar. Intenta de nuevo.');
  });
  it('desactivar cancelado', async () => {
    mockConfirm.mockResolvedValue(false);
    montar('admin_empresa');
    await act(async () => { fireEvent.press(screen.getByText('Desactivar trabajador')); });
    expect(mockM.desactivar.mutate).not.toHaveBeenCalled();
  });

  it('eliminar solo admin e inactivo', () => {
    montar('admin_empresa', { activo: false });
    expect(screen.getByText('Eliminar trabajador')).toBeTruthy();
    expect(screen.queryByText('Desactivar trabajador')).toBeNull();
  });
  it('eliminar oculto para jefes', () => {
    montar('jefe_turnos', { activo: false });
    expect(screen.queryByText('Eliminar trabajador')).toBeNull();
  });
  it('confirmar eliminar: mutate, back, error con mensaje y genérico', async () => {
    montar('admin_empresa', { activo: false });
    await act(async () => { fireEvent.press(screen.getByText('Eliminar trabajador')); });
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: '¿Eliminar trabajador?', confirmLabel: 'Eliminar', destructive: true,
      message: 'Esto borra a Ana Pérez para siempre. No se puede deshacer. Si tiene turnos, nómina o calificaciones registradas, no se podrá eliminar.',
    }));
    const [id, cbs] = mockM.eliminar.mutate.mock.calls[0];
    expect(id).toBe(7);
    cbs.onSuccess();
    expect(mockRouter.back).toHaveBeenCalled();
    cbs.onError(new ApiError('Tiene turnos', undefined, 409));
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Tiene turnos');
    cbs.onError(new Error('q'));
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'No se pudo eliminar. Intenta de nuevo.');
  });
  it('eliminar cancelado', async () => {
    mockConfirm.mockResolvedValue(false);
    montar('admin_empresa', { activo: false });
    await act(async () => { fireEvent.press(screen.getByText('Eliminar trabajador')); });
    expect(mockM.eliminar.mutate).not.toHaveBeenCalled();
  });
  it('eliminar pendiente: texto "Eliminando…"', () => {
    mockM.eliminar.isPending = true;
    montar('admin_empresa', { activo: false });
    expect(screen.getByText('Eliminando…')).toBeTruthy();
  });
});

describe('modo edición', () => {
  const abrirEdicion = () => {
    const Right = mockStackOptions.headerRight;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el: any = Right();
    return el;
  };
  async function editar() {
    const el = abrirEdicion();
    await act(async () => { el.props.onPress(); });
  }

  it('Editar abre el formulario con valores por defecto normalizados', async () => {
    montar('admin_empresa');
    expect(abrirEdicion().props.children.props.children).toBe('Editar');
    await editar();
    expect(screen.getByTestId('form')).toBeTruthy();
    expect(mockStackOptions.title).toBe('Editar trabajador');
    expect(mockFormProps.submitLabel).toBe('Guardar cambios');
    expect(mockFormProps.submittingLabel).toBe('Guardando…');
    expect(mockFormProps.soloCampos).toBeUndefined();
    expect(mockFormProps.defaultValues).toEqual({
      nombre: 'Ana', apellido: 'Pérez', tipo: 'ambos', cedula: '123456', tipo_documento: 'CC',
      fecha_nacimiento: '1990-05-17', sexo: 'F', email: 'ana@x.co', telefono: '3001112222', direccion: 'Calle 1 # 2-3',
      contacto_emergencia_nombre: 'Luis', contacto_emergencia_tel: '3009998888', cargo: 'Mesera',
      tarifa_hora: undefined, salario_base: 1750905, hora_entrada_esperada: '08:00', eps: 'Sura', afp: 'Porvenir',
      banco: 'Bancolombia', tipo_cuenta: 'ahorros', numero_cuenta: '555',
      ant_judiciales_fecha: '2026-01-02', ant_disciplinarios_fecha: '2026-02-03',
    });
  });
  it('defaults con campos nulos → cadenas vacías', async () => {
    montar('admin_empresa', {
      cedula: null, tipo_documento: null, fecha_nacimiento: null, sexo: null, email: null, telefono: null, direccion: null,
      contacto_emergencia_nombre: null, contacto_emergencia_tel: null, cargo: null, tarifa_hora: 8000, salario_base: null,
      hora_entrada_esperada: null, eps: null, afp: null, banco: null, tipo_cuenta: null, numero_cuenta: null,
      ant_judiciales_fecha: null, ant_disciplinarios_fecha: null,
    });
    await editar();
    expect(mockFormProps.defaultValues).toMatchObject({
      cedula: '', tipo_documento: '', fecha_nacimiento: '', sexo: '', email: '', telefono: '', direccion: '', cargo: '',
      tarifa_hora: 8000, salario_base: undefined, hora_entrada_esperada: '', eps: '', banco: '', tipo_cuenta: '',
      numero_cuenta: '', ant_judiciales_fecha: '', ant_disciplinarios_fecha: '',
    });
  });
  it('jefe_nomina: soloCampos según tipo', async () => {
    montar('jefe_nomina');
    await editar();
    expect(mockFormProps.soloCampos).toContain('salario_base');
    expect(mockFormProps.soloCampos).not.toContain('banco');
    expect(mockFormProps.soloCampos).toHaveLength(20);
  });
  it('jefe_nomina con tipo turnos: solo 5 campos', async () => {
    montar('jefe_nomina', { tipo: 'turnos' });
    await editar();
    expect(mockFormProps.soloCampos).toEqual(['nombre', 'apellido', 'telefono', 'email', 'cargo']);
  });

  it('Cancelar sin cambios vuelve a la ficha', async () => {
    montar('admin_empresa');
    await editar();
    expect(mockStackOptions.headerRight().props.children.props.children).toBe('Cancelar');
    await act(async () => { mockStackOptions.headerRight().props.onPress(); });
    expect(screen.queryByTestId('form')).toBeNull();
  });
  it('Cancelar con cambios pide confirmar; si no descarta se queda', async () => {
    montar('admin_empresa');
    await editar();
    act(() => mockFormProps.onDirtyChange(true));
    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => { mockStackOptions.headerRight().props.onPress(); });
    expect(mockConfirm).toHaveBeenCalledWith({
      title: '¿Descartar cambios?', message: 'Vas a perder lo que editaste en este formulario.',
      cancelLabel: 'Seguir editando', confirmLabel: 'Descartar', destructive: true,
    });
    expect(screen.getByTestId('form')).toBeTruthy();
  });
  it('Cancelar con cambios y descartar vuelve a la ficha y limpia dirty', async () => {
    montar('admin_empresa');
    await editar();
    act(() => mockFormProps.onDirtyChange(true));
    await act(async () => { mockStackOptions.headerRight().props.onPress(); });
    expect(screen.queryByTestId('form')).toBeNull();
    await editar();
    // dirty se limpió: cancelar ahora no pregunta
    mockConfirm.mockClear();
    await act(async () => { mockStackOptions.headerRight().props.onPress(); });
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  const datos = (extra: Record<string, unknown> = {}) => ({
    nombre: 'Ana', apellido: 'Pérez', tipo: 'ambos', cedula: '123456', tipo_documento: 'CC', fecha_nacimiento: '',
    sexo: '', email: '', telefono: '', direccion: '', contacto_emergencia_nombre: '', contacto_emergencia_tel: '',
    cargo: '', tarifa_hora: undefined, salario_base: 100, hora_entrada_esperada: '', eps: '', afp: '', banco: '',
    tipo_cuenta: '', numero_cuenta: '', ant_judiciales_fecha: '', ant_disciplinarios_fecha: '', ...extra,
  });

  it('guardar admin: payload completo (vacíos → undefined), sale de edición y toast', async () => {
    montar('admin_empresa');
    await editar();
    await act(async () => { await mockFormProps.onSubmit(datos({ email: 'a@b.co', sexo: 'F' })); });
    expect(mockM.actualizar.mutateAsync).toHaveBeenCalledWith({
      nombre: 'Ana', apellido: 'Pérez', tipo: 'ambos', cedula: '123456', tipo_documento: 'CC', fecha_nacimiento: undefined,
      sexo: 'F', email: 'a@b.co', telefono: undefined, direccion: undefined, contacto_emergencia_nombre: undefined,
      contacto_emergencia_tel: undefined, cargo: undefined, tarifa_hora: undefined, salario_base: 100,
      hora_entrada_esperada: undefined, eps: undefined, afp: undefined, banco: undefined, tipo_cuenta: undefined,
      numero_cuenta: undefined, ant_judiciales_fecha: undefined, ant_disciplinarios_fecha: undefined,
    });
    expect(mockShowToast).toHaveBeenCalledWith('Los datos del trabajador fueron actualizados.');
    expect(screen.queryByTestId('form')).toBeNull();
    expect(mockM.invitar.mutateAsync).not.toHaveBeenCalled();
  });
  it('guardar jefe_nomina filtra campos (sin banco ni tipo)', async () => {
    montar('jefe_nomina');
    await editar();
    await act(async () => { await mockFormProps.onSubmit(datos({ banco: 'X', eps: 'Y' })); });
    const enviado = mockM.actualizar.mutateAsync.mock.calls[0][0];
    expect(enviado).not.toHaveProperty('banco');
    expect(enviado).not.toHaveProperty('tipo');
    expect(enviado).toHaveProperty('eps', 'Y');
    expect(enviado).toHaveProperty('salario_base', 100);
  });
  it('guardar jefe_nomina de tipo turnos solo manda 5 campos', async () => {
    montar('jefe_nomina', { tipo: 'turnos' });
    await editar();
    await act(async () => { await mockFormProps.onSubmit(datos({ tipo: 'turnos', email: 'a@b.co', cargo: 'C', telefono: '1' })); });
    expect(Object.keys(mockM.actualizar.mutateAsync.mock.calls[0][0]).sort()).toEqual(['apellido', 'cargo', 'email', 'nombre', 'telefono']);
  });
  it('error al guardar con mensaje', async () => {
    montar('admin_empresa');
    await editar();
    mockM.actualizar.mutateAsync.mockRejectedValueOnce(new Error('Cédula duplicada'));
    await act(async () => { await mockFormProps.onSubmit(datos()); });
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Cédula duplicada');
    expect(screen.getByTestId('form')).toBeTruthy();
  });
  it('error al guardar sin mensaje', async () => {
    montar('admin_empresa');
    await editar();
    mockM.actualizar.mutateAsync.mockRejectedValueOnce('boom');
    await act(async () => { await mockFormProps.onSubmit(datos()); });
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Ocurrió un error al guardar.');
  });

  describe('pasar a nómina', () => {
    it('sin cédula: avisa y no guarda', async () => {
      montar('admin_empresa', { tipo: 'turnos' });
      await editar();
      await act(async () => { await mockFormProps.onSubmit(datos({ tipo: 'nomina', cedula: '' })); });
      expect(mockShowAlert).toHaveBeenCalledWith(
        'Falta la cédula',
        'Este trabajador no tiene cédula registrada. Agrégala y guarda antes de invitarlo a nómina.',
        'warning',
      );
      expect(mockM.actualizar.mutateAsync).not.toHaveBeenCalled();
    });
    it('rechazar la confirmación no guarda', async () => {
      mockConfirm.mockResolvedValue(false);
      montar('admin_empresa', { tipo: 'turnos' });
      await editar();
      await act(async () => { await mockFormProps.onSubmit(datos({ tipo: 'nomina' })); });
      expect(mockM.actualizar.mutateAsync).not.toHaveBeenCalled();
      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Enviar solicitud de nómina', confirmLabel: 'Enviar solicitud',
        message: expect.stringContaining('Nómina implica exclusividad: si Ana acepta'),
      }));
    });
    it('guarda con el tipo anterior y DESPUÉS invita', async () => {
      const orden: string[] = [];
      montar('admin_empresa', { tipo: 'turnos' });
      mockM.actualizar.mutateAsync.mockImplementation(async () => { orden.push('guardar'); });
      mockM.invitar.mutateAsync.mockImplementation(async () => { orden.push('invitar'); });
      await editar();
      await act(async () => { await mockFormProps.onSubmit(datos({ tipo: 'nomina' })); });
      expect(orden).toEqual(['guardar', 'invitar']);
      expect(mockM.actualizar.mutateAsync.mock.calls[0][0].tipo).toBe('turnos');
      expect(mockM.invitar.mutateAsync).toHaveBeenCalledWith({ cedula: '123456', tipo: 'nomina' });
      expect(mockShowToast).toHaveBeenCalledWith('Solicitud de nómina enviada. El trabajador debe aceptarla desde su cuenta.');
    });
    it('si la invitación falla: alerta y toast normal', async () => {
      montar('admin_empresa', { tipo: 'turnos' });
      mockM.invitar.mutateAsync.mockRejectedValueOnce(new ApiError('Ya invitado', undefined, 409));
      await editar();
      await act(async () => { await mockFormProps.onSubmit(datos({ tipo: 'nomina' })); });
      expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Ya invitado');
      expect(mockShowToast).toHaveBeenCalledWith('Los datos del trabajador fueron actualizados.');
    });
    it('invitación falla con error genérico', async () => {
      montar('admin_empresa', { tipo: 'turnos' });
      mockM.invitar.mutateAsync.mockRejectedValueOnce(new Error('x'));
      await editar();
      await act(async () => { await mockFormProps.onSubmit(datos({ tipo: 'nomina' })); });
      expect(mockShowAlert).toHaveBeenCalledWith('Error', 'No se pudo enviar la invitación.');
    });
    it('quien ya es nómina no dispara la invitación', async () => {
      montar('admin_empresa', { tipo: 'nomina' });
      await editar();
      await act(async () => { await mockFormProps.onSubmit(datos({ tipo: 'nomina' })); });
      expect(mockConfirm).not.toHaveBeenCalled();
      expect(mockM.invitar.mutateAsync).not.toHaveBeenCalled();
    });
    it('de turnos a ambos tampoco invita', async () => {
      montar('admin_empresa', { tipo: 'turnos' });
      await editar();
      await act(async () => { await mockFormProps.onSubmit(datos({ tipo: 'ambos' })); });
      expect(mockM.invitar.mutateAsync).not.toHaveBeenCalled();
    });
  });
});

describe('casos extra (sobrevivientes de mutación)', () => {
  it('un valor vacío no dibuja la fila', () => {
    montar('admin_empresa', { cedula: '' });
    expect(screen.queryByText('Cédula')).toBeNull();
  });
  it('el ranking se muestra con el promedio, no con el conteo', () => {
    montar('admin_empresa');
    expect(screen.getByText('4.5')).toBeTruthy();
  });
  it('sin error cargando usa el texto por defecto', () => {
    mockRol = 'admin_empresa';
    mockQuery = { data: undefined, isLoading: false, isError: true, error: null, refetch: jest.fn() };
    render(<TrabajadorDetailScreen />);
    expect(screen.getByText('No se pudo cargar')).toBeTruthy();
  });
  it('Atrás (onRequestClose) cierra el modal de sueldo', () => {
    montar('admin_empresa');
    fireEvent.press(screen.getByText('Editar sueldo'));
    act(() => screen.UNSAFE_getByType(require('react-native').Modal).props.onRequestClose());
    expect(screen.queryByText('Cancelar')).toBeNull();
  });
  it('guardando sueldo: botón ocupado', () => {
    mockM.salario.isPending = true;
    montar('admin_empresa');
    fireEvent.press(screen.getByText('Editar sueldo'));
    expect(screen.getByLabelText('Guardar').props.accessibilityState.busy).toBe(true);
  });
  it('comentario limitado a 500 caracteres', () => {
    montar('admin_empresa');
    fireEvent.press(screen.getByText('Calificar ★'));
    expect(screen.getByPlaceholderText('Comentario opcional…').props.maxLength).toBe(500);
  });
  it('bloquear pendiente deshabilita el botón; eliminar pendiente también', () => {
    mockM.bloquear.isPending = true;
    montar('admin_empresa');
    expect(screen.getByTestId('spinner')).toBeTruthy();
    expect(screen.UNSAFE_getAllByProps({ disabled: true }).length).toBeGreaterThan(0);
  });
  it('eliminar pendiente: botón deshabilitado', () => {
    mockM.eliminar.isPending = true;
    montar('admin_empresa', { activo: false });
    expect(screen.getByText('Eliminando…')).toBeTruthy();
    expect(screen.UNSAFE_getAllByProps({ disabled: true }).some((n) => String(n.props.className ?? '').includes('bg-danger'))).toBe(true);
  });
  it('jefe_nomina con tipo ambos puede editar sueldo', () => {
    montar('jefe_nomina', { tipo: 'ambos' });
    expect(screen.getByText('Editar sueldo')).toBeTruthy();
  });
  it('cédula vacía se manda como undefined', async () => {
    montar('admin_empresa', { tipo: 'nomina' });
    await act(async () => { mockStackOptions.headerRight().props.onPress(); });
    await act(async () => { await mockFormProps.onSubmit({ nombre: 'A', apellido: 'B', tipo: 'nomina', cedula: '' }); });
    expect(mockM.actualizar.mutateAsync.mock.calls[0][0].cedula).toBeUndefined();
  });
});

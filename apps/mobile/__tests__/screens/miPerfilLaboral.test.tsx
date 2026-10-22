/**
 * Caracterización de la pantalla "Mi perfil laboral" ANTES de partirla en trozos: congela lo que dibuja
 * y lo que hace en cada flujo (ver, editar, guardar, experiencia, diplomas, selector de fecha). Si el
 * refactor cambia algo observable, uno de estos tests tiene que fallar.
 */
import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import MiPerfilLaboralScreen from '../../app/mi-perfil-laboral';

// ── Bordes simulados ─────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));

// Los iconos se dibujan como un Text con testID `icon-<nombre>` para poder pulsarlos.
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

let mockFechaElegida = new Date(2020, 2, 1);
const mockAndroidOpen = jest.fn();
jest.mock('@react-native-community/datetimepicker', () => {
  const { Pressable } = require('react-native');
  return {
    __esModule: true,
    default: (props: { onChange: (e: unknown, d?: Date) => void }) => (
      <Pressable testID="datepicker" onPress={() => props.onChange({}, mockFechaElegida)} />
    ),
    DateTimePickerAndroid: { open: (...a: unknown[]) => mockAndroidOpen(...a) },
  };
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

const mockPerfilQuery: { data: unknown; isLoading: boolean } = { data: undefined, isLoading: false };
const mockUpdate = { mutateAsync: jest.fn(), isPending: false };
const mockCrearExp = { mutateAsync: jest.fn(), isPending: false };
const mockEliminarExp = { mutate: jest.fn() };
const mockCrearDip = { mutateAsync: jest.fn(), isPending: false };
const mockEliminarDip = { mutate: jest.fn() };
jest.mock('@/features/equipo/perfil/usePerfilLaboral', () => ({
  usePerfilLaboral: () => mockPerfilQuery,
  useUpdatePerfilLaboral: () => mockUpdate,
  useCrearExperiencia: () => mockCrearExp,
  useEliminarExperiencia: () => mockEliminarExp,
  useCrearDiploma: () => mockCrearDip,
  useEliminarDiploma: () => mockEliminarDip,
}));

// ── Datos ────────────────────────────────────────────────────────────────────
const PERFIL = {
  tipo_documento: 'CE',
  cedula: '123456789',
  fecha_nacimiento: '1990-05-20',
  sexo: 'F',
  telefono: '3001112222',
  descripcion: 'Mesera con experiencia',
  direccion: 'Calle 1 # 2-3',
  eps: 'Sura',
  afp: 'Porvenir',
  banco: 'Bancolombia',
  tipo_cuenta: 'ahorros',
  numero_cuenta: '555000111',
  contacto_emergencia_nombre: 'Ana Pérez',
  contacto_emergencia_tel: '3109998888',
  ant_judiciales_fecha: '2025-01-10',
  ant_disciplinarios_fecha: '2025-02-11',
  experiencias: [
    { id: 1, empresa_nombre: 'Hotel Sol', cargo: 'Mesero', fecha_inicio: '2020-03-01', fecha_fin: '2022-06-30' },
    { id: 2, empresa_nombre: 'Café Luna', cargo: 'Barista', fecha_inicio: '2023-01-15', fecha_fin: null },
  ],
  diplomas: [{ id: 7, titulo: 'Bartender', institucion: 'SENA', anio: 2021 }],
  cargos: [{ id: 1, nombre: 'Mesero certificado' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRol = 'trabajador_turnos';
  mockPerfilQuery.data = PERFIL;
  mockPerfilQuery.isLoading = false;
  mockUpdate.isPending = false;
  mockUpdate.mutateAsync.mockResolvedValue(undefined);
  mockCrearExp.isPending = false;
  mockCrearExp.mutateAsync.mockResolvedValue(undefined);
  mockCrearDip.isPending = false;
  mockCrearDip.mutateAsync.mockResolvedValue(undefined);
  mockConfirm.mockResolvedValue(true);
});

const editar = () => fireEvent.press(screen.getByText('Editar perfil laboral'));

/** Abre el selector de un DateField (iOS: inline), elige `fecha` y lo cierra con "Listo". */
function elegirFecha(trigger: string, fecha: Date, indice = 0) {
  mockFechaElegida = fecha;
  fireEvent.press(screen.getAllByText(trigger)[indice]);
  fireEvent.press(screen.getByTestId('datepicker'));
  fireEvent.press(screen.getByText('Listo'));
}

describe('estados de carga', () => {
  test('cargando: no muestra el perfil ni el botón de editar', () => {
    mockPerfilQuery.isLoading = true;
    render(<MiPerfilLaboralScreen />);
    expect(screen.queryByText('Editar perfil laboral')).toBeNull();
    expect(screen.queryByText('Perfil no encontrado')).toBeNull();
  });

  test('sin perfil: muestra el aviso y nada más', () => {
    mockPerfilQuery.data = undefined;
    render(<MiPerfilLaboralScreen />);
    expect(screen.getByText('Perfil no encontrado')).toBeTruthy();
    expect(screen.getByText('Tu perfil laboral aún no ha sido creado por la empresa.')).toBeTruthy();
    expect(screen.queryByText('Editar perfil laboral')).toBeNull();
  });
});

describe('modo lectura', () => {
  test('muestra las 7 secciones con sus valores formateados', () => {
    render(<MiPerfilLaboralScreen />);
    for (const t of ['Identificación', 'Información personal', 'Sobre mí', 'Seguridad social', 'Datos bancarios',
      'Contacto de emergencia', 'Certificados de antecedentes']) {
      expect(screen.getByText(t)).toBeTruthy();
    }
    // identificación: el tipo se traduce con su etiqueta
    expect(screen.getByText('Cédula Ext. (CE)')).toBeTruthy();
    expect(screen.getByText('123456789')).toBeTruthy();
    // personal: fecha larga en es-CO, sexo traducido
    expect(screen.getByText('20 de mayo de 1990')).toBeTruthy();
    expect(screen.getByText('Femenino')).toBeTruthy();
    expect(screen.getByText('3001112222')).toBeTruthy();
    expect(screen.getByText('Calle 1 # 2-3')).toBeTruthy();
    expect(screen.getByText('Mesera con experiencia')).toBeTruthy();
    // seguridad social y banco (tipo de cuenta con inicial mayúscula)
    expect(screen.getByText('Sura')).toBeTruthy();
    expect(screen.getByText('Porvenir')).toBeTruthy();
    expect(screen.getByText('Bancolombia')).toBeTruthy();
    expect(screen.getByText('Ahorros')).toBeTruthy();
    expect(screen.getByText('555000111')).toBeTruthy();
    // emergencia y antecedentes
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    expect(screen.getByText('3109998888')).toBeTruthy();
    expect(screen.getByText('10 de enero de 2025')).toBeTruthy();
    expect(screen.getByText('11 de febrero de 2025')).toBeTruthy();
    expect(screen.getByText('Editar perfil laboral')).toBeTruthy();
    expect(screen.queryByText('Guardar cambios')).toBeNull();
  });

  test('campos vacíos: guion largo y texto por defecto de la descripción', () => {
    mockPerfilQuery.data = { experiencias: [], diplomas: [], cargos: [] };
    render(<MiPerfilLaboralScreen />);
    expect(screen.getByText('Aún no has escrito una descripción de tu perfil.')).toBeTruthy();
    expect(screen.getByText('Cédula (CC)')).toBeTruthy(); // tipo_documento por defecto
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(10);
  });

  test('experiencia: rango corto de fechas, "actualidad" si no tiene fin; diploma con año', () => {
    render(<MiPerfilLaboralScreen />);
    expect(screen.getByText('Experiencia laboral')).toBeTruthy();
    expect(screen.getByText('Hotel Sol')).toBeTruthy();
    expect(screen.getByText('Café Luna')).toBeTruthy();
    expect(screen.getByText(/actualidad/)).toBeTruthy();
    expect(screen.getByText(/mar de 2020 – jun de 2022/)).toBeTruthy();
    expect(screen.getByText(/ene de 2023 – actualidad/)).toBeTruthy();
    expect(screen.getByText('Diplomas y certificados')).toBeTruthy();
    expect(screen.getByText('Bartender')).toBeTruthy();
    expect(screen.getByText('SENA')).toBeTruthy();
    expect(screen.getByText('2021')).toBeTruthy();
    expect(screen.getByText('Cargos certificados')).toBeTruthy();
    expect(screen.getByText('Mesero certificado')).toBeTruthy();
  });

  test('sin cargos certificados: no hay sección de cargos', () => {
    mockPerfilQuery.data = { ...PERFIL, cargos: [] };
    render(<MiPerfilLaboralScreen />);
    expect(screen.queryByText('Cargos certificados')).toBeNull();
  });

  test('trabajador_nomina no ve experiencia, diplomas ni cargos', () => {
    mockRol = 'trabajador_nomina';
    render(<MiPerfilLaboralScreen />);
    expect(screen.getByText('Seguridad social')).toBeTruthy();
    expect(screen.queryByText('Experiencia laboral')).toBeNull();
    expect(screen.queryByText('Diplomas y certificados')).toBeNull();
    expect(screen.queryByText('Cargos certificados')).toBeNull();
    expect(screen.queryByText('Agregar experiencia')).toBeNull();
  });
});

describe('modo edición', () => {
  test('editar muestra los campos con los valores actuales y los botones de guardar/cancelar', () => {
    render(<MiPerfilLaboralScreen />);
    editar();
    for (const v of ['123456789', '3001112222', 'Calle 1 # 2-3', 'Sura', 'Porvenir', 'Bancolombia', '555000111',
      'Ana Pérez', '3109998888', 'Mesera con experiencia']) {
      expect(screen.getByDisplayValue(v)).toBeTruthy();
    }
    expect(screen.getByText('Cédula Ext. (CE)')).toBeTruthy(); // opciones de PillRow
    expect(screen.getByText('Pasaporte')).toBeTruthy();
    expect(screen.getByText('Corriente')).toBeTruthy();
    expect(screen.getByText('Guardar cambios')).toBeTruthy();
    expect(screen.queryByText('Editar perfil laboral')).toBeNull();
    // contador de la descripción (maxLength 500)
    expect(screen.getByText('22/500')).toBeTruthy();
  });

  test('cancelar descarta lo escrito y vuelve a lectura', () => {
    render(<MiPerfilLaboralScreen />);
    editar();
    fireEvent.changeText(screen.getByDisplayValue('Sura'), 'Otra EPS');
    fireEvent.press(screen.getAllByText('Cancelar')[0]);
    expect(screen.getByText('Editar perfil laboral')).toBeTruthy();
    expect(screen.getByText('Sura')).toBeTruthy();
    expect(screen.queryByText('Otra EPS')).toBeNull();
    editar();
    expect(screen.getByDisplayValue('Sura')).toBeTruthy(); // el formulario se restauró
  });

  test('las PillRow cambian la opción elegida y se guarda', async () => {
    render(<MiPerfilLaboralScreen />);
    editar();
    fireEvent.press(screen.getByText('Pasaporte'));
    fireEvent.press(screen.getByText('Corriente'));
    fireEvent.press(screen.getByText('Otro'));
    await act(async () => { fireEvent.press(screen.getByText('Guardar cambios')); });
    expect(mockUpdate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      tipo_documento: 'PAS', tipo_cuenta: 'corriente', sexo: 'otro',
    }));
  });
});

describe('guardar', () => {
  test('envía todos los campos, avisa y vuelve a lectura', async () => {
    render(<MiPerfilLaboralScreen />);
    editar();
    fireEvent.changeText(screen.getByDisplayValue('Sura'), 'Nueva EPS');
    await act(async () => { fireEvent.press(screen.getByText('Guardar cambios')); });
    expect(mockUpdate.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mutateAsync.mock.calls[0][0]).toStrictEqual({
      tipo_documento: 'CE',
      cedula: '123456789',
      fecha_nacimiento: '1990-05-20',
      sexo: 'F',
      telefono: '3001112222',
      descripcion: 'Mesera con experiencia',
      direccion: 'Calle 1 # 2-3',
      eps: 'Nueva EPS',
      afp: 'Porvenir',
      banco: 'Bancolombia',
      tipo_cuenta: 'ahorros',
      numero_cuenta: '555000111',
      contacto_emergencia_nombre: 'Ana Pérez',
      contacto_emergencia_tel: '3109998888',
      ant_judiciales_fecha: '2025-01-10',
      ant_disciplinarios_fecha: '2025-02-11',
    });
    expect(mockShowToast).toHaveBeenCalledWith('Perfil actualizado correctamente.');
    expect(screen.getByText('Editar perfil laboral')).toBeTruthy();
  });

  test('los campos vacíos se envían como undefined (y el tipo de documento por defecto es CC)', async () => {
    mockPerfilQuery.data = { experiencias: [], diplomas: [], cargos: [] };
    render(<MiPerfilLaboralScreen />);
    editar();
    await act(async () => { fireEvent.press(screen.getByText('Guardar cambios')); });
    expect(mockUpdate.mutateAsync.mock.calls[0][0]).toStrictEqual({
      tipo_documento: 'CC',
      cedula: undefined, fecha_nacimiento: undefined, sexo: undefined, telefono: undefined,
      descripcion: undefined, direccion: undefined, eps: undefined, afp: undefined, banco: undefined,
      tipo_cuenta: undefined, numero_cuenta: undefined, contacto_emergencia_nombre: undefined,
      contacto_emergencia_tel: undefined, ant_judiciales_fecha: undefined, ant_disciplinarios_fecha: undefined,
    });
  });

  test('una fecha futura se rechaza con aviso y no se guarda', async () => {
    mockPerfilQuery.data = { ...PERFIL, ant_judiciales_fecha: '2999-01-01' };
    render(<MiPerfilLaboralScreen />);
    editar();
    await act(async () => { fireEvent.press(screen.getByText('Guardar cambios')); });
    expect(mockShowAlert).toHaveBeenCalledWith(
      'Fecha inválida',
      'Fecha de antecedentes judiciales debe tener formato AAAA-MM-DD y no puede ser futura.',
      'warning',
    );
    expect(mockUpdate.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText('Guardar cambios')).toBeTruthy(); // sigue editando
  });

  test('si el servidor falla: muestra el mensaje y sigue en edición', async () => {
    mockUpdate.mutateAsync.mockRejectedValue({ message: 'Cédula duplicada' });
    render(<MiPerfilLaboralScreen />);
    editar();
    await act(async () => { fireEvent.press(screen.getByText('Guardar cambios')); });
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Cédula duplicada');
    expect(mockShowToast).not.toHaveBeenCalled();
    expect(screen.getByText('Guardar cambios')).toBeTruthy();
  });

  test('un error sin mensaje usa el texto por defecto', async () => {
    mockUpdate.mutateAsync.mockRejectedValue('boom');
    render(<MiPerfilLaboralScreen />);
    editar();
    await act(async () => { fireEvent.press(screen.getByText('Guardar cambios')); });
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Error al guardar');
  });

  test('mientras guarda no muestra "Guardar cambios", muestra el spinner y el botón no responde', () => {
    mockUpdate.isPending = true;
    render(<MiPerfilLaboralScreen />);
    editar();
    expect(screen.queryByText('Guardar cambios')).toBeNull();
    fireEvent.press(screen.getByTestId('spinner'));
    expect(mockUpdate.mutateAsync).not.toHaveBeenCalled();
  });

  test('cada campo escribe en su propio campo del envío', async () => {
    render(<MiPerfilLaboralScreen />);
    editar();
    const cambios: [string, string][] = [
      ['123456789', 'c1'], ['3001112222', 'c2'], ['Calle 1 # 2-3', 'c3'], ['Sura', 'c4'],
      ['Porvenir', 'c5'], ['Bancolombia', 'c6'], ['555000111', 'c7'], ['Ana Pérez', 'c8'],
      ['3109998888', 'c9'], ['Mesera con experiencia', 'c10'],
    ];
    for (const [actual, nuevo] of cambios) fireEvent.changeText(screen.getByDisplayValue(actual), nuevo);
    await act(async () => { fireEvent.press(screen.getByText('Guardar cambios')); });
    expect(mockUpdate.mutateAsync.mock.calls[0][0]).toStrictEqual({
      tipo_documento: 'CE', cedula: 'c1', fecha_nacimiento: '1990-05-20', sexo: 'F', telefono: 'c2',
      descripcion: 'c10', direccion: 'c3', eps: 'c4', afp: 'c5', banco: 'c6', tipo_cuenta: 'ahorros',
      numero_cuenta: 'c7', contacto_emergencia_nombre: 'c8', contacto_emergencia_tel: 'c9',
      ant_judiciales_fecha: '2025-01-10', ant_disciplinarios_fecha: '2025-02-11',
    });
  });

  test('los campos de teléfono y número usan el teclado adecuado', () => {
    render(<MiPerfilLaboralScreen />);
    editar();
    expect(screen.getByDisplayValue('123456789').props.keyboardType).toBe('numeric');
    expect(screen.getByDisplayValue('3001112222').props.keyboardType).toBe('phone-pad');
    expect(screen.getByDisplayValue('3109998888').props.keyboardType).toBe('phone-pad');
    expect(screen.getByDisplayValue('555000111').props.keyboardType).toBe('numeric');
    expect(screen.getByDisplayValue('Sura').props.keyboardType).toBe('default');
  });

  test('las fechas que llegan con hora se recortan a AAAA-MM-DD al editar', async () => {
    mockPerfilQuery.data = { ...PERFIL, fecha_nacimiento: '1990-05-20T00:00:00.000Z', ant_judiciales_fecha: '2025-01-10T05:00:00.000Z' };
    render(<MiPerfilLaboralScreen />);
    editar();
    await act(async () => { fireEvent.press(screen.getByText('Guardar cambios')); });
    expect(mockUpdate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      fecha_nacimiento: '1990-05-20', ant_judiciales_fecha: '2025-01-10',
    }));
  });
});

describe('selector de fecha (DateField)', () => {
  test('iOS: abrir muestra el selector, elegir cambia el valor y "Listo" lo cierra', async () => {
    render(<MiPerfilLaboralScreen />);
    editar();
    expect(screen.queryByTestId('datepicker')).toBeNull();
    mockFechaElegida = new Date(1985, 11, 24);
    fireEvent.press(screen.getByText('20 de mayo de 1990'));
    expect(screen.getByText('Listo')).toBeTruthy();
    fireEvent.press(screen.getByTestId('datepicker'));
    expect(screen.getByText('24 de diciembre de 1985')).toBeTruthy();
    fireEvent.press(screen.getByText('Listo'));
    expect(screen.queryByTestId('datepicker')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByText('Guardar cambios')); });
    expect(mockUpdate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ fecha_nacimiento: '1985-12-24' }));
  });

  test('la X borra la fecha', async () => {
    mockPerfilQuery.data = { ...PERFIL, ant_judiciales_fecha: null };
    render(<MiPerfilLaboralScreen />);
    editar();
    // fecha_nacimiento y ant_disciplinarias tienen valor → 2 botones de borrar
    const cerrar = screen.getAllByTestId('icon-close-circle');
    expect(cerrar).toHaveLength(2);
    fireEvent.press(cerrar[0]);
    expect(screen.queryByText('20 de mayo de 1990')).toBeNull();
    expect(screen.getAllByText('Seleccionar fecha')).toHaveLength(2);
    await act(async () => { fireEvent.press(screen.getByText('Guardar cambios')); });
    expect(mockUpdate.mutateAsync.mock.calls[0][0].fecha_nacimiento).toBeUndefined();
  });

  test('Android: abre el diálogo nativo con las fechas límite y aplica lo elegido', () => {
    const original = Platform.OS;
    Platform.OS = 'android';
    try {
      render(<MiPerfilLaboralScreen />);
      editar();
      fireEvent.press(screen.getByText('20 de mayo de 1990'));
      expect(screen.queryByTestId('datepicker')).toBeNull(); // no se monta como hijo
      expect(mockAndroidOpen).toHaveBeenCalledTimes(1);
      const arg = mockAndroidOpen.mock.calls[0][0];
      expect(arg.mode).toBe('date');
      expect(arg.value).toEqual(new Date('1990-05-20T00:00:00'));
      expect(arg.maximumDate).toBeInstanceOf(Date);
      expect(arg.minimumDate).toBeUndefined();
      act(() => arg.onChange({}, new Date(1991, 0, 2)));
      expect(screen.getByText('2 de enero de 1991')).toBeTruthy();
    } finally {
      Platform.OS = original;
    }
  });
});

describe('experiencia laboral', () => {
  test('agregar: el formulario se abre y "Cancelar" lo cierra y lo limpia', () => {
    render(<MiPerfilLaboralScreen />);
    fireEvent.press(screen.getByText('Agregar experiencia'));
    expect(screen.queryByText('Agregar experiencia')).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText('Empresa'), 'Bar Sur');
    fireEvent.press(screen.getAllByText('Cancelar')[0]);
    expect(screen.getByText('Agregar experiencia')).toBeTruthy();
    fireEvent.press(screen.getByText('Agregar experiencia'));
    expect(screen.getByPlaceholderText('Empresa').props.value).toBe('');
  });

  test('sin empresa, cargo o fecha de inicio: avisa y no guarda', async () => {
    render(<MiPerfilLaboralScreen />);
    fireEvent.press(screen.getByText('Agregar experiencia'));
    await act(async () => { fireEvent.press(screen.getByText('Guardar')); });
    expect(mockShowAlert).toHaveBeenCalledWith('Campos requeridos', 'Empresa, cargo y fecha de inicio son obligatorios', 'warning');
    expect(mockCrearExp.mutateAsync).not.toHaveBeenCalled();
  });

  test('con empresa y cargo pero sin fecha de inicio: también avisa', async () => {
    render(<MiPerfilLaboralScreen />);
    fireEvent.press(screen.getByText('Agregar experiencia'));
    fireEvent.changeText(screen.getByPlaceholderText('Empresa'), 'Bar Sur');
    fireEvent.changeText(screen.getByPlaceholderText('Cargo'), 'Cajero');
    await act(async () => { fireEvent.press(screen.getByText('Guardar')); });
    expect(mockShowAlert).toHaveBeenCalledWith('Campos requeridos', 'Empresa, cargo y fecha de inicio son obligatorios', 'warning');
    expect(mockCrearExp.mutateAsync).not.toHaveBeenCalled();
  });

  test('mientras guarda la experiencia el botón no responde', async () => {
    mockCrearExp.isPending = true;
    render(<MiPerfilLaboralScreen />);
    fireEvent.press(screen.getByText('Agregar experiencia'));
    expect(screen.queryByText('Guardar')).toBeNull();
    fireEvent.press(screen.getByTestId('spinner'));
    expect(mockShowAlert).not.toHaveBeenCalled();
    expect(mockCrearExp.mutateAsync).not.toHaveBeenCalled();
  });

  test('fecha de fin anterior al inicio: avisa y no guarda', async () => {
    render(<MiPerfilLaboralScreen />);
    fireEvent.press(screen.getByText('Agregar experiencia'));
    fireEvent.changeText(screen.getByPlaceholderText('Empresa'), 'Bar Sur');
    fireEvent.changeText(screen.getByPlaceholderText('Cargo'), 'Cajero');
    elegirFecha('Seleccionar fecha', new Date(2022, 5, 1), 0);   // inicio
    elegirFecha('Seleccionar fecha', new Date(2021, 0, 1), 0);   // fin (la única que queda vacía)
    await act(async () => { fireEvent.press(screen.getByText('Guardar')); });
    expect(mockShowAlert).toHaveBeenCalledWith(
      'Fecha inválida',
      'La fecha de fin debe ser AAAA-MM-DD y no puede ser antes que la de inicio.',
      'warning',
    );
    expect(mockCrearExp.mutateAsync).not.toHaveBeenCalled();
  });

  test('guardar envía los datos (fin vacío → null), cierra y limpia el formulario', async () => {
    render(<MiPerfilLaboralScreen />);
    fireEvent.press(screen.getByText('Agregar experiencia'));
    fireEvent.changeText(screen.getByPlaceholderText('Empresa'), 'Bar Sur');
    fireEvent.changeText(screen.getByPlaceholderText('Cargo'), 'Cajero');
    elegirFecha('Seleccionar fecha', new Date(2022, 5, 1), 0);
    await act(async () => { fireEvent.press(screen.getByText('Guardar')); });
    expect(mockCrearExp.mutateAsync).toHaveBeenCalledWith({
      empresa_nombre: 'Bar Sur', cargo: 'Cajero', fecha_inicio: '2022-06-01', fecha_fin: null,
    });
    expect(screen.getByText('Agregar experiencia')).toBeTruthy();
    fireEvent.press(screen.getByText('Agregar experiencia'));
    expect(screen.getByPlaceholderText('Empresa').props.value).toBe('');
  });

  test('si falla al guardar: avisa y deja el formulario abierto con lo escrito', async () => {
    mockCrearExp.mutateAsync.mockRejectedValue(new Error('x'));
    render(<MiPerfilLaboralScreen />);
    fireEvent.press(screen.getByText('Agregar experiencia'));
    fireEvent.changeText(screen.getByPlaceholderText('Empresa'), 'Bar Sur');
    fireEvent.changeText(screen.getByPlaceholderText('Cargo'), 'Cajero');
    elegirFecha('Seleccionar fecha', new Date(2022, 5, 1), 0);
    await act(async () => { fireEvent.press(screen.getByText('Guardar')); });
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'No se pudo guardar la experiencia');
    expect(screen.getByPlaceholderText('Empresa').props.value).toBe('Bar Sur');
  });

  test('eliminar pide confirmación y solo borra si se acepta', async () => {
    render(<MiPerfilLaboralScreen />);
    const papeleras = screen.getAllByTestId('icon-trash-outline');
    // 2 experiencias + 1 diploma, en ese orden
    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => { fireEvent.press(papeleras[0]); });
    expect(mockConfirm).toHaveBeenCalledWith({ title: 'Eliminar experiencia', message: '¿Estás seguro?', confirmLabel: 'Eliminar', destructive: true });
    expect(mockEliminarExp.mutate).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(papeleras[1]); });
    expect(mockEliminarExp.mutate).toHaveBeenCalledWith(2);
  });
});

describe('diplomas', () => {
  test('sin título o institución: avisa y no guarda', async () => {
    render(<MiPerfilLaboralScreen />);
    fireEvent.press(screen.getByText('Agregar diploma o certificado'));
    await act(async () => { fireEvent.press(screen.getByText('Guardar')); });
    expect(mockShowAlert).toHaveBeenCalledWith('Campos requeridos', 'Título e institución son obligatorios', 'warning');
    expect(mockCrearDip.mutateAsync).not.toHaveBeenCalled();
  });

  test('con título pero sin institución: también avisa', async () => {
    render(<MiPerfilLaboralScreen />);
    fireEvent.press(screen.getByText('Agregar diploma o certificado'));
    fireEvent.changeText(screen.getByPlaceholderText('Título / Certificado'), 'Inglés');
    await act(async () => { fireEvent.press(screen.getByText('Guardar')); });
    expect(mockShowAlert).toHaveBeenCalledWith('Campos requeridos', 'Título e institución son obligatorios', 'warning');
    expect(mockCrearDip.mutateAsync).not.toHaveBeenCalled();
  });

  test('mientras guarda el diploma el botón no responde', () => {
    mockCrearDip.isPending = true;
    render(<MiPerfilLaboralScreen />);
    fireEvent.press(screen.getByText('Agregar diploma o certificado'));
    fireEvent.press(screen.getByTestId('spinner'));
    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  test('guardar envía el año como número, o null si va vacío; cierra y limpia', async () => {
    render(<MiPerfilLaboralScreen />);
    fireEvent.press(screen.getByText('Agregar diploma o certificado'));
    fireEvent.changeText(screen.getByPlaceholderText('Título / Certificado'), 'Primeros auxilios');
    fireEvent.changeText(screen.getByPlaceholderText('Institución'), 'Cruz Roja');
    fireEvent.changeText(screen.getByPlaceholderText('2023'), '2024');
    await act(async () => { fireEvent.press(screen.getByText('Guardar')); });
    expect(mockCrearDip.mutateAsync).toHaveBeenLastCalledWith({ titulo: 'Primeros auxilios', institucion: 'Cruz Roja', anio: 2024 });
    expect(screen.getByText('Agregar diploma o certificado')).toBeTruthy();

    fireEvent.press(screen.getByText('Agregar diploma o certificado'));
    expect(screen.getByPlaceholderText('Título / Certificado').props.value).toBe('');
    fireEvent.changeText(screen.getByPlaceholderText('Título / Certificado'), 'Inglés');
    fireEvent.changeText(screen.getByPlaceholderText('Institución'), 'ICA');
    await act(async () => { fireEvent.press(screen.getByText('Guardar')); });
    expect(mockCrearDip.mutateAsync).toHaveBeenLastCalledWith({ titulo: 'Inglés', institucion: 'ICA', anio: null });
  });

  test('si falla al guardar: avisa y deja el formulario abierto', async () => {
    mockCrearDip.mutateAsync.mockRejectedValue(new Error('x'));
    render(<MiPerfilLaboralScreen />);
    fireEvent.press(screen.getByText('Agregar diploma o certificado'));
    fireEvent.changeText(screen.getByPlaceholderText('Título / Certificado'), 'Inglés');
    fireEvent.changeText(screen.getByPlaceholderText('Institución'), 'ICA');
    await act(async () => { fireEvent.press(screen.getByText('Guardar')); });
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'No se pudo guardar el diploma');
    expect(screen.getByPlaceholderText('Institución').props.value).toBe('ICA');
  });

  test('cancelar cierra y limpia el formulario', () => {
    render(<MiPerfilLaboralScreen />);
    fireEvent.press(screen.getByText('Agregar diploma o certificado'));
    fireEvent.changeText(screen.getByPlaceholderText('Institución'), 'ICA');
    fireEvent.press(screen.getAllByText('Cancelar')[0]);
    fireEvent.press(screen.getByText('Agregar diploma o certificado'));
    expect(screen.getByPlaceholderText('Institución').props.value).toBe('');
  });

  test('eliminar pide confirmación y borra el diploma', async () => {
    render(<MiPerfilLaboralScreen />);
    const papeleras = screen.getAllByTestId('icon-trash-outline');
    await act(async () => { fireEvent.press(papeleras[2]); });
    expect(mockConfirm).toHaveBeenCalledWith({ title: 'Eliminar diploma', message: '¿Estás seguro?', confirmLabel: 'Eliminar', destructive: true });
    expect(mockEliminarDip.mutate).toHaveBeenCalledWith(7);
  });
});

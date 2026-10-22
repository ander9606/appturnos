/**
 * Caracterización de la pestaña "Perfil" ANTES de partirla: congela lo que dibuja y hace por rol
 * (accesos rápidos, rutas y orden), foto, datos personales, contraseña, biometría, turnos extra,
 * cerrar sesión y eliminar cuenta.
 */
import React from 'react';
import { Switch } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PerfilScreen from '../../app/(tabs)/perfil';

// ── Bordes simulados ─────────────────────────────────────────────────────────
const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockUsuario: any;
const mockLogout = jest.fn();
const mockSetUsuario = jest.fn();
jest.mock('@/features/auth/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ usuario: mockUsuario, logout: mockLogout, setUsuario: mockSetUsuario }),
}));

const mockHasHardware = jest.fn();
const mockIsEnrolled = jest.fn();
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: (...a: unknown[]) => mockHasHardware(...a),
  isEnrolledAsync: (...a: unknown[]) => mockIsEnrolled(...a),
}));
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
jest.mock('@/lib/secureStore', () => ({
  webSafeSecureStore: { getItemAsync: (...a: unknown[]) => mockGetItem(...a), setItemAsync: (...a: unknown[]) => mockSetItem(...a) },
}));

const mockAuthApi = { actualizarFoto: jest.fn(), updateProfile: jest.fn(), changePassword: jest.fn(), eliminarCuenta: jest.fn() };
jest.mock('@api-client', () => ({
  ...jest.requireActual('@api-client'),
  authApi: {
    actualizarFoto: (...a: unknown[]) => mockAuthApi.actualizarFoto(...a),
    updateProfile: (...a: unknown[]) => mockAuthApi.updateProfile(...a),
    changePassword: (...a: unknown[]) => mockAuthApi.changePassword(...a),
    eliminarCuenta: (...a: unknown[]) => mockAuthApi.eliminarCuenta(...a),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockNominaPerfil: any;
let mockNominaEnabled: unknown;
const mockExtras = { mutate: jest.fn(), isPending: false };
jest.mock('@/features/nomina/useNomina', () => ({
  useNominaPerfil: (enabled: unknown) => { mockNominaEnabled = enabled; return { data: mockNominaPerfil }; },
  useActualizarExtras: () => mockExtras,
}));

const mockElegirFoto = jest.fn();
jest.mock('@/lib/pickImage', () => ({ elegirFotoConMenu: (...a: unknown[]) => mockElegirFoto(...a) }));
const mockConfirm = jest.fn();
jest.mock('@/lib/confirmDialog', () => ({ confirm: (...a: unknown[]) => mockConfirm(...a) }));
const mockShowAlert = jest.fn();
jest.mock('@/lib/alertDialog', () => ({ showAlert: (...a: unknown[]) => mockShowAlert(...a) }));
const mockShowToast = jest.fn();
jest.mock('@/lib/toast', () => ({ showToast: (...a: unknown[]) => mockShowToast(...a) }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockAvatarProps: any;
jest.mock('@/components/ui/Avatar', () => {
  const { Text } = require('react-native');
  return { Avatar: (p: unknown) => { mockAvatarProps = p; return <Text testID="avatar" />; } };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockEditProps: any, mockPassProps: any, mockDeleteProps: any;
jest.mock('@/features/perfil/EditProfileForm', () => {
  const { Pressable, View } = require('react-native');
  return {
    EditProfileForm: (p: { onSave: (a: string, b: string, c: string) => void; onCancel: () => void }) => {
      mockEditProps = p;
      return <View testID="form-datos"><Pressable testID="datos-guardar" onPress={() => p.onSave('Ana', 'Gómez', 'ana@x.com')} /><Pressable testID="datos-cancelar" onPress={p.onCancel} /></View>;
    },
  };
});
jest.mock('@/features/perfil/ChangePasswordForm', () => {
  const { Pressable, View } = require('react-native');
  return {
    ChangePasswordForm: (p: { onSave: (a: string, b: string) => void; onCancel: () => void }) => {
      mockPassProps = p;
      return <View testID="form-password"><Pressable testID="pass-guardar" onPress={() => p.onSave('vieja123', 'nueva1234')} /><Pressable testID="pass-cancelar" onPress={p.onCancel} /></View>;
    },
  };
});
jest.mock('@/features/perfil/DeleteAccountForm', () => {
  const { Pressable, View } = require('react-native');
  return {
    DeleteAccountForm: (p: { onConfirm: (a: string) => void; onCancel: () => void }) => {
      mockDeleteProps = p;
      return <View testID="form-eliminar"><Pressable testID="eliminar-confirmar" onPress={() => p.onConfirm('mi-clave')} /><Pressable testID="eliminar-cancelar" onPress={p.onCancel} /></View>;
    },
  };
});

// ── Datos ────────────────────────────────────────────────────────────────────
const USUARIO = { id: 7, nombre: 'Laura', apellido: 'Pérez', email: 'laura@x.com', rol: 'trabajador_turnos', foto_perfil: null };
const ROL_TEXTO: Record<string, string> = {
  admin_empresa: 'Administrador', jefe_turnos: 'Jefe de Turnos', jefe_nomina: 'Jefe de Nómina', nomina: 'Nómina',
  trabajador_turnos: 'Trabajador de Turnos', trabajador_nomina: 'Trabajador de Nómina', super_admin: 'Super Admin',
};

let qc: QueryClient;
async function montar(rol = 'trabajador_turnos', over: Record<string, unknown> = {}) {
  mockUsuario = { ...USUARIO, rol, ...over };
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  const r = render(<QueryClientProvider client={qc}><PerfilScreen /></QueryClientProvider>);
  await act(async () => {});             // la biometría se consulta al montar
  return r;
}
/** Promesa "en curso" que el test resuelve al terminar (una que nunca se resuelve mantiene vivo el proceso de Jest). */
const pendientes: (() => void)[] = [];
const enCurso = () => new Promise((ok) => { pendientes.push(() => ok(null)); });
afterEach(async () => {
  await act(async () => { pendientes.splice(0).forEach((f) => f()); });
  qc?.clear();
});

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(mockAuthApi).forEach((f) => f.mockReset());
  mockHasHardware.mockResolvedValue(false);
  mockIsEnrolled.mockResolvedValue(false);
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  mockConfirm.mockResolvedValue(true);
  mockLogout.mockResolvedValue(undefined);
  mockNominaPerfil = { acepta_extras: false };
  mockExtras.isPending = false;
  mockAvatarProps = undefined;
});

const texto = (t: string | RegExp) => screen.getByText(t);
/** Sube desde un texto hasta la fila (el Pressable de la tarjeta) para leer su clase. */
function claseDeFila(label: string): string {
  let n = screen.getByText(label).parent;
  while (n && !(typeof n.props.className === 'string' && n.props.className.includes('px-5'))) n = n.parent;
  return n!.props.className as string;
}
const filas = (labels: string[]) => labels.forEach((l) => expect(texto(l)).toBeTruthy());
function filaDe(label: string) {
  let n = screen.getByText(label).parent;
  while (n && !(typeof n.props.className === 'string' && n.props.className.includes('px-5'))) n = n.parent;
  return n!;
}
/** Icono que acompaña a cada acceso rápido. */
const ICONO: Record<string, string> = {
  'Perfil laboral': 'id-card-outline', 'Mis postulaciones': 'list-outline', 'Mis empresas': 'business-outline',
  'Mi disponibilidad': 'calendar-clear-outline', 'Mi equipo': 'people-outline', 'Solicitudes de ingreso': 'person-add-outline',
  'Gestión de turnos': 'calendar-outline', 'Gestión de cargos': 'briefcase-outline', 'Reportes': 'bar-chart-outline',
  'Estado de sincronización': 'pulse-outline', 'Puntos de marcaje': 'location-outline', 'Mi empresa': 'business-outline',
  'Mi plan': 'pricetag-outline', 'Gestores': 'people-outline', 'Crear gestor': 'person-add-outline',
  'Integración logiq360': 'link-outline', 'Mi información laboral': 'id-card-outline', 'Mis postulaciones extra': 'list-outline',
  'Mis ausencias': 'calendar-clear-outline', 'Mis contratos': 'document-text-outline', 'Mis cuentas de cobro': 'receipt-outline',
  'Términos y condiciones': 'shield-checkmark-outline', 'Política de privacidad': 'lock-closed-outline',
};

describe('encabezado', () => {
  test('muestra el título, el nombre completo, el correo y el rol traducido', async () => {
    await montar('admin_empresa');
    expect(texto('Mi Perfil')).toBeTruthy();
    expect(texto('Laura Pérez')).toBeTruthy();
    expect(screen.getAllByText('laura@x.com')).toHaveLength(2);
    expect(screen.getAllByText('Administrador').length).toBeGreaterThanOrEqual(1);
  });

  test.each(Object.entries(ROL_TEXTO))('rol %s se muestra como "%s" en el encabezado y en la tarjeta de cuenta', async (rol, etiqueta) => {
    await montar(rol);
    expect(screen.getAllByText(etiqueta)).toHaveLength(2);
  });

  test('un rol desconocido se muestra tal cual', async () => {
    await montar('rol_raro');
    expect(screen.getAllByText('rol_raro')).toHaveLength(2);
  });

  test('sin rol, la tarjeta de cuenta muestra un guion largo', async () => {
    await montar('', { rol: undefined });
    expect(screen.getAllByText('—')).toHaveLength(1);
  });

  test('el avatar recibe los datos del usuario', async () => {
    await montar('trabajador_turnos', { foto_perfil: 'B64FOTO' });
    expect(mockAvatarProps).toMatchObject({ id: 7, nombre: 'Laura', apellido: 'Pérez', fotoB64: 'B64FOTO', size: 80 });
  });
});

describe('accesos rápidos por rol', () => {
  // [rol, filas en orden, ruta de cada una]
  const TABLA: [string, [string, string][]][] = [
    ['trabajador_turnos', [
      ['Perfil laboral', '/mi-perfil-laboral'], ['Mis postulaciones', '/mis-postulaciones'], ['Mis empresas', '/mis-empresas'],
      ['Mi disponibilidad', '/disponibilidad'], ['Mis ausencias', '/ausencias'], ['Mis contratos', '/mis-contratos'],
      ['Mis cuentas de cobro', '/mis-cuentas-cobro'], ['Términos y condiciones', '/terminos'], ['Política de privacidad', '/privacidad'],
    ]],
    ['jefe_turnos', [
      ['Mi equipo', '/(tabs)/equipo'], ['Solicitudes de ingreso', '/solicitudes'], ['Gestión de turnos', '/(tabs)/turnos'],
      ['Gestión de cargos', '/cargos'], ['Reportes', '/reportes'], ['Estado de sincronización', '/integracion/estado'],
      ['Puntos de marcaje', '/puntos-marcaje'], ['Términos y condiciones', '/terminos'], ['Política de privacidad', '/privacidad'],
    ]],
    ['jefe_nomina', [['Reportes', '/reportes'], ['Términos y condiciones', '/terminos'], ['Política de privacidad', '/privacidad']]],
    ['nomina', [['Reportes', '/reportes'], ['Términos y condiciones', '/terminos'], ['Política de privacidad', '/privacidad']]],
    ['admin_empresa', [
      ['Mi empresa', '/mi-empresa'], ['Mi plan', '/mi-plan'], ['Gestores', '/gestores'], ['Reportes', '/reportes'],
      ['Crear gestor', '/crear-gestor'], ['Solicitudes de ingreso', '/solicitudes'], ['Gestión de cargos', '/cargos'],
      ['Puntos de marcaje', '/puntos-marcaje'], ['Integración logiq360', '/integracion/config'],
      ['Términos y condiciones', '/terminos'], ['Política de privacidad', '/privacidad'],
    ]],
    ['trabajador_nomina', [
      ['Mi información laboral', '/mi-perfil-laboral'], ['Mis ausencias', '/ausencias'],
      ['Términos y condiciones', '/terminos'], ['Política de privacidad', '/privacidad'],
    ]],
    ['super_admin', [['Términos y condiciones', '/terminos'], ['Política de privacidad', '/privacidad']]],
  ];

  test.each(TABLA)('%s: cada fila existe y lleva a su ruta', async (rol, filasEsperadas) => {
    await montar(rol);
    for (const [label, ruta] of filasEsperadas) {
      mockRouter.push.mockClear();
      const fila = within(filaDe(label));
      expect(fila.getByTestId(`icon-${ICONO[label]}`)).toBeTruthy();
      expect(fila.getByTestId('icon-chevron-forward')).toBeTruthy();
      fireEvent.press(texto(label));
      expect(mockRouter.push).toHaveBeenCalledTimes(1);
      expect(mockRouter.push).toHaveBeenCalledWith(ruta);
    }
  });

  test.each(TABLA)('%s: no aparece ninguna fila de más', async (rol, filasEsperadas) => {
    await montar(rol);
    const todas = new Set(TABLA.flatMap(([, f]) => f.map(([l]) => l)));
    const propias = new Set(filasEsperadas.map(([l]) => l));
    for (const l of todas) {
      if (!propias.has(l)) expect(screen.queryByText(l)).toBeNull();
    }
  });

  test('las filas aparecen en el orden de la pantalla (trabajador de turnos)', async () => {
    await montar('trabajador_turnos');
    const orden = ['Rol', 'Perfil laboral', 'Mis postulaciones', 'Mis empresas', 'Mi disponibilidad', 'Mis ausencias', 'Mis contratos', 'Mis cuentas de cobro', 'Términos y condiciones'];
    const todos = screen.getAllByText(new RegExp(`^(${orden.join('|')})$`)).map((n) => n.props.children);
    expect(todos).toEqual(orden);
  });

  test('las filas aparecen en el orden de la pantalla (jefe de turnos y admin)', async () => {
    await montar('jefe_turnos');
    const o1 = ['Mi equipo', 'Solicitudes de ingreso', 'Gestión de turnos', 'Gestión de cargos', 'Reportes', 'Estado de sincronización', 'Puntos de marcaje'];
    expect(screen.getAllByText(new RegExp(`^(${o1.join('|')})$`)).map((n) => n.props.children)).toEqual(o1);
    await montar('admin_empresa');
    const o2 = ['Mi empresa', 'Mi plan', 'Gestores', 'Reportes', 'Crear gestor', 'Solicitudes de ingreso', 'Gestión de cargos', 'Puntos de marcaje', 'Integración logiq360'];
    const vistos = screen.getAllByText(new RegExp(`^(${o2.join('|')})$`)).map((n) => n.props.children);
    expect(vistos.slice(-o2.length)).toEqual(o2);
  });

  test('"Mi plan" e "Integración logiq360" son botones accesibles; el resto de filas de admin, no', async () => {
    await montar('admin_empresa');
    expect(screen.getByRole('button', { name: /Mi plan/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Integración logiq360/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Gestores/ })).toBeNull();
  });

  test('encabezados de sección: "Ausencias, contratos y cuentas de cobro" (turnos) vs "Ausencias y contratos" (nómina)', async () => {
    await montar('trabajador_turnos');
    expect(texto('Ausencias, contratos y cuentas de cobro')).toBeTruthy();
    expect(screen.queryByText('Mi nómina')).toBeNull();
    await montar('trabajador_nomina');
    expect(texto('Ausencias y contratos')).toBeTruthy();
    expect(texto('Mi nómina')).toBeTruthy();
  });

  test('las demás secciones siempre están: información personal, seguridad, cuenta, legal y zona de peligro', async () => {
    await montar('super_admin');
    filas(['Información personal', 'Seguridad', 'Cuenta', 'Legal', 'Zona de peligro']);
    expect(screen.queryByText('Ausencias y contratos')).toBeNull();
  });

  test('la fila "Rol" solo es la última (sin borde) cuando el rol no agrega más filas', async () => {
    await montar('trabajador_nomina');
    expect(claseDeFila('Rol')).not.toMatch(/border-b/);
    await montar('super_admin');
    expect(claseDeFila('Rol')).not.toMatch(/border-b/);
    await montar('trabajador_turnos');
    expect(claseDeFila('Rol')).toMatch(/border-b/);
    await montar('jefe_turnos');
    expect(claseDeFila('Rol')).toMatch(/border-b/);
    await montar('jefe_nomina');
    expect(claseDeFila('Rol')).toMatch(/border-b/);
    await montar('nomina');
    expect(claseDeFila('Rol')).toMatch(/border-b/);
    await montar('admin_empresa');
    expect(claseDeFila('Rol')).toMatch(/border-b/);
  });
});

describe('trabajador de nómina: turnos extra', () => {
  test('consulta su perfil de nómina solo si es trabajador de nómina', async () => {
    await montar('trabajador_nomina');
    expect(mockNominaEnabled).toBe(true);
    await montar('admin_empresa');
    expect(mockNominaEnabled).toBe(false);
  });

  test('el interruptor refleja acepta_extras; "Mis postulaciones extra" solo si está activo', async () => {
    mockNominaPerfil = { acepta_extras: false };
    const r = await montar('trabajador_nomina');
    expect(texto('Turnos extra')).toBeTruthy();
    expect(texto('Recibe ofertas de turnos adicionales fuera de tu jornada')).toBeTruthy();
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(false);
    expect(screen.queryByText('Mis postulaciones extra')).toBeNull();
    r.unmount();

    mockNominaPerfil = { acepta_extras: true };
    await montar('trabajador_nomina');
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(true);
    fireEvent.press(texto('Mis postulaciones extra'));
    expect(mockRouter.push).toHaveBeenCalledWith('/mis-postulaciones');
  });

  test('los iconos de "Turnos extra" y "Mis postulaciones extra"', async () => {
    mockNominaPerfil = { acepta_extras: true };
    await montar('trabajador_nomina');
    expect(within(filaDe('Turnos extra')).getByTestId('icon-briefcase-outline')).toBeTruthy();
    expect(within(filaDe('Mis postulaciones extra')).getByTestId('icon-list-outline')).toBeTruthy();
    expect(within(filaDe('Mis postulaciones extra')).getByTestId('icon-chevron-forward')).toBeTruthy();
  });

  test('sin datos de nómina el interruptor queda apagado', async () => {
    mockNominaPerfil = undefined;
    await montar('trabajador_nomina');
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(false);
  });

  test('cambiarlo llama a la mutación; si falla, avisa con el mensaje o el de por defecto', async () => {
    await montar('trabajador_nomina');
    fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', true);
    expect(mockExtras.mutate).toHaveBeenCalledTimes(1);
    expect(mockExtras.mutate.mock.calls[0][0]).toBe(true);
    const { onError } = mockExtras.mutate.mock.calls[0][1];
    onError({ message: 'No permitido' });
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'No permitido');
    onError({});
    expect(mockShowAlert).toHaveBeenLastCalledWith('Error', 'Algo salió mal');
  });

  test('mientras guarda se muestra un spinner en lugar del interruptor', async () => {
    mockExtras.isPending = true;
    await montar('trabajador_nomina');
    expect(screen.UNSAFE_queryByType(Switch)).toBeNull();
    expect(screen.getByTestId('spinner')).toBeTruthy();
  });
});

describe('foto de perfil', () => {
  const tocarFoto = () => act(async () => { fireEvent.press(screen.getByTestId('icon-camera')); });

  test('sin foto: el menú no ofrece quitar; con foto, sí', async () => {
    mockElegirFoto.mockResolvedValue(undefined);
    await montar();
    await tocarFoto();
    expect(mockElegirFoto).toHaveBeenCalledWith({ title: 'Foto de perfil', quitarLabel: undefined });
    await montar('trabajador_turnos', { foto_perfil: 'X' });
    await tocarFoto();
    expect(mockElegirFoto).toHaveBeenLastCalledWith({ title: 'Foto de perfil', quitarLabel: 'Quitar foto' });
  });

  test('elegir una foto la sube y actualiza la sesión', async () => {
    mockElegirFoto.mockResolvedValue('B64NUEVA');
    mockAuthApi.actualizarFoto.mockResolvedValue({ id: 7, nombre: 'Laura', foto_perfil: 'B64NUEVA' });
    await montar();
    await tocarFoto();
    expect(mockAuthApi.actualizarFoto).toHaveBeenCalledWith('B64NUEVA');
    expect(mockSetUsuario).toHaveBeenCalledWith({ id: 7, nombre: 'Laura', foto_perfil: 'B64NUEVA' });
  });

  test('quitar la foto sube null', async () => {
    mockElegirFoto.mockResolvedValue(null);
    mockAuthApi.actualizarFoto.mockResolvedValue({ id: 7 });
    await montar('trabajador_turnos', { foto_perfil: 'X' });
    await tocarFoto();
    expect(mockAuthApi.actualizarFoto).toHaveBeenCalledWith(null);
  });

  test('cancelar el menú no hace nada', async () => {
    mockElegirFoto.mockResolvedValue(undefined);
    await montar();
    await tocarFoto();
    expect(mockAuthApi.actualizarFoto).not.toHaveBeenCalled();
  });

  test('si falla: avisa con el mensaje o el de por defecto y no toca la sesión', async () => {
    mockElegirFoto.mockResolvedValue('B64');
    mockAuthApi.actualizarFoto.mockRejectedValueOnce({ message: 'Foto muy grande' });
    await montar();
    await tocarFoto();
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Foto muy grande');
    mockAuthApi.actualizarFoto.mockRejectedValueOnce({});
    await tocarFoto();
    expect(mockShowAlert).toHaveBeenLastCalledWith('Error', 'Algo salió mal');
    expect(mockSetUsuario).not.toHaveBeenCalled();
  });

  test('mientras sube la foto no se puede volver a abrir el menú', async () => {
    mockElegirFoto.mockResolvedValue('B64');
    mockAuthApi.actualizarFoto.mockImplementation(enCurso);
    await montar();
    await tocarFoto();
    expect(mockElegirFoto).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('avatar'));
    await act(async () => {});
    expect(mockElegirFoto).toHaveBeenCalledTimes(1);
  });

  test('mientras sube se ve el spinner y el botón de cámara desaparece', async () => {
    mockElegirFoto.mockResolvedValue('B64');
    let resolver: (v: unknown) => void = () => {};
    mockAuthApi.actualizarFoto.mockReturnValue(new Promise((ok) => { resolver = ok; }));
    await montar();
    await tocarFoto();
    expect(screen.getByTestId('spinner')).toBeTruthy();
    expect(screen.queryByTestId('icon-camera')).toBeNull();
    await act(async () => { resolver({ id: 7 }); });
    expect(screen.getByTestId('icon-camera')).toBeTruthy();
  });
});

describe('información personal', () => {
  test('en lectura muestra nombre, apellido y correo; faltantes con guion largo', async () => {
    await montar();
    filas(['Nombre', 'Laura', 'Apellido', 'Pérez', 'Correo electrónico']);
    expect(screen.getAllByText('laura@x.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('form-datos')).toBeNull();
    await montar('trabajador_turnos', { nombre: null, apellido: null, email: null });
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  test('"Editar datos" abre el formulario con los valores actuales; cancelar lo cierra', async () => {
    await montar();
    fireEvent.press(texto('Editar datos'));
    expect(screen.getByTestId('form-datos')).toBeTruthy();
    expect(mockEditProps).toMatchObject({ initialNombre: 'Laura', initialApellido: 'Pérez', initialEmail: 'laura@x.com', loading: false });
    fireEvent.press(screen.getByTestId('datos-cancelar'));
    expect(screen.queryByTestId('form-datos')).toBeNull();
  });

  test('con datos vacíos el formulario recibe cadenas vacías', async () => {
    await montar('trabajador_turnos', { nombre: null, apellido: null, email: null });
    fireEvent.press(texto('Editar datos'));
    expect(mockEditProps).toMatchObject({ initialNombre: '', initialApellido: '', initialEmail: '' });
  });

  test('guardar envía los datos, actualiza la sesión, avisa y cierra el formulario', async () => {
    mockAuthApi.updateProfile.mockResolvedValue({ id: 7, nombre: 'Ana' });
    await montar();
    fireEvent.press(texto('Editar datos'));
    await act(async () => { fireEvent.press(screen.getByTestId('datos-guardar')); });
    expect(mockAuthApi.updateProfile).toHaveBeenCalledWith({ nombre: 'Ana', apellido: 'Gómez', email: 'ana@x.com' });
    expect(mockSetUsuario).toHaveBeenCalledWith({ id: 7, nombre: 'Ana' });
    expect(mockShowToast).toHaveBeenCalledWith('Datos actualizados correctamente.');
    expect(screen.queryByTestId('form-datos')).toBeNull();
  });

  test('si falla: avisa y deja el formulario abierto', async () => {
    mockAuthApi.updateProfile.mockRejectedValueOnce({ message: 'Correo en uso' });
    await montar();
    fireEvent.press(texto('Editar datos'));
    await act(async () => { fireEvent.press(screen.getByTestId('datos-guardar')); });
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Correo en uso');
    expect(screen.getByTestId('form-datos')).toBeTruthy();
    expect(mockSetUsuario).not.toHaveBeenCalled();
    mockAuthApi.updateProfile.mockRejectedValueOnce({});
    await act(async () => { fireEvent.press(screen.getByTestId('datos-guardar')); });
    expect(mockShowAlert).toHaveBeenLastCalledWith('Error', 'Algo salió mal');
  });

  test('mientras guarda el formulario recibe loading', async () => {
    mockAuthApi.updateProfile.mockReset();
    mockAuthApi.updateProfile.mockImplementation(enCurso);
    await montar();
    fireEvent.press(texto('Editar datos'));
    await act(async () => { fireEvent.press(screen.getByTestId('datos-guardar')); });
    await waitFor(() => expect(mockEditProps.loading).toBe(true));
  });
});

describe('seguridad: contraseña y biometría', () => {
  test('los iconos de "Cambiar contraseña" y del bloqueo biométrico', async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    await montar();
    expect(within(filaDe('Cambiar contraseña')).getByTestId('icon-key-outline')).toBeTruthy();
    expect(within(filaDe('Cambiar contraseña')).getByTestId('icon-chevron-forward')).toBeTruthy();
    expect(within(filaDe('Bloqueo biométrico')).getByTestId('icon-finger-print')).toBeTruthy();
  });

  test('"Cambiar contraseña" abre el formulario y cancelar lo cierra', async () => {
    await montar();
    expect(screen.queryByTestId('form-password')).toBeNull();
    fireEvent.press(texto('Cambiar contraseña'));
    expect(screen.getByTestId('form-password')).toBeTruthy();
    expect(screen.queryByText('Bloqueo biométrico')).toBeNull(); // el formulario reemplaza toda la tarjeta
    fireEvent.press(screen.getByTestId('pass-cancelar'));
    expect(screen.queryByTestId('form-password')).toBeNull();
  });

  test('guardar envía las contraseñas, cierra, avisa y cierra la sesión', async () => {
    mockAuthApi.changePassword.mockResolvedValue(null);
    await montar();
    fireEvent.press(texto('Cambiar contraseña'));
    await act(async () => { fireEvent.press(screen.getByTestId('pass-guardar')); });
    expect(mockAuthApi.changePassword).toHaveBeenCalledWith({ password_actual: 'vieja123', password_nueva: 'nueva1234' });
    expect(screen.queryByTestId('form-password')).toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith('Contraseña actualizada. Inicia sesión de nuevo.');
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  test('si falla: avisa, no cierra sesión y deja el formulario', async () => {
    mockAuthApi.changePassword.mockRejectedValueOnce({ message: 'Contraseña incorrecta' });
    await montar();
    fireEvent.press(texto('Cambiar contraseña'));
    await act(async () => { fireEvent.press(screen.getByTestId('pass-guardar')); });
    expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Contraseña incorrecta');
    expect(mockLogout).not.toHaveBeenCalled();
    expect(screen.getByTestId('form-password')).toBeTruthy();
    mockAuthApi.changePassword.mockRejectedValueOnce({});
    await act(async () => { fireEvent.press(screen.getByTestId('pass-guardar')); });
    expect(mockShowAlert).toHaveBeenLastCalledWith('Error', 'Algo salió mal');
  });

  test('mientras cambia la contraseña el formulario recibe loading', async () => {
    mockAuthApi.changePassword.mockReset();
    mockAuthApi.changePassword.mockImplementation(enCurso);
    await montar();
    fireEvent.press(texto('Cambiar contraseña'));
    await act(async () => { fireEvent.press(screen.getByTestId('pass-guardar')); });
    await waitFor(() => expect(mockPassProps.loading).toBe(true));
  });

  test.each([
    ['sin hardware', false, true],
    ['sin huella registrada', true, false],
    ['ninguno', false, false],
  ])('biometría no disponible (%s): no aparece el bloqueo', async (_n, hw, enrolled) => {
    mockHasHardware.mockResolvedValue(hw);
    mockIsEnrolled.mockResolvedValue(enrolled);
    await montar();
    expect(screen.queryByText('Bloqueo biométrico')).toBeNull();
  });

  test('biometría disponible: aparece con el valor guardado; activarla y desactivarla lo guarda', async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    mockGetItem.mockResolvedValue('1');
    await montar();
    expect(mockGetItem).toHaveBeenCalledWith('appturnos.biometric_enabled');
    expect(texto('Bloqueo biométrico')).toBeTruthy();
    const sw = screen.UNSAFE_getByType(Switch);
    expect(sw.props.value).toBe(true);
    await act(async () => { fireEvent(sw, 'valueChange', false); });
    expect(mockSetItem).toHaveBeenLastCalledWith('appturnos.biometric_enabled', '0');
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(false);
    await act(async () => { fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', true); });
    expect(mockSetItem).toHaveBeenLastCalledWith('appturnos.biometric_enabled', '1');
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(true);
  });

  test('biometría disponible sin preferencia guardada: apagada', async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    mockGetItem.mockResolvedValue('0');
    await montar();
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(false);
  });
});

describe('cerrar sesión', () => {
  test('pide confirmación (destructiva) y, si se acepta, cierra y muestra el spinner', async () => {
    let terminar: () => void = () => {};
    mockLogout.mockReturnValue(new Promise<void>((ok) => { terminar = ok; }));
    await montar();
    await act(async () => { fireEvent.press(texto('Cerrar sesión')); });
    expect(mockConfirm).toHaveBeenCalledWith({
      title: 'Cerrar sesión', message: '¿Estás seguro de que deseas cerrar sesión?',
      cancelLabel: 'Cancelar', confirmLabel: 'Cerrar sesión', destructive: true,
    });
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('spinner')).toBeTruthy();
    expect(screen.queryByText('Cerrar sesión')).toBeNull();
    await act(async () => { terminar(); });
  });

  test('mientras cierra la sesión el botón no responde', async () => {
    mockLogout.mockImplementation(enCurso);
    await montar();
    await act(async () => { fireEvent.press(texto('Cerrar sesión')); });
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('spinner'));
    await act(async () => {});
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  test('si no se confirma no hace nada', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    await montar();
    await act(async () => { fireEvent.press(texto('Cerrar sesión')); });
    expect(mockLogout).not.toHaveBeenCalled();
    expect(texto('Cerrar sesión')).toBeTruthy();
  });
});

describe('zona de peligro: eliminar cuenta', () => {
  test('pide confirmación con el aviso legal y, si se acepta, abre el formulario', async () => {
    await montar();
    await act(async () => { fireEvent.press(texto('Eliminar cuenta')); });
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(mockConfirm.mock.calls[0][0]).toMatchObject({
      title: 'Eliminar cuenta', cancelLabel: 'Cancelar', confirmLabel: 'Continuar', destructive: true,
    });
    expect(mockConfirm.mock.calls[0][0].message).toMatch(/hasta por 5 años/);
    expect(screen.getByTestId('form-eliminar')).toBeTruthy();
    expect(screen.queryByText('Eliminar cuenta')).toBeNull();
  });

  test('si no se confirma no se abre el formulario', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    await montar();
    await act(async () => { fireEvent.press(texto('Eliminar cuenta')); });
    expect(screen.queryByTestId('form-eliminar')).toBeNull();
  });

  test('cancelar el formulario vuelve al botón', async () => {
    await montar();
    await act(async () => { fireEvent.press(texto('Eliminar cuenta')); });
    fireEvent.press(screen.getByTestId('eliminar-cancelar'));
    expect(screen.queryByTestId('form-eliminar')).toBeNull();
    expect(texto('Eliminar cuenta')).toBeTruthy();
  });

  test('confirmar envía la contraseña y cierra la sesión', async () => {
    mockAuthApi.eliminarCuenta.mockResolvedValue(null);
    await montar();
    await act(async () => { fireEvent.press(texto('Eliminar cuenta')); });
    await act(async () => { fireEvent.press(screen.getByTestId('eliminar-confirmar')); });
    expect(mockAuthApi.eliminarCuenta).toHaveBeenCalledWith('mi-clave');
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  test('si falla: título propio, mensaje del servidor o el de por defecto; no cierra sesión', async () => {
    mockAuthApi.eliminarCuenta.mockRejectedValueOnce({ message: 'Contraseña incorrecta' });
    await montar();
    await act(async () => { fireEvent.press(texto('Eliminar cuenta')); });
    await act(async () => { fireEvent.press(screen.getByTestId('eliminar-confirmar')); });
    expect(mockShowAlert).toHaveBeenCalledWith('No se pudo eliminar la cuenta', 'Contraseña incorrecta');
    expect(mockLogout).not.toHaveBeenCalled();
    mockAuthApi.eliminarCuenta.mockRejectedValueOnce({});
    await act(async () => { fireEvent.press(screen.getByTestId('eliminar-confirmar')); });
    expect(mockShowAlert).toHaveBeenLastCalledWith('No se pudo eliminar la cuenta', 'Algo salió mal');
  });

  test('mientras elimina el formulario recibe loading', async () => {
    mockAuthApi.eliminarCuenta.mockReset();
    mockAuthApi.eliminarCuenta.mockImplementation(enCurso);
    await montar();
    await act(async () => { fireEvent.press(texto('Eliminar cuenta')); });
    await act(async () => { fireEvent.press(screen.getByTestId('eliminar-confirmar')); });
    await waitFor(() => expect(mockDeleteProps.loading).toBe(true));
  });
});

/**
 * Caracterización de la pantalla "Mi empresa" ANTES de partirla: congela lo que dibuja y lo que hace
 * (carga del formulario, guardar, validación, ciclo/régimen/recargos, mantener presionado para reprocesar,
 * logo, firma del representante y PDF de reglas de pago).
 */
import React from 'react';
import { Animated, Image } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MiEmpresaScreen from '../../app/mi-empresa';

// ── Bordes simulados ─────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, {
    get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} />,
  });
});
jest.mock('react-native-svg', () => {
  const { Text } = require('react-native');
  return { SvgXml: ({ xml }: { xml: string }) => <Text testID="svg">{xml}</Text> };
});
jest.mock('@/components/ui/Spinner', () => {
  const { View } = require('react-native');
  return { Spinner: () => <View testID="spinner" /> };
});

// useTheme lee el store de sesión (que arrastra notificaciones push y exige variables de entorno): se simula.
jest.mock('@/lib/theme', () => ({ useTheme: () => ({ primary: '#111111', primaryLight: '#222222' }) }));

const mockObtener = jest.fn();
const mockActualizar = jest.fn();
const mockReprocesar = jest.fn();
jest.mock('@api-client', () => ({
  ...jest.requireActual('@api-client'),
  empresasApi: {
    obtenerMiEmpresa: (...a: unknown[]) => mockObtener(...a),
    actualizarMiEmpresa: (...a: unknown[]) => mockActualizar(...a),
    reprocesarRecargos: (...a: unknown[]) => mockReprocesar(...a),
  },
}));

const mockShowAlert = jest.fn();
jest.mock('@/lib/alertDialog', () => ({ showAlert: (...a: unknown[]) => mockShowAlert(...a) }));
const mockConfirm = jest.fn();
jest.mock('@/lib/confirmDialog', () => ({ confirm: (...a: unknown[]) => mockConfirm(...a) }));
const mockShowToast = jest.fn();
jest.mock('@/lib/toast', () => ({ showToast: (...a: unknown[]) => mockShowToast(...a) }));
const mockElegirFoto = jest.fn();
jest.mock('@/lib/pickImage', () => ({ elegirFotoConMenu: (...a: unknown[]) => mockElegirFoto(...a) }));
const mockGetItem = jest.fn();
jest.mock('@/lib/secureStore', () => ({ webSafeSecureStore: { getItemAsync: (...a: unknown[]) => mockGetItem(...a) } }));
const mockOpenBrowser = jest.fn();
jest.mock('expo-web-browser', () => ({ openBrowserAsync: (...a: unknown[]) => mockOpenBrowser(...a) }));

jest.mock('@/features/turnos/SignaturePad', () => {
  const { Pressable, View, Text } = require('react-native');
  return {
    SignaturePad: (p: { visible: boolean; onClose: () => void; onConfirm: (b: string) => void; title: string; subtitle: string; confirmLabel: string; loading: boolean }) =>
      p.visible ? (
        <View testID="firma-pad">
          <Text testID="firma-titulo">{p.title}</Text>
          <Text testID="firma-subtitulo">{p.subtitle}</Text>
          <Text testID="firma-confirmar-label">{p.confirmLabel}</Text>
          <Pressable testID="firma-confirmar" onPress={() => p.onConfirm('FIRMA_B64')} />
          <Pressable testID="firma-cerrar" onPress={p.onClose} />
        </View>
      ) : null,
  };
});

// ── Datos ────────────────────────────────────────────────────────────────────
const EMPRESA = {
  nombre: 'Logística Demo S.A.S.',
  nit: '900.123.456-7',
  representante_nombre: 'Carlos Gómez',
  representante_cedula: '1.234.567.890',
  ciudad: 'Bogotá',
  actividad: 'Transporte de carga',
  descripcion: 'Empresa de logística',
  logo_url: '',
  acepta_postulaciones: 1,
  tipo_liquidacion: 'quincenal',
  tipo_contrato: 'laboral',
  sumar_nocturnas_festivo: 1,
  regla_domingo_habitual: 'ley',
  firma_representante_b64: null,
};

let qc: QueryClient;
function montar() {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <MiEmpresaScreen />
    </QueryClientProvider>,
  );
}
async function montarCargada(empresa: unknown = EMPRESA) {
  mockObtener.mockResolvedValue(empresa);
  montar();
  await screen.findByText('Datos legales');
}
const guardar = () => act(async () => { fireEvent.press(screen.getByText('Guardar cambios')); });

// El temporizador de recolección de la caché (5 min por defecto) mantendría vivo el proceso de Jest.
afterEach(() => { qc?.clear(); });

beforeEach(() => {
  jest.clearAllMocks();
  mockActualizar.mockResolvedValue({});
  mockReprocesar.mockResolvedValue({ periodo_id: 1, registros_actualizados: 3 });
  mockConfirm.mockResolvedValue(true);
  mockGetItem.mockResolvedValue('TOKEN123');
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
});

const PAYLOAD_BASE = {
  nombre: 'Logística Demo S.A.S.',
  nit: '900.123.456-7',
  representante_nombre: 'Carlos Gómez',
  representante_cedula: '1.234.567.890',
  ciudad: 'Bogotá',
  actividad: 'Transporte de carga',
  descripcion: 'Empresa de logística',
  logo_url: undefined,
  acepta_postulaciones: true,
  tipo_liquidacion: 'quincenal',
  tipo_contrato: 'laboral',
  sumar_nocturnas_festivo: true,
  regla_domingo_habitual: 'ley',
};

describe('carga', () => {
  test('mientras carga no muestra el formulario', () => {
    mockObtener.mockReturnValue(new Promise(() => {}));
    montar();
    expect(screen.queryByText('Datos legales')).toBeNull();
    expect(screen.queryByText('Guardar cambios')).toBeNull();
  });

  test('con datos: el formulario muestra cada campo y las secciones', async () => {
    await montarCargada();
    for (const t of ['Datos legales', 'Presentación pública', 'Ciclo de nómina', 'Régimen de contratación',
      'Cálculo de recargos', 'Visible en el directorio', 'Cómo calculamos los pagos', 'Firma del representante legal',
      'Toca el logo para cambiarlo', 'Cuándo un domingo es habitual']) {
      expect(screen.getByText(t)).toBeTruthy();
    }
    for (const v of ['Logística Demo S.A.S.', '900.123.456-7', 'Carlos Gómez', '1.234.567.890', 'Bogotá',
      'Transporte de carga', 'Empresa de logística']) {
      expect(screen.getByDisplayValue(v)).toBeTruthy();
    }
    expect(screen.getByText('Razón social *')).toBeTruthy();
    expect(screen.getByText('Toca para firmar')).toBeTruthy();
  });

  test('la descripción es un campo de varias líneas; los demás, de una', async () => {
    await montarCargada();
    const desc = screen.getByDisplayValue('Empresa de logística');
    expect(desc.props.multiline).toBe(true);
    expect(desc.props.numberOfLines).toBe(4);
    expect(screen.getByDisplayValue('Bogotá').props.multiline).toBeFalsy();
  });

  test('ciclo, régimen y recargos marcan la opción activa', async () => {
    await montarCargada();
    // ciclo (quincenal) y régimen (laboral) se resaltan solo por estilo; los recargos son radios accesibles
    const radios = screen.getAllByRole('radio');
    const estado = Object.fromEntries(radios.map((r) => [r.props.accessibilityState.checked, 0]));
    expect(Object.keys(estado).length).toBe(2); // hay marcados y sin marcar
    expect(screen.getByRole('radio', { name: /Con recargos/ }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('radio', { name: /Sin recargos/ }).props.accessibilityState.checked).toBe(false);
    expect(screen.getByRole('radio', { name: /3 o más domingos/ }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('radio', { name: /2 meses seguidos/ }).props.accessibilityState.checked).toBe(false);
  });

  test('empresa con datos vacíos: valores por defecto', async () => {
    await montarCargada({ nombre: null, acepta_postulaciones: 0, sumar_nocturnas_festivo: null });
    expect(screen.getByRole('radio', { name: /Con recargos/ }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('radio', { name: /3 o más domingos/ }).props.accessibilityState.checked).toBe(true);
    await act(async () => { fireEvent.changeText(screen.getByPlaceholderText('Logística Demo S.A.S.'), 'Solo nombre'); });
    await guardar();
    expect(mockActualizar.mock.calls[0][0]).toStrictEqual({
      nombre: 'Solo nombre', nit: undefined, representante_nombre: undefined, representante_cedula: undefined,
      ciudad: undefined, actividad: undefined, descripcion: undefined, logo_url: undefined,
      acepta_postulaciones: false, tipo_liquidacion: 'mensual', tipo_contrato: 'laboral',
      sumar_nocturnas_festivo: true, regla_domingo_habitual: 'ley',
    });
  });
});

describe('guardar', () => {
  test('sin cambios el botón no responde', async () => {
    await montarCargada();
    await guardar();
    expect(mockActualizar).not.toHaveBeenCalled();
  });

  test('con cambios envía todos los campos, avisa e invalida las cachés', async () => {
    await montarCargada();
    const inv = jest.spyOn(qc, 'invalidateQueries');
    fireEvent.changeText(screen.getByDisplayValue('Bogotá'), 'Medellín');
    await guardar();
    expect(mockActualizar).toHaveBeenCalledTimes(1);
    expect(mockActualizar.mock.calls[0][0]).toStrictEqual({ ...PAYLOAD_BASE, ciudad: 'Medellín' });
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Datos de la empresa actualizados.'));
    expect(inv).toHaveBeenCalledWith({ queryKey: ['mi-empresa'] });
    expect(inv).toHaveBeenCalledWith({ queryKey: ['periodos'] });
  });

  test('tras guardar vuelve a pedir la empresa al servidor', async () => {
    await montarCargada();
    expect(mockObtener).toHaveBeenCalledTimes(1);
    fireEvent.changeText(screen.getByDisplayValue('Bogotá'), 'Medellín');
    await guardar();
    await waitFor(() => expect(mockObtener).toHaveBeenCalledTimes(2));
  });

  test('razón social vacía: muestra el error y no guarda', async () => {
    await montarCargada();
    fireEvent.changeText(screen.getByDisplayValue('Logística Demo S.A.S.'), '   ');
    await guardar();
    expect(await screen.findByText('Razón social requerida')).toBeTruthy();
    expect(mockActualizar).not.toHaveBeenCalled();
  });

  test('si falla: avisa y no muestra el toast de éxito', async () => {
    mockActualizar.mockRejectedValue(new Error('x'));
    await montarCargada();
    fireEvent.changeText(screen.getByDisplayValue('Bogotá'), 'Cali');
    await guardar();
    await waitFor(() => expect(mockShowAlert).toHaveBeenCalledWith('Error', 'No se pudo guardar. Intenta de nuevo.'));
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  test('cada campo escribe en el suyo', async () => {
    await montarCargada();
    const cambios: [string, string][] = [
      ['Logística Demo S.A.S.', 'n1'], ['900.123.456-7', 'n2'], ['Carlos Gómez', 'n3'], ['1.234.567.890', 'n4'],
      ['Bogotá', 'n5'], ['Transporte de carga', 'n6'], ['Empresa de logística', 'n7'],
    ];
    for (const [a, b] of cambios) fireEvent.changeText(screen.getByDisplayValue(a), b);
    await guardar();
    expect(mockActualizar.mock.calls[0][0]).toStrictEqual({
      ...PAYLOAD_BASE, nombre: 'n1', nit: 'n2', representante_nombre: 'n3', representante_cedula: 'n4',
      ciudad: 'n5', actividad: 'n6', descripcion: 'n7',
    });
  });

  test('el interruptor del directorio cambia acepta_postulaciones', async () => {
    await montarCargada();
    const sw = screen.UNSAFE_getByType(require('react-native').Switch);
    expect(sw.props.value).toBe(true);
    fireEvent(sw, 'valueChange', false);
    await guardar();
    expect(mockActualizar.mock.calls[0][0]).toStrictEqual({ ...PAYLOAD_BASE, acepta_postulaciones: false });
  });
});

describe('ciclo de nómina y régimen', () => {
  test('elegir otro ciclo y otro régimen se envía al guardar', async () => {
    await montarCargada();
    fireEvent.press(screen.getByText('Semanal'));
    fireEvent.press(screen.getByText('Prestación de servicios'));
    await guardar();
    expect(mockActualizar.mock.calls[0][0]).toStrictEqual({
      ...PAYLOAD_BASE, tipo_liquidacion: 'semanal', tipo_contrato: 'prestacion_servicios',
    });
  });

  test('muestra las opciones con su descripción', async () => {
    await montarCargada();
    for (const t of ['Recargo nocturno y festivo según la ley', 'Normales hasta 42 h; después, extra diurna',
      'Mantén presionado para reprocesar el período', 'Mensual', 'Ej. 1–30 Jun', 'Quincenal', 'Ej. 1–15 / 16–30', 'Lun–Dom',
      'Contrato laboral', 'Descuenta salud y pensión', 'El independiente se autoliquida']) {
      expect(screen.getByText(t)).toBeTruthy();
    }
  });
});

describe('recargos', () => {
  test('dejar de sumar pide confirmación (destructiva) y solo cambia si se acepta', async () => {
    await montarCargada();
    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => { fireEvent.press(screen.getByText('Sin recargos')); });
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(mockConfirm.mock.calls[0][0]).toMatchObject({
      title: 'Dejar de sumar recargos', confirmLabel: 'Sí, dejar de sumar', destructive: true,
    });
    expect(mockConfirm.mock.calls[0][0].message).toMatch(/hasta 42 h a la semana/);
    expect(screen.getByText('Cuándo un domingo es habitual')).toBeTruthy(); // sigue sumando

    await act(async () => { fireEvent.press(screen.getByText('Sin recargos')); });
    expect(screen.queryByText('Cuándo un domingo es habitual')).toBeNull();
    expect(screen.getByText('Aviso sobre el cálculo')).toBeTruthy();
    await guardar();
    expect(mockActualizar.mock.calls[0][0]).toStrictEqual({ ...PAYLOAD_BASE, sumar_nocturnas_festivo: false });
  });

  test('volver a "Con recargos" no pide confirmación', async () => {
    mockConfirm.mockResolvedValue(true);
    await montarCargada({ ...EMPRESA, sumar_nocturnas_festivo: 0 });
    expect(screen.getByRole('radio', { name: /Con recargos/ }).props.accessibilityState.checked).toBe(false);
    await act(async () => { fireEvent.press(screen.getByText('Con recargos')); });
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Cuándo un domingo es habitual')).toBeTruthy();
  });

  test('elegir "Sin recargos" cuando ya está apagado no pide confirmación', async () => {
    await montarCargada({ ...EMPRESA, sumar_nocturnas_festivo: 0 });
    await act(async () => { fireEvent.press(screen.getByText('Sin recargos')); });
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  test('sin recargos: el aviso se muestra y se oculta', async () => {
    await montarCargada({ ...EMPRESA, sumar_nocturnas_festivo: 0 });
    expect(screen.queryByText(/Zaturno registra las horas trabajadas/)).toBeNull();
    fireEvent.press(screen.getByText('Aviso sobre el cálculo'));
    expect(screen.getByText(/Zaturno registra las horas trabajadas/)).toBeTruthy();
    fireEvent.press(screen.getByText('Ocultar aviso'));
    expect(screen.queryByText(/Zaturno registra las horas trabajadas/)).toBeNull();
  });

  test('la regla de domingo habitual se elige y se envía', async () => {
    await montarCargada();
    fireEvent.press(screen.getByText('2 meses seguidos trabajando domingos'));
    await guardar();
    expect(mockActualizar.mock.calls[0][0]).toStrictEqual({ ...PAYLOAD_BASE, regla_domingo_habitual: 'dos_meses' });
  });
});

describe('mantener presionado para reprocesar', () => {
  // Animated.timing se sustituye por un control manual: con temporizadores falsos la animación no avanza
  // de forma fiable. Se comprueba lo que la pantalla pide (1800 ms) y qué hace al completarse o cancelarse.
  let alTerminar: ((r: { finished: boolean }) => void) | undefined;
  const stop = jest.fn();
  let timing: jest.SpyInstance;
  // Se activa DESPUÉS de cargar: el esqueleto de carga también usa Animated.timing y no debe verse afectado.
  const activar = () => {
    alTerminar = undefined;
    stop.mockClear();
    timing = jest.spyOn(Animated, 'timing').mockImplementation(((_v: unknown, _c: unknown) => ({
      start: (cb: (r: { finished: boolean }) => void) => { alTerminar = cb; },
      stop,
    })) as never);
  };
  afterEach(() => timing?.mockRestore());

  test('solo en "Con recargos" activo: pide 1.8 s y, al completarse, reprocesa y avisa cuántos registros', async () => {
    await montarCargada(); activar();
    fireEvent(screen.getByRole('radio', { name: /Con recargos/ }), 'pressIn');
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][1]).toMatchObject({ toValue: 1, duration: 1800, useNativeDriver: false });
    expect(mockReprocesar).not.toHaveBeenCalled();
    await act(async () => { alTerminar!({ finished: true }); });
    expect(mockReprocesar).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('3 registro(s) recalculados.'));
  });

  test('si la animación se interrumpe (finished: false) no reprocesa', async () => {
    await montarCargada(); activar();
    fireEvent(screen.getByRole('radio', { name: /Con recargos/ }), 'pressIn');
    await act(async () => { alTerminar!({ finished: false }); });
    expect(mockReprocesar).not.toHaveBeenCalled();
  });

  test('soltar detiene la animación', async () => {
    await montarCargada(); activar();
    const con = screen.getByRole('radio', { name: /Con recargos/ });
    fireEvent(con, 'pressIn');
    fireEvent(con, 'pressOut');
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test('en "Sin recargos" no arranca nada aunque se mantenga', async () => {
    await montarCargada(); activar();
    fireEvent(screen.getByRole('radio', { name: /Sin recargos/ }), 'pressIn');
    expect(timing).not.toHaveBeenCalled();
  });

  test('"Con recargos" inactivo (empresa sin recargos) tampoco arranca', async () => {
    await montarCargada({ ...EMPRESA, sumar_nocturnas_festivo: 0 }); activar();
    fireEvent(screen.getByRole('radio', { name: /Con recargos/ }), 'pressIn');
    expect(timing).not.toHaveBeenCalled();
  });

  test('sin registros por recalcular: mensaje distinto; si falla: alerta', async () => {
    mockReprocesar.mockResolvedValueOnce({ periodo_id: 1, registros_actualizados: 0 });
    await montarCargada(); activar();
    fireEvent(screen.getByRole('radio', { name: /Con recargos/ }), 'pressIn');
    await act(async () => { alTerminar!({ finished: true }); });
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('No había registros por recalcular en el período abierto.'));

    mockReprocesar.mockRejectedValueOnce(new Error('x'));
    fireEvent(screen.getByRole('radio', { name: /Con recargos/ }), 'pressIn');
    await act(async () => { alTerminar!({ finished: true }); });
    await waitFor(() => expect(mockShowAlert).toHaveBeenCalledWith('Error', 'No se pudo reprocesar el período. Intenta de nuevo.'));
  });

  test('tras reprocesar invalida registros, períodos, liquidación y compensatorios', async () => {
    await montarCargada(); activar();
    const inv = jest.spyOn(qc, 'invalidateQueries');
    fireEvent(screen.getByRole('radio', { name: /Con recargos/ }), 'pressIn');
    await act(async () => { alTerminar!({ finished: true }); });
    await waitFor(() => expect(mockShowToast).toHaveBeenCalled());
    for (const k of ['registros', 'periodos', 'liquidacion', 'compensatorios']) {
      expect(inv).toHaveBeenCalledWith({ queryKey: [k] });
    }
  });
});

describe('logo', () => {
  const tocarLogo = () => act(async () => { fireEvent.press(screen.getByTestId('icon-business-outline')); });

  test('sin logo: ofrece solo elegir; con logo, también "Quitar logo"', async () => {
    mockElegirFoto.mockResolvedValue(undefined);
    await montarCargada();
    await tocarLogo();
    expect(mockElegirFoto).toHaveBeenCalledWith({ title: 'Logo de la empresa', quitarLabel: undefined });
  });

  test('con logo: dibuja la imagen y ofrece quitarlo', async () => {
    mockElegirFoto.mockResolvedValue(undefined);
    await montarCargada({ ...EMPRESA, logo_url: 'https://x.test/logo.png' });
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://x.test/logo.png' });
    expect(screen.queryByTestId('icon-business-outline')).toBeNull();
    fireEvent.press(screen.getByTestId('icon-camera'));
    await waitFor(() => expect(mockElegirFoto).toHaveBeenCalledWith({ title: 'Logo de la empresa', quitarLabel: 'Quitar logo' }));
  });

  test('elegir una foto la sube como data URI y avisa', async () => {
    mockElegirFoto.mockResolvedValue('B64LOGO');
    await montarCargada();
    await tocarLogo();
    expect(mockActualizar).toHaveBeenCalledWith({ logo_url: 'data:image/jpeg;base64,B64LOGO' });
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Logo actualizado.'));
  });

  test('quitar el logo envía cadena vacía y avisa', async () => {
    mockElegirFoto.mockResolvedValue(null);
    await montarCargada();
    await tocarLogo();
    expect(mockActualizar).toHaveBeenCalledWith({ logo_url: '' });
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Logo eliminado.'));
  });

  test('cancelar el selector no hace nada', async () => {
    mockElegirFoto.mockResolvedValue(undefined);
    await montarCargada();
    await tocarLogo();
    expect(mockActualizar).not.toHaveBeenCalled();
  });

  test('si falla al subir: alerta', async () => {
    mockElegirFoto.mockResolvedValue('B64LOGO');
    mockActualizar.mockRejectedValue(new Error('x'));
    await montarCargada();
    await tocarLogo();
    await waitFor(() => expect(mockShowAlert).toHaveBeenCalledWith('Error', 'No se pudo actualizar el logo. Intenta de nuevo.'));
  });
});

describe('firma del representante', () => {
  test('tocar abre el panel de firma con sus textos; cerrar lo oculta', async () => {
    await montarCargada();
    expect(screen.queryByTestId('firma-pad')).toBeNull();
    fireEvent.press(screen.getByText('Toca para firmar'));
    expect(screen.getByTestId('firma-pad')).toBeTruthy();
    expect(screen.getByTestId('firma-titulo').props.children).toBe('Firma del representante legal');
    expect(screen.getByTestId('firma-subtitulo').props.children).toBe('Se estampará en todos los contratos de prestación de servicios');
    expect(screen.getByTestId('firma-confirmar-label').props.children).toBe('Guardar firma');
    fireEvent.press(screen.getByTestId('firma-cerrar'));
    expect(screen.queryByTestId('firma-pad')).toBeNull();
  });

  test('confirmar guarda la firma al instante, cierra el panel y avisa', async () => {
    await montarCargada();
    fireEvent.press(screen.getByText('Toca para firmar'));
    await act(async () => { fireEvent.press(screen.getByTestId('firma-confirmar')); });
    expect(mockActualizar).toHaveBeenCalledWith({ firma_representante_b64: 'FIRMA_B64' });
    expect(screen.queryByTestId('firma-pad')).toBeNull();
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Firma del representante actualizada.'));
  });

  test('si falla al guardar la firma: alerta', async () => {
    mockActualizar.mockRejectedValue(new Error('x'));
    await montarCargada();
    fireEvent.press(screen.getByText('Toca para firmar'));
    await act(async () => { fireEvent.press(screen.getByTestId('firma-confirmar')); });
    await waitFor(() => expect(mockShowAlert).toHaveBeenCalledWith('Error', 'No se pudo guardar la firma. Intenta de nuevo.'));
  });

  test('una firma SVG (base64) se dibuja como SVG y se puede quitar', async () => {
    await montarCargada({ ...EMPRESA, firma_representante_b64: btoa('<svg id="firma"/>') });
    expect(screen.getByTestId('svg').props.children).toBe('<svg id="firma"/>');
    expect(screen.queryByText('Toca para firmar')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByText('Quitar firma')); });
    expect(mockActualizar).toHaveBeenCalledWith({ firma_representante_b64: '' });
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Firma eliminada.'));
  });

  test('una firma como imagen (data URI) no se dibuja como SVG pero ofrece quitarla', async () => {
    await montarCargada({ ...EMPRESA, firma_representante_b64: 'data:image/png;base64,AAAA' });
    expect(screen.queryByTestId('svg')).toBeNull();
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'data:image/png;base64,AAAA' });
    expect(screen.queryByText('Toca para firmar')).toBeNull();
    expect(screen.getByText('Quitar firma')).toBeTruthy();
  });

  test('si falla al quitar la firma: alerta', async () => {
    mockActualizar.mockRejectedValue(new Error('x'));
    await montarCargada({ ...EMPRESA, firma_representante_b64: 'data:image/png;base64,AAAA' });
    await act(async () => { fireEvent.press(screen.getByText('Quitar firma')); });
    await waitFor(() => expect(mockShowAlert).toHaveBeenCalledWith('Error', 'No se pudo eliminar la firma.'));
  });

  test('sin firma no hay "Quitar firma"', async () => {
    await montarCargada();
    expect(screen.queryByText('Quitar firma')).toBeNull();
  });
});

describe('PDF de reglas de pago', () => {
  test('abre el navegador con la URL y el token de la sesión', async () => {
    await montarCargada();
    await act(async () => { fireEvent.press(screen.getByText('Cómo calculamos los pagos')); });
    expect(mockGetItem).toHaveBeenCalledWith('appturnos.access_token');
    expect(mockOpenBrowser).toHaveBeenCalledWith('https://api.test/api/empresas/reglas-pago?token=TOKEN123');
  });
});

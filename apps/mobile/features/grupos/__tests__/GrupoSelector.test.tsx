/**
 * Selector de grupo del formulario de crear turno: solo aparece si la empresa usa grupos, usa la etiqueta de
 * la empresa como título (sin artículos, para cualquier nombre), y permite elegir, crear, usar el que ya
 * existe si el nombre se repite, y quitar.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GrupoSelector } from '../GrupoSelector';
import { formatShortDate } from '@/lib/formatters';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
// El dibujo del planeta (estados vacío y de error) usa piezas de react-native-svg que no hacen falta aquí.
jest.mock('@/components/ui/PlanetIllustration', () => ({ PlanetIllustration: () => null }));
jest.mock('@/components/ui/Spinner', () => {
  const { View } = require('react-native');
  return { Spinner: () => <View testID="spinner" /> };
});
jest.mock('@/lib/theme', () => ({ useTheme: () => ({ primary: '#111111', primaryLight: '#222222' }) }));
// El buscador de direcciones consulta un servicio externo: se simula con dos botones.
jest.mock('@/features/turnos/crear/LugarInput', () => {
  const { Pressable, Text } = require('react-native');
  return {
    LugarInput: ({ value, onChange }: { value: string; onChange: (l: string, a: number | null, o: number | null) => void }) => (
      <>
        <Text testID="lugar-valor">{value}</Text>
        <Pressable testID="lugar-elegir" onPress={() => onChange('Corferias', 4.63, -74.09)} />
        <Pressable testID="lugar-escribir" onPress={() => onChange('Cor', null, null)} />
      </>
    ),
  };
});

const mockOpciones = jest.fn();
const mockListar = jest.fn();
const mockCrear = jest.fn();
const mockObtener = jest.fn();
const mockPeriodos = jest.fn();
jest.mock('@api-client', () => ({
  ...jest.requireActual('@api-client'),
  nominaApi: { listarPeriodos: (...a: unknown[]) => mockPeriodos(...a) },
  empresasApi: { obtenerOpcionesGrupos: (...a: unknown[]) => mockOpciones(...a) },
  gruposTurnoApi: {
    listar: (...a: unknown[]) => mockListar(...a),
    crear: (...a: unknown[]) => mockCrear(...a),
    obtener: (...a: unknown[]) => mockObtener(...a),
  },
}));
const mockShowAlert = jest.fn();
jest.mock('@/lib/alertDialog', () => ({ showAlert: (...a: unknown[]) => mockShowAlert(...a) }));

const { ApiError } = jest.requireActual('@api-client');

const FERIA = { id: 3, empresa_id: 1, nombre: 'Feria del Libro', descripcion: null, lugar: 'Corferias', latitud: 4.63, longitud: -74.09,
  estado: 'activo', cerrado_at: null, created_at: '', total_turnos: 3, fecha_inicio: '2026-11-09', fecha_fin: '2026-11-11', fase: 'proximo' };
const OBRA = { ...FERIA, id: 4, nombre: 'Obra Norte', lugar: null, latitud: null, longitud: null, total_turnos: 0, fecha_inicio: null, fecha_fin: null, fase: 'sin_turnos' };
const ELEGIDO_FERIA = { id: 3, nombre: 'Feria del Libro', lugar: 'Corferias', lugar_alias: null, latitud: 4.63, longitud: -74.09 };

let qc: QueryClient;
function montar(grupo: unknown = null, onChange = jest.fn(), fecha = '2026-11-10') {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={qc}><GrupoSelector grupo={grupo as never} onChange={onChange} fecha={fecha} /></QueryClientProvider>);
  return onChange;
}
const conGrupos = (etiqueta: string | null = 'Evento') => mockOpciones.mockResolvedValue({ usa_grupos_turno: true, etiqueta_grupo: etiqueta });
const presionar = (nombre: string | RegExp) => act(async () => { fireEvent.press(screen.getByRole('button', { name: nombre })); });

beforeEach(() => {
  jest.clearAllMocks();
  mockListar.mockResolvedValue([FERIA, OBRA]);
  mockPeriodos.mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0 } }); // sin período del servidor: cae a la quincena
  conGrupos();
});
afterEach(() => { qc?.clear(); });

describe('visibilidad', () => {
  test('empresa que no usa grupos: no dibuja nada', async () => {
    mockOpciones.mockResolvedValue({ usa_grupos_turno: false, etiqueta_grupo: null });
    montar();
    await waitFor(() => expect(mockOpciones).toHaveBeenCalled());
    await act(async () => {}); // deja que la respuesta se refleje antes de comprobar que no hay nada
    expect(screen.queryByText('Evento')).toBeNull();
    expect(screen.queryByText('Elegir…')).toBeNull();
    expect(screen.queryByText('+ Crear')).toBeNull();
  });

  test('con grupos: la etiqueta de la empresa es el título y hay "Elegir…" y "+ Crear"', async () => {
    montar();
    expect(await screen.findByText('Evento')).toBeTruthy();
    expect(screen.getByText('Elegir…')).toBeTruthy();
    expect(screen.getByText('+ Crear')).toBeTruthy();
  });

  test('sin nombre propio el título es "Grupo"', async () => {
    conGrupos(null);
    montar();
    expect(await screen.findByText('Grupo')).toBeTruthy();
  });

  test('con un grupo elegido muestra su nombre, y "Cambiar" y "Quitar"', async () => {
    montar(ELEGIDO_FERIA);
    expect(await screen.findByText('Feria del Libro')).toBeTruthy();
    expect(screen.getByText('Cambiar')).toBeTruthy();
    expect(screen.queryByText('Elegir…')).toBeNull();
  });
});

describe('elegir un grupo existente', () => {
  test('la lista muestra fechas y cantidad de turnos para elegir bien, y elegir devuelve el grupo', async () => {
    const onChange = montar();
    await screen.findByText('Elegir…');
    await presionar('Elegir Evento');
    expect(await screen.findByText('Feria del Libro')).toBeTruthy();
    expect(screen.getByText(`${formatShortDate('2026-11-09')} – ${formatShortDate('2026-11-11')} · 3 turnos`)).toBeTruthy();
    expect(screen.getByText('Sin turnos todavía')).toBeTruthy();
    expect(mockListar).toHaveBeenCalledWith('activo'); // los cerrados no se ofrecen
    await act(async () => { fireEvent.press(screen.getByText('Feria del Libro')); });
    expect(onChange).toHaveBeenCalledWith(ELEGIDO_FERIA);
  });

  test('sin grupos todavía invita a crear el primero', async () => {
    mockListar.mockResolvedValue([]);
    montar();
    await screen.findByText('Elegir…');
    await presionar('Elegir Evento');
    expect(await screen.findByText('Todavía no hay nada')).toBeTruthy();
  });

  test('"Cambiar" abre la lista con el actual marcado', async () => {
    montar(ELEGIDO_FERIA);
    await screen.findByText('Cambiar');
    await presionar('Cambiar Evento');
    await screen.findByText('Obra Norte');
    expect(screen.getByRole('button', { name: /Feria del Libro/ }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('button', { name: /Obra Norte/ }).props.accessibilityState.selected).toBe(false);
  });

  test('"Quitar" deja el turno sin grupo', async () => {
    const onChange = montar(ELEGIDO_FERIA);
    await screen.findByText('Cambiar');
    await presionar('Quitar Evento');
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe('crear un grupo', () => {
  const abrirCrear = async () => { await screen.findByText('Elegir…'); await presionar('+ Crear'); await screen.findByText('Crear Evento'); };
  const escribirNombre = (t: string) => fireEvent.changeText(screen.getByPlaceholderText('Ej.: Feria del Libro 2026'), t);

  test('sin nombre muestra el error y no llama al servidor', async () => {
    montar();
    await abrirCrear();
    await presionar('Crear y usar');
    expect(screen.getByText('Escribe un nombre.')).toBeTruthy();
    expect(mockCrear).not.toHaveBeenCalled();
  });

  test('solo con nombre: lo crea sin lugar, lo deja elegido y cierra', async () => {
    mockCrear.mockResolvedValue({ ...OBRA, id: 9, nombre: 'Feria nueva' });
    const onChange = montar();
    await abrirCrear();
    escribirNombre('  Feria nueva ');
    await presionar('Crear y usar');
    expect(mockCrear).toHaveBeenCalledWith({ nombre: 'Feria nueva' }); // sin claves de lugar
    expect(onChange).toHaveBeenCalledWith({ id: 9, nombre: 'Feria nueva', lugar: null, lugar_alias: null, latitud: null, longitud: null });
    await waitFor(() => expect(screen.queryByText('Crear Evento')).toBeNull());
  });

  test('con una dirección elegida de la lista envía lugar y coordenadas juntos', async () => {
    mockCrear.mockResolvedValue({ ...FERIA, id: 10, nombre: 'Con lugar' });
    montar();
    await abrirCrear();
    escribirNombre('Con lugar');
    fireEvent.press(screen.getByTestId('lugar-elegir'));
    await presionar('Crear y usar');
    expect(mockCrear).toHaveBeenCalledWith({ nombre: 'Con lugar', lugar: 'Corferias', latitud: 4.63, longitud: -74.09 });
  });

  test('un lugar escrito a mano (sin dirección elegida) se rechaza antes de enviar', async () => {
    montar();
    await abrirCrear();
    escribirNombre('Con lugar');
    fireEvent.press(screen.getByTestId('lugar-escribir'));
    await presionar('Crear y usar');
    expect(screen.getByText('Elige una dirección de la lista, o deja el lugar vacío.')).toBeTruthy();
    expect(mockCrear).not.toHaveBeenCalled();
  });

  test('nombre repetido: avisa y "Usar ese" elige el grupo que ya existía', async () => {
    mockCrear.mockRejectedValue(new ApiError('Ya existe un grupo llamado "Feria del Libro".', undefined, 409, [{ campo: 'nombre', grupo_id: 3 }]));
    mockObtener.mockResolvedValue(FERIA);
    const onChange = montar();
    await abrirCrear();
    escribirNombre('Feria del Libro');
    await presionar('Crear y usar');
    // El aviso usa el nombre que escribió el usuario, sin la palabra "grupo" (la empresa los llama "Evento").
    expect(await screen.findByText('Ya existe «Feria del Libro».')).toBeTruthy();
    expect(screen.queryByText(/grupo/i)).toBeNull();
    await presionar('Usar ese');
    expect(mockObtener).toHaveBeenCalledWith(3);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(ELEGIDO_FERIA));
  });

  test('nombre repetido sin id del existente: avisa pero no ofrece "Usar ese"', async () => {
    mockCrear.mockRejectedValue(new ApiError('Ya existe un grupo llamado "X".', undefined, 409, [{ campo: 'nombre', grupo_id: null }]));
    montar();
    await abrirCrear();
    escribirNombre('X');
    await presionar('Crear y usar');
    expect(await screen.findByText('Ya existe «X».')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Usar ese' })).toBeNull();
  });

  test('otro error del servidor se avisa y no cierra', async () => {
    mockCrear.mockRejectedValue(new ApiError('Los grupos de turnos no están activados para tu empresa.', undefined, 403));
    montar();
    await abrirCrear();
    escribirNombre('Algo');
    await presionar('Crear y usar');
    await waitFor(() => expect(mockShowAlert).toHaveBeenCalledWith('Error', 'Los grupos de turnos no están activados para tu empresa.'));
    expect(screen.getByText('Crear Evento')).toBeTruthy();
  });

  test('"Crear" dentro de la lista cierra la lista y abre el formulario', async () => {
    montar();
    await screen.findByText('Elegir…');
    await presionar('Elegir Evento');
    await screen.findByText('Obra Norte');
    await presionar('Crear Evento');
    expect(await screen.findByText('Crear y usar')).toBeTruthy();
    expect(screen.queryByText('Obra Norte')).toBeNull();
  });
});

describe('por defecto solo los grupos con turnos del período de facturación', () => {
  const ENERO = { ...FERIA, id: 5, nombre: 'Gala de enero', lugar: 'Teatro Mayor', fecha_inicio: '2027-01-20', fecha_fin: '2027-01-22' };
  const NOV_TARDE = { ...FERIA, id: 6, nombre: 'Cierre de año', lugar: null, fecha_inicio: '2026-11-25', fecha_fin: '2026-11-26' };
  beforeEach(() => mockListar.mockResolvedValue([FERIA, OBRA, ENERO, NOV_TARDE]));

  const abrir = async (fecha?: string) => {
    montar(null, jest.fn(), fecha);
    await screen.findByText('Evento');
    await presionar(/Elegir Evento/);
    await screen.findByText('Obra Norte'); // sin turnos: está en cualquier período
  };

  test('muestra los del período (y los recién creados, sin turnos) y oculta los de otros períodos', async () => {
    await abrir('2026-11-10');
    expect(screen.getByText('Obra Norte')).toBeTruthy();
    expect(screen.queryByText('Gala de enero')).toBeNull();
    expect(screen.queryByText('Cierre de año')).toBeNull();
    expect(screen.getByText('Ver todos (4)')).toBeTruthy();
  });

  test('el período sale de la fecha del turno: el 25 de noviembre es la segunda quincena', async () => {
    await abrir('2026-11-25');
    expect(await screen.findByText('Cierre de año')).toBeTruthy();
    expect(screen.queryByText('Feria del Libro')).toBeNull();
  });

  test('«Ver todos» muestra todos y «Solo este período» vuelve al filtro', async () => {
    await abrir('2026-11-10');
    await presionar('Ver todos (4)');
    expect(screen.getByText('Gala de enero')).toBeTruthy();
    expect(screen.getByText('Cierre de año')).toBeTruthy();
    await presionar('Ver solo este período');
    expect(screen.queryByText('Gala de enero')).toBeNull();
  });

  test('buscar llega a cualquier grupo, también por lugar y sin tildes ni mayúsculas', async () => {
    await abrir('2026-11-10');
    fireEvent.changeText(screen.getByPlaceholderText('Buscar…'), 'TEATRO');
    expect(await screen.findByText('Gala de enero')).toBeTruthy();
    expect(screen.queryByText('Feria del Libro')).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText('Buscar…'), 'cierre de ano');
    expect(await screen.findByText('Cierre de año')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Buscar…'), 'zzz');
    expect(await screen.findByText('Sin resultados')).toBeTruthy();
  });

  test('el grupo ya elegido sigue en la lista aunque sea de otro período', async () => {
    montar({ id: 5, nombre: 'Gala de enero', lugar: null, lugar_alias: null, latitud: null, longitud: null }, jest.fn(), '2026-11-10');
    await screen.findByText('Evento');
    await presionar(/Cambiar Evento/);
    expect(await screen.findByText('Feria del Libro')).toBeTruthy();
    expect(screen.getAllByText('Gala de enero').length).toBeGreaterThan(1);
  });

  test('si nada cae en el período lo dice y ofrece «Ver todos»', async () => {
    mockListar.mockResolvedValue([ENERO, NOV_TARDE, { ...ENERO, id: 7, nombre: 'Otra gala' }, { ...ENERO, id: 8, nombre: 'Más gala' }, { ...ENERO, id: 9, nombre: 'Gala 5' }, { ...ENERO, id: 10, nombre: 'Gala 6' }]);
    montar(null, jest.fn(), '2026-12-05');
    await screen.findByText('Evento');
    await presionar(/Elegir Evento/);
    expect(await screen.findByText('Nada en este período')).toBeTruthy();
    await presionar(/Ver todos/);
    expect(await screen.findByText('Gala de enero')).toBeTruthy();
  });
});

describe('período real de la empresa', () => {
  const SEMANA = { ...FERIA, id: 11, nombre: 'Lunes de feria', lugar: null, fecha_inicio: '2026-11-09', fecha_fin: '2026-11-10' };
  const ANTES = { ...FERIA, id: 12, nombre: 'Montaje previo', lugar: null, fecha_inicio: '2026-11-03', fecha_fin: '2026-11-04' }; // misma quincena, otra semana
  const FIN_MES = { ...FERIA, id: 13, nombre: 'Cierre de mes', lugar: null, fecha_inicio: '2026-11-25', fecha_fin: '2026-11-26' };
  const periodo = (tipo: string, ini: string, fin: string) => ({ id: 1, empresa_id: 1, tipo, estado: 'abierto', fecha_inicio: ini, fecha_fin: fin });
  const abrir = async () => {
    montar(null, jest.fn(), '2026-11-10');
    await screen.findByText('Evento');
    await presionar(/Elegir Evento/);
    await screen.findByText('Obra Norte');
  };

  test('empresa semanal: solo la semana de la fecha, no toda la quincena', async () => {
    mockListar.mockResolvedValue([SEMANA, ANTES, OBRA]);
    mockPeriodos.mockResolvedValue({ data: [periodo('semanal', '2026-11-09', '2026-11-15')] });
    await abrir();
    expect(screen.getByText('Lunes de feria')).toBeTruthy();
    expect(screen.queryByText('Montaje previo')).toBeNull();
    expect(mockPeriodos).toHaveBeenCalledWith(expect.objectContaining({ fecha_desde: '2026-11-10', fecha_hasta: '2026-11-10' }));
  });

  test('empresa mensual: todo el mes, incluido lo que una quincena dejaría fuera', async () => {
    mockListar.mockResolvedValue([SEMANA, FIN_MES, OBRA]);
    mockPeriodos.mockResolvedValue({ data: [periodo('mensual', '2026-11-01T00:00:00.000Z', '2026-11-30T00:00:00.000Z')] });
    await abrir();
    expect(screen.getByText('Cierre de mes')).toBeTruthy();
  });

  test('si el servidor falla o no trae período, usa la quincena', async () => {
    mockListar.mockResolvedValue([ANTES, FIN_MES, OBRA]);
    mockPeriodos.mockRejectedValue(new Error('sin permiso'));
    await abrir();
    expect(screen.getByText('Montaje previo')).toBeTruthy();
    expect(screen.queryByText('Cierre de mes')).toBeNull();
  });
});

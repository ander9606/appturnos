/**
 * Pantallas "Grupos de turnos": la lista (activos/cerrados, apagado, vacío) y el detalle (turnos, agregar turno,
 * duplicar último, cerrar/reabrir). Los hooks se simulan: aquí se prueba lo que dibuja y lo que hace cada botón.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import GruposScreen from '../../app/grupos';
import GrupoDetalleScreen from '../../app/grupo/[id]';

const mockPush = jest.fn();
let mockTitulo: string | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockHeaderRight: (() => React.ReactElement) | undefined;
jest.mock('expo-router', () => ({
  Stack: { Screen: (p: { options: { title?: string; headerRight?: () => React.ReactElement } }) => { mockTitulo = p.options.title; mockHeaderRight = p.options.headerRight; return p.options.headerRight?.() ?? null; } },
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ id: '3' }),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
jest.mock('@/components/ui/PlanetIllustration', () => ({ PlanetIllustration: () => null }));
jest.mock('@/components/RoleGuard', () => ({ useRoleGuard: () => null }));
jest.mock('@/components/ui/Skeleton', () => {
  const { View } = require('react-native');
  return { SkeletonList: () => <View testID="skeleton" />, SkeletonDetail: () => <View testID="skeleton" />, Skeleton: () => <View testID="skeleton-linea" /> };
});
jest.mock('@/features/turnos/oferta/DuplicarOfertaModal', () => {
  const { Text } = require('react-native');
  return { DuplicarOfertaModal: ({ visible, oferta }: { visible: boolean; oferta: { id: number } }) =>
    (visible ? <Text testID="modal-duplicar">duplicar {oferta.id}</Text> : null) };
});
// El formulario de edición tiene su propia prueba (EditarGrupoModal.test.tsx): aquí solo importa cuándo se abre y con qué grupo.
jest.mock('@/features/grupos/EditarGrupoModal', () => {
  const { Text } = require('react-native');
  return { EditarGrupoModal: ({ visible, grupo }: { visible: boolean; grupo: { nombre: string } }) =>
    (visible ? <Text testID="modal-editar">{`editando ${grupo.nombre}`}</Text> : null) };
});
const mockSheet = jest.fn();
jest.mock('@/lib/actionSheet', () => ({ actionSheet: (...a: unknown[]) => mockSheet(...a) }));
const mockAlert = jest.fn();
jest.mock('@/lib/alertDialog', () => ({ showAlert: (...a: unknown[]) => mockAlert(...a) }));
const mockConfirm = jest.fn();
jest.mock('@/lib/confirmDialog', () => ({ confirm: (...a: unknown[]) => mockConfirm(...a) }));

let mockUsa = true;
let mockEtiqueta = 'Grupo';
jest.mock('@/features/empresas/useOpcionesGrupos', () => ({
  useOpcionesGrupos: () => ({ usa: mockUsa, etiqueta: mockEtiqueta, etiquetaPlural: `${mockEtiqueta}s`, isLoading: false }),
}));
const mockUseGrupos = jest.fn();
const mockUseGrupo = jest.fn();
const mockCambiar = jest.fn();
jest.mock('@/features/grupos/useGrupos', () => ({
  useGrupos: (...a: unknown[]) => mockUseGrupos(...a),
  useGrupo: (...a: unknown[]) => mockUseGrupo(...a),
  useCambiarEstadoGrupo: () => ({ mutateAsync: (...a: unknown[]) => mockCambiar(...a) }),
}));

const grupo = (extra = {}) => ({
  id: 3, nombre: 'Feria del Libro', descripcion: null, lugar: 'Corferias', estado: 'activo', fase: 'proximo',
  total_turnos: 2, fecha_inicio: '2030-01-14', fecha_fin: '2030-01-15', ...extra,
});
const turno = (id: number, fecha: string, extra = {}) => ({
  id, titulo: `Turno ${id}`, fecha, hora_inicio: '08:00:00', hora_fin_estimada: '17:00:00', fin_dia_siguiente: 0,
  lugar: null, estado: 'abierta', plazas: 4, plazas_cubiertas: 1, ...extra,
});
const listado = (data: unknown[] | undefined, extra = {}) => ({ data, isLoading: false, isError: false, isRefetching: false, refetch: jest.fn(), ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  mockUsa = true;
  mockEtiqueta = 'Grupo';
  mockTitulo = undefined;
  mockHeaderRight = undefined;
});

describe('lista de grupos', () => {
  test('dibuja una tarjeta por grupo, todas plegadas al principio', () => {
    mockUseGrupos.mockReturnValue(listado([grupo(), grupo({ id: 4, nombre: 'Obra Norte' })]));
    render(<GruposScreen />);
    expect(screen.getByText('Feria del Libro')).toBeTruthy();
    expect(screen.getByText('Obra Norte')).toBeTruthy();
    expect(screen.queryByText('Ocultar turnos')).toBeNull();
    expect(mockUseGrupo).not.toHaveBeenCalled(); // los turnos no se piden hasta desplegar
  });

  test('cada tarjeta es un solo toque para abrirla (sin fila de botones) y un lápiz para editar el grupo', () => {
    mockUseGrupos.mockReturnValue(listado([grupo(), grupo({ id: 4, nombre: 'Obra Norte', total_turnos: 1 })]));
    render(<GruposScreen />);
    expect(screen.getByLabelText('Ver 2 turnos de Feria del Libro')).toBeTruthy();
    expect(screen.getByLabelText('Ver 1 turno de Obra Norte')).toBeTruthy(); // singular
    expect(screen.queryByText('Editar')).toBeNull(); // ya no hay botón de texto: es un ícono con su etiqueta accesible
    expect(screen.queryByTestId('modal-editar')).toBeNull();
    fireEvent.press(screen.getByLabelText('Editar Obra Norte'));
    expect(screen.getByTestId('modal-editar').props.children).toBe('editando Obra Norte');
    expect(mockPush).not.toHaveBeenCalled(); // editar no cambia de pantalla
  });

  describe('la tarjeta se despliega y muestra sus turnos ahí mismo', () => {
    const conTurnos = (turnos: unknown[], extra = {}) =>
      mockUseGrupo.mockReturnValue({ data: { ...grupo(extra), turnos }, isLoading: false, isError: false, refetch: jest.fn() });

    test('al tocar "Ver 2 turnos" se despliegan sus turnos sin cambiar de pantalla; "Ocultar turnos" los pliega', () => {
      mockUseGrupos.mockReturnValue(listado([grupo()]));
      conTurnos([turno(10, '2030-01-14'), turno(11, '2030-01-15')]);
      render(<GruposScreen />);
      expect(screen.queryByText('Turno 10')).toBeNull(); // plegada: no se piden ni se ven
      expect(mockUseGrupo).not.toHaveBeenCalled();
      fireEvent.press(screen.getByLabelText('Ver 2 turnos de Feria del Libro'));
      expect(screen.getByText('Turno 10')).toBeTruthy();
      expect(screen.getByText('Turno 11')).toBeTruthy();
      expect(mockUseGrupo).toHaveBeenCalledWith(3);
      expect(mockPush).not.toHaveBeenCalled();
      fireEvent.press(screen.getByLabelText('Ocultar turnos de Feria del Libro'));
      expect(screen.queryByText('Turno 10')).toBeNull();
      expect(screen.getByLabelText('Ver 2 turnos de Feria del Libro').props.accessibilityState.expanded).toBe(false);
      expect(screen.getByTestId('icon-chevron-down')).toBeTruthy(); // el chevron indica que se puede abrir…
    });

    test('el chevron apunta hacia arriba mientras está desplegada', () => {
      mockUseGrupos.mockReturnValue(listado([grupo()]));
      conTurnos([turno(10, '2030-01-14')]);
      render(<GruposScreen />);
      fireEvent.press(screen.getByLabelText('Ver 2 turnos de Feria del Libro'));
      expect(screen.getByTestId('icon-chevron-up')).toBeTruthy();
      expect(screen.queryByTestId('icon-chevron-down')).toBeNull();
    });

    test('tocar el lápiz edita sin desplegar la tarjeta', () => {
      mockUseGrupos.mockReturnValue(listado([grupo()]));
      conTurnos([turno(10, '2030-01-14')]);
      render(<GruposScreen />);
      fireEvent.press(screen.getByLabelText('Editar Feria del Libro'));
      expect(screen.getByTestId('modal-editar')).toBeTruthy();
      expect(screen.queryByText('Turno 10')).toBeNull();
      expect(mockUseGrupo).not.toHaveBeenCalled();
    });

    test('se pueden desplegar varios grupos a la vez', () => {
      mockUseGrupos.mockReturnValue(listado([grupo(), grupo({ id: 4, nombre: 'Obra Norte' })]));
      mockUseGrupo.mockImplementation((id: number) => ({ data: { ...grupo({ id }), turnos: [turno(id * 10, '2030-01-14')] }, isLoading: false, isError: false, refetch: jest.fn() }));
      render(<GruposScreen />);
      fireEvent.press(screen.getByLabelText('Ver 2 turnos de Feria del Libro'));
      fireEvent.press(screen.getByLabelText('Ver 2 turnos de Obra Norte'));
      expect(screen.getByText('Turno 30')).toBeTruthy();
      expect(screen.getByText('Turno 40')).toBeTruthy();
    });

    test('tocar un turno abre ese turno; "Agregar turno" abre el asistente con el grupo; "Abrir grupo" abre el detalle', () => {
      mockUseGrupos.mockReturnValue(listado([grupo()]));
      conTurnos([turno(10, '2030-01-14')]);
      render(<GruposScreen />);
      fireEvent.press(screen.getByLabelText('Ver 2 turnos de Feria del Libro'));
      fireEvent.press(screen.getByText('Turno 10'));
      expect(mockPush).toHaveBeenLastCalledWith('/oferta/10');
      fireEvent.press(screen.getByText('Agregar turno'));
      expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/turno/nuevo', params: { grupoId: '3' } });
      fireEvent.press(screen.getByText('Abrir grupo'));
      expect(mockPush).toHaveBeenLastCalledWith('/grupo/3');
    });

    test('un grupo sin turnos lo dice; uno cerrado no ofrece "Agregar turno"', () => {
      mockUseGrupos.mockReturnValue(listado([grupo({ estado: 'cerrado', fase: 'cerrado', total_turnos: 0 })]));
      conTurnos([], { estado: 'cerrado', fase: 'cerrado' });
      render(<GruposScreen />);
      fireEvent.press(screen.getByLabelText('Ver 0 turnos de Feria del Libro'));
      expect(screen.getByText('Todavía no hay turnos aquí.')).toBeTruthy();
      expect(screen.queryByText('Agregar turno')).toBeNull();
      expect(screen.getByText('Abrir grupo')).toBeTruthy();
    });

    test('mientras cargan los turnos muestra un esqueleto, y si falla ofrece reintentar', () => {
      mockUseGrupos.mockReturnValue(listado([grupo()]));
      mockUseGrupo.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: jest.fn() });
      const { unmount } = render(<GruposScreen />);
      fireEvent.press(screen.getByLabelText('Ver 2 turnos de Feria del Libro'));
      expect(screen.getByLabelText('Cargando turnos')).toBeTruthy();
      unmount();
      const refetch = jest.fn();
      mockUseGrupo.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('x'), refetch });
      render(<GruposScreen />);
      fireEvent.press(screen.getByLabelText('Ver 2 turnos de Feria del Libro'));
      fireEvent.press(screen.getByText('Reintentar'));
      expect(refetch).toHaveBeenCalled();
    });
  });

  test('en la tarjeta se muestra el nombre corto del lugar si lo tiene', () => {
    mockUseGrupos.mockReturnValue(listado([grupo({ lugar: 'Corferias, Carrera 37, Quinta Paredes, Bogotá, Colombia', lugar_alias: 'Corferias' })]));
    render(<GruposScreen />);
    expect(screen.getByText('Corferias')).toBeTruthy();
    expect(screen.queryByText(/Quinta Paredes/)).toBeNull();
  });

  test('todo usa el nombre que la empresa le puso a los grupos, no «grupo»', () => {
    mockEtiqueta = 'Evento';
    mockUseGrupos.mockReturnValue(listado([]));
    render(<GruposScreen />);
    expect(mockTitulo).toBe('Eventos');
    expect(screen.getByText('Se crean desde «Nuevo turno» y aparecerán aquí.')).toBeTruthy();
  });

  test('apagado: el aviso nombra a la función con la etiqueta de la empresa', () => {
    mockEtiqueta = 'Obra';
    mockUsa = false;
    mockUseGrupos.mockReturnValue(listado(undefined));
    render(<GruposScreen />);
    expect(screen.getByText('«Obras» está apagado')).toBeTruthy();
  });

  test('"Abrir" del turno desplegado usa la etiqueta de la empresa', () => {
    mockEtiqueta = 'Evento';
    mockUseGrupos.mockReturnValue(listado([grupo()]));
    mockUseGrupo.mockReturnValue({ data: { ...grupo(), turnos: [turno(10, '2030-01-14')] }, isLoading: false, isError: false, refetch: jest.fn() });
    render(<GruposScreen />);
    fireEvent.press(screen.getByLabelText('Ver 2 turnos de Feria del Libro'));
    expect(screen.getByText('Abrir evento')).toBeTruthy();
    expect(screen.queryByText('Abrir grupo')).toBeNull();
  });

  test('con la función apagada avisa y no pide los grupos', () => {
    mockUsa = false;
    mockUseGrupos.mockReturnValue(listado(undefined));
    render(<GruposScreen />);
    expect(screen.getByText('«Grupos» está apagado')).toBeTruthy();
    expect(mockUseGrupos).toHaveBeenCalledWith('activo', false);
  });

  test('sin grupos activos ofrece crear un turno; la pestaña Cerrados pide los cerrados', () => {
    mockUseGrupos.mockReturnValue(listado([]));
    render(<GruposScreen />);
    fireEvent.press(screen.getByText('Nuevo turno'));
    expect(mockPush).toHaveBeenCalledWith('/turno/nuevo');
    fireEvent.press(screen.getByText('Cerrados'));
    expect(mockUseGrupos).toHaveBeenLastCalledWith('cerrado', true);
    expect(screen.getByText('Nada cerrado')).toBeTruthy();
  });
});

describe('detalle de un grupo', () => {
  const detalle = (extra = {}, turnos = [turno(10, '2030-01-14'), turno(11, '2030-01-15')]) =>
    mockUseGrupo.mockReturnValue(listado(undefined, { data: { ...grupo(), turnos, ...extra } }));

  /** Pulsa «⋯» del encabezado y elige esa opción del menú. */
  const elegir = async (key: string | null) => {
    mockSheet.mockResolvedValueOnce(key);
    fireEvent.press(screen.getByLabelText('Más opciones'));
    await waitFor(() => expect(mockSheet).toHaveBeenCalled());
  };
  const opciones = () => (mockSheet.mock.calls[0][0] as { items: { key: string; label: string }[] }).items;

  test('muestra el grupo, sus turnos y abre el turno tocado', () => {
    detalle();
    render(<GrupoDetalleScreen />);
    expect(mockTitulo).toBe('Feria del Libro'); // el nombre va en el encabezado, no se repite en el cuerpo
    expect(screen.getByText('Turno 11')).toBeTruthy();
    fireEvent.press(screen.getByText('Turno 10'));
    expect(mockPush).toHaveBeenCalledWith('/oferta/10');
  });

  test('«Editar» (en el menú «⋯») abre el formulario con este grupo, también si el grupo está cerrado', async () => {
    detalle();
    const { unmount } = render(<GrupoDetalleScreen />);
    await elegir('editar');
    expect(await screen.findByTestId('modal-editar')).toBeTruthy();
    expect(screen.getByTestId('modal-editar').props.children).toBe('editando Feria del Libro');
    unmount();
    mockSheet.mockClear();
    detalle({ estado: 'cerrado', fase: 'cerrado' });
    render(<GrupoDetalleScreen />);
    await elegir('editar');
    expect(opciones().map((o) => o.key)).toContain('editar');
  });

  test('las acciones secundarias están en un menú, no como botones apilados', () => {
    detalle();
    render(<GrupoDetalleScreen />);
    expect(screen.queryByText('Editar')).toBeNull();
    expect(screen.queryByText('Duplicar último turno')).toBeNull();
    expect(screen.queryByText('Cerrar grupo')).toBeNull();
    expect(mockHeaderRight).toBeDefined();
  });

  test('el detalle usa la etiqueta de la empresa en el menú (cerrar/reabrir)', async () => {
    mockEtiqueta = 'Evento';
    detalle();
    render(<GrupoDetalleScreen />);
    await elegir(null);
    expect(opciones().map((o) => o.label)).toContain('Cerrar evento');
    expect(opciones().map((o) => o.label)).not.toContain('Cerrar grupo');
  });

  test('"Agregar turno" abre el asistente con el grupo preseleccionado', () => {
    detalle();
    render(<GrupoDetalleScreen />);
    fireEvent.press(screen.getByLabelText('Agregar turno'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/turno/nuevo', params: { grupoId: '3' } });
  });

  test('«Duplicar último turno» copia el de fecha más reciente', async () => {
    detalle();
    render(<GrupoDetalleScreen />);
    expect(screen.queryByTestId('modal-duplicar')).toBeNull();
    await elegir('duplicar');
    expect(await screen.findByText('duplicar 11')).toBeTruthy();
  });

  test('sin turnos no ofrece duplicar', async () => {
    detalle({}, []);
    render(<GrupoDetalleScreen />);
    await elegir(null);
    expect(opciones().map((o) => o.key)).not.toContain('duplicar');
    expect(screen.getByText('Todavía no hay turnos')).toBeTruthy();
  });

  test('el resumen muestra turnos y plazas cubiertas sin contar los cancelados', () => {
    detalle({}, [turno(10, '2030-01-14', { plazas: 6, plazas_cubiertas: 4 }), turno(11, '2030-01-15', { plazas: 5, plazas_cubiertas: 1 }), turno(12, '2030-01-16', { estado: 'cancelada', plazas: 9, plazas_cubiertas: 9 })]);
    render(<GrupoDetalleScreen />);
    expect(screen.getByText('plazas cubiertas')).toBeTruthy();
    expect(screen.getByText(/5.*de 11/)).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  test('cerrar pide confirmación; si dice que no, no cierra', async () => {
    detalle();
    mockConfirm.mockResolvedValue(false);
    render(<GrupoDetalleScreen />);
    await elegir('estado');
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(mockCambiar).not.toHaveBeenCalled();
  });

  test('cerrar confirmado llama al servidor; un 409 muestra su motivo', async () => {
    detalle();
    mockConfirm.mockResolvedValue(true);
    const { ApiError } = jest.requireActual('@api-client');
    mockCambiar.mockRejectedValue(new ApiError('Tiene turnos sin terminar.', 409));
    render(<GrupoDetalleScreen />);
    await elegir('estado');
    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('No se pudo completar', 'Tiene turnos sin terminar.'));
    expect(mockCambiar).toHaveBeenCalledWith({ id: 3, cerrar: true });
  });

  const avisoCierre = () => {
    const { ApiError } = jest.requireActual('@api-client');
    return new ApiError('2 turnos terminados sin contrato firmado: su pago sigue frenado.', undefined, 409,
      [{ codigo: 'confirmar_cierre', turnos_sin_firma: 2 }]);
  };

  test('contratos sin firmar: no es un error, pregunta; si confirma, cierra con confirmar=true', async () => {
    detalle();
    mockConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(true); // 1.º "cerrar grupo", 2.º "cerrar de todos modos"
    mockCambiar.mockRejectedValueOnce(avisoCierre()).mockResolvedValueOnce({});
    render(<GrupoDetalleScreen />);
    await elegir('estado');
    await waitFor(() => expect(mockCambiar).toHaveBeenCalledWith({ id: 3, cerrar: true, confirmar: true }));
    expect(mockConfirm).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Hay pagos frenados', message: expect.stringContaining('sin contrato firmado') }));
    expect(mockAlert).not.toHaveBeenCalled();
  });

  test('contratos sin firmar: si no confirma, no cierra y no muestra error', async () => {
    detalle();
    mockConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mockCambiar.mockRejectedValueOnce(avisoCierre());
    render(<GrupoDetalleScreen />);
    await elegir('estado');
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(2));
    expect(mockCambiar).toHaveBeenCalledTimes(1);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  test('un grupo cerrado no deja agregar ni duplicar y ofrece reabrir sin confirmar', async () => {
    detalle({ estado: 'cerrado', fase: 'cerrado' });
    mockCambiar.mockResolvedValue({});
    render(<GrupoDetalleScreen />);
    expect(screen.queryByLabelText('Agregar turno')).toBeNull();
    await elegir('estado');
    expect(opciones().map((o) => o.key)).not.toContain('duplicar');
    expect(opciones().map((o) => o.label)).toContain('Reabrir grupo');
    await waitFor(() => expect(mockCambiar).toHaveBeenCalledWith({ id: 3, cerrar: false }));
    expect(mockConfirm).not.toHaveBeenCalled();
  });
});

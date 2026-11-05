/**
 * Pantallas "Grupos de turnos": la lista (activos/cerrados, apagado, vacío) y el detalle (turnos, agregar turno,
 * duplicar último, cerrar/reabrir). Los hooks se simulan: aquí se prueba lo que dibuja y lo que hace cada botón.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import GruposScreen from '../../app/grupos';
import GrupoDetalleScreen from '../../app/grupo/[id]';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
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
  return { SkeletonList: () => <View testID="skeleton" />, SkeletonDetail: () => <View testID="skeleton" /> };
});
jest.mock('@/features/turnos/oferta/DuplicarOfertaModal', () => {
  const { Text } = require('react-native');
  return { DuplicarOfertaModal: ({ visible, oferta }: { visible: boolean; oferta: { id: number } }) =>
    (visible ? <Text testID="modal-duplicar">duplicar {oferta.id}</Text> : null) };
});
const mockAlert = jest.fn();
jest.mock('@/lib/alertDialog', () => ({ showAlert: (...a: unknown[]) => mockAlert(...a) }));
const mockConfirm = jest.fn();
jest.mock('@/lib/confirmDialog', () => ({ confirm: (...a: unknown[]) => mockConfirm(...a) }));

let mockUsa = true;
jest.mock('@/features/empresas/useOpcionesGrupos', () => ({
  useOpcionesGrupos: () => ({ usa: mockUsa, etiqueta: 'Grupo', isLoading: false }),
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
});

describe('lista de grupos', () => {
  test('dibuja una tarjeta por grupo y al tocarla abre su detalle', () => {
    mockUseGrupos.mockReturnValue(listado([grupo(), grupo({ id: 4, nombre: 'Obra Norte' })]));
    render(<GruposScreen />);
    expect(screen.getByText('Obra Norte')).toBeTruthy();
    fireEvent.press(screen.getByText('Feria del Libro'));
    expect(mockPush).toHaveBeenCalledWith('/grupo/3');
  });

  test('con la función apagada avisa y no pide los grupos', () => {
    mockUsa = false;
    mockUseGrupos.mockReturnValue(listado(undefined));
    render(<GruposScreen />);
    expect(screen.getByText('Los grupos están apagados')).toBeTruthy();
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

  test('muestra el grupo, sus turnos y abre el turno tocado', () => {
    detalle();
    render(<GrupoDetalleScreen />);
    expect(screen.getAllByText('Feria del Libro').length).toBeGreaterThan(0);
    expect(screen.getByText('Turno 11')).toBeTruthy();
    fireEvent.press(screen.getByText('Turno 10'));
    expect(mockPush).toHaveBeenCalledWith('/oferta/10');
  });

  test('"Agregar turno" abre el asistente con el grupo preseleccionado', () => {
    detalle();
    render(<GrupoDetalleScreen />);
    fireEvent.press(screen.getByText('Agregar turno'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/turno/nuevo', params: { grupoId: '3' } });
  });

  test('"Duplicar último turno" copia el de fecha más reciente', async () => {
    detalle();
    render(<GrupoDetalleScreen />);
    expect(screen.queryByTestId('modal-duplicar')).toBeNull();
    fireEvent.press(screen.getByText('Duplicar último turno'));
    expect(await screen.findByText('duplicar 11')).toBeTruthy();
  });

  test('sin turnos no ofrece duplicar', () => {
    detalle({}, []);
    render(<GrupoDetalleScreen />);
    expect(screen.queryByText('Duplicar último turno')).toBeNull();
    expect(screen.getByText('Todavía no hay turnos')).toBeTruthy();
  });

  test('cerrar pide confirmación; si dice que no, no cierra', async () => {
    detalle();
    mockConfirm.mockResolvedValue(false);
    render(<GrupoDetalleScreen />);
    fireEvent.press(screen.getByText('Cerrar grupo'));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(mockCambiar).not.toHaveBeenCalled();
  });

  test('cerrar confirmado llama al servidor; un 409 muestra su motivo', async () => {
    detalle();
    mockConfirm.mockResolvedValue(true);
    const { ApiError } = jest.requireActual('@api-client');
    mockCambiar.mockRejectedValue(new ApiError('Tiene turnos sin terminar.', 409));
    render(<GrupoDetalleScreen />);
    fireEvent.press(screen.getByText('Cerrar grupo'));
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
    fireEvent.press(screen.getByText('Cerrar grupo'));
    await waitFor(() => expect(mockCambiar).toHaveBeenCalledWith({ id: 3, cerrar: true, confirmar: true }));
    expect(mockConfirm).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Hay pagos frenados', message: expect.stringContaining('sin contrato firmado') }));
    expect(mockAlert).not.toHaveBeenCalled();
  });

  test('contratos sin firmar: si no confirma, no cierra y no muestra error', async () => {
    detalle();
    mockConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mockCambiar.mockRejectedValueOnce(avisoCierre());
    render(<GrupoDetalleScreen />);
    fireEvent.press(screen.getByText('Cerrar grupo'));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(2));
    expect(mockCambiar).toHaveBeenCalledTimes(1);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  test('un grupo cerrado no deja agregar ni duplicar y ofrece reabrir sin confirmar', async () => {
    detalle({ estado: 'cerrado', fase: 'cerrado' });
    mockCambiar.mockResolvedValue({});
    render(<GrupoDetalleScreen />);
    expect(screen.queryByText('Agregar turno')).toBeNull();
    expect(screen.queryByText('Duplicar último turno')).toBeNull();
    fireEvent.press(screen.getByText('Reabrir grupo'));
    await waitFor(() => expect(mockCambiar).toHaveBeenCalledWith({ id: 3, cerrar: false }));
    expect(mockConfirm).not.toHaveBeenCalled();
  });
});

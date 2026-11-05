/**
 * La etiqueta del grupo en las tarjetas de turno: aparece cuando el turno tiene grupo (la ven todos los roles) y
 * no dibuja nada cuando no lo tiene, en cada tarjeta donde se muestra un turno.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { GrupoBadge } from '../GrupoBadge';
import { ShiftCard } from '@/features/turnos/ShiftCard';
import { NextShiftCard } from '@/features/dashboard/NextShiftCard';
import { ActiveShiftCard } from '@/features/dashboard/ActiveShiftCard';
import { TurnoHeroCard } from '@/features/turnos/detalle/TurnoHeroCard';
import { OfertaCard } from '@/features/turnos/pestana/OfertaCard';
import { InfoOfertaCard } from '@/features/turnos/oferta/InfoOfertaCard';
import { GestorTurnosView } from '@/features/turnos/GestorTurnosView';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
jest.mock('@/lib/theme', () => ({ useTheme: () => ({ primary: '#111111', primaryLight: '#222222' }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
// useTurnos arrastra la sesión (y exige variables de entorno): se simulan solo los hooks que usan estas tarjetas.
const mockOfertas = jest.fn();
jest.mock('@/features/turnos/useTurnos', () => ({
  useActualizarOferta: () => ({ mutateAsync: jest.fn() }),
  useOfertas: (...a: unknown[]) => mockOfertas(...a),
  useOferta: () => ({ data: undefined, isLoading: false }),
  useConfirmar: () => ({}), useRechazar: () => ({}), useCancelar: () => ({}), useNoPresentado: () => ({}),
  useEliminarOfertaDefinitivo: () => ({}),
}));
jest.mock('@/lib/confirmDialog', () => ({ confirm: jest.fn() }));
jest.mock('@/lib/alertDialog', () => ({ showAlert: jest.fn(), alertError: jest.fn() }));
jest.mock('@/lib/toast', () => ({ showToast: jest.fn() }));

const GRUPO = 'Feria del Libro';
const noop = () => {};
const asig = (grupo: string | null) => ({
  id: 1, empresa_id: 7, oferta_id: 5, trabajador_id: 2, estado: 'confirmado',
  oferta_titulo: 'Montaje stand', oferta_fecha: '2030-01-15', hora_inicio: '08:00:00', hora_fin_estimada: '17:00:00',
  fin_dia_siguiente: 0, lugar: 'Corferias', cargo_nombre: 'Auxiliar', tarifa_dia: 50000,
  grupo_id: grupo ? 3 : null, grupo_nombre: grupo,
}) as never;
const oferta = (grupo: string | null) => ({
  id: 5, empresa_id: 7, titulo: 'Montaje stand', fecha: '2030-01-15', hora_inicio: '08:00:00', hora_fin_estimada: '17:00:00',
  lugar: 'Corferias', latitud: null, longitud: null, estado: 'abierta', ubicacion_libre: 0, puestos: [
    { id: 1, cargo_id: 1, cargo_nombre: 'Auxiliar', plazas: 3, plazas_cubiertas: 1, tarifa_dia: 50000 },
  ], asignaciones: [], destinatarios: [], puntos_marcaje: [],
  grupo_id: grupo ? 3 : null, grupo_nombre: grupo,
}) as never;

const SUPERFICIES: [string, (g: string | null) => React.ReactElement][] = [
  ['lista de turnos del trabajador (ShiftCard)', (g) => <ShiftCard asignacion={asig(g)} />],
  ['próximo turno del inicio', (g) => <NextShiftCard turno={asig(g)} primaryColor="#111111" onPress={noop} onIngreso={noop} />],
  ['turno activo del inicio', (g) => <ActiveShiftCard turno={asig(g)} primaryColor="#111111" onPress={noop} onEgreso={noop} />],
  ['detalle de la asignación (héroe)', (g) => <TurnoHeroCard asignacion={asig(g)} estadoConfig={null} isGestor={false} onOpenMaps={noop} />],
  ['oferta disponible del trabajador', (g) => <OfertaCard item={oferta(g)} today="2030-01-01" yaAplicado={false} turnosConfirmados={[]} aplicando={false} onAplicar={noop} />],
  ['información de la oferta del gestor', (g) => <InfoOfertaCard oferta={oferta(g)} esPasado={false} puedeGestionar={false} ofertaEsEditable={false} />],
  ['lista de ofertas del gestor', (g) => {
    mockOfertas.mockReturnValue({ data: { data: [oferta(g)] }, isLoading: false, isError: false, refetch: noop, isRefetching: false });
    return <GestorTurnosView selectedDate="2030-01-15" puedeGestionar />;
  }],
];

describe('GrupoBadge', () => {
  test('muestra el nombre del grupo con su ícono', () => {
    render(<GrupoBadge nombre="  Feria del Libro " />);
    expect(screen.getByText(GRUPO)).toBeTruthy(); // recortado
    expect(screen.getByTestId('icon-albums-outline')).toBeTruthy();
  });
  test.each([[null], [undefined], [''], ['   ']])('sin grupo (%j) no dibuja nada', (nombre) => {
    render(<GrupoBadge nombre={nombre} />);
    expect(screen.toJSON()).toBeNull();
  });
  test('sobre fondo naranja usa texto blanco; sobre fondo claro, el naranja de marca oscuro (contraste)', () => {
    const { rerender } = render(<GrupoBadge nombre={GRUPO} />);
    expect(screen.getByText(GRUPO).props.className).toContain('text-primary-700');
    rerender(<GrupoBadge nombre={GRUPO} sobreMarca />);
    expect(screen.getByText(GRUPO).props.className).toContain('text-white');
  });
});

describe.each(SUPERFICIES)('%s', (_nombre, tarjeta) => {
  test('con grupo muestra la etiqueta', () => {
    render(tarjeta(GRUPO));
    expect(screen.getByText(GRUPO)).toBeTruthy();
    expect(screen.getByTestId('icon-albums-outline')).toBeTruthy();
  });
  test('sin grupo no muestra nada de grupo', () => {
    render(tarjeta(null));
    expect(screen.queryByText(GRUPO)).toBeNull();
    expect(screen.queryByTestId('icon-albums-outline')).toBeNull();
  });
});

test('la tarjeta de turno incluye el grupo en su descripción para lectores de pantalla, sin decir "grupo"', () => {
  render(<ShiftCard asignacion={asig(GRUPO)} onPress={noop} />);
  expect(screen.getByRole('button', { name: /Montaje stand, Feria del Libro, / })).toBeTruthy();
  render(<ShiftCard asignacion={asig(null)} onPress={noop} />);
  expect(screen.getAllByRole('button', { name: /^Montaje stand, [^,]*$/ }).length).toBeGreaterThan(0); // sin grupo: igual que antes
});

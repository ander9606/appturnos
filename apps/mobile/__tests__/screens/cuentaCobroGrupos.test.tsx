/**
 * La cuenta de cobro en pantalla: con turnos de grupos se ve agrupada, con un subtotal por grupo; sin grupos se ve
 * la tabla plana de siempre (nada de encabezados ni subtotales).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CuentaCobroScreen from '../../app/cuenta-cobro/[id]';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: '5' }),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
jest.mock('react-native-svg', () => ({ SvgXml: () => null }));
jest.mock('@/components/ui/PlanetIllustration', () => ({ PlanetIllustration: () => null }));
jest.mock('@/features/auth/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ usuario: { rol: 'admin_empresa', id: 1 } }) }));
jest.mock('@/features/nomina/descargarCuentaCobro', () => ({ descargarCuentaCobro: jest.fn() }));
jest.mock('@/features/turnos/SignaturePad', () => ({ SignaturePad: () => null }));

const mockObtener = jest.fn();
jest.mock('@api-client', () => ({ ...jest.requireActual('@api-client'), cuentasCobroApi: { obtener: (...a: unknown[]) => mockObtener(...a), firmar: jest.fn() } }));

const item = (n: number, valor: number, extra = {}) => ({
  asignacion_id: n, fecha: `2030-01-0${n}`, descripcion: `Turno ${n}`, cargo: 'Auxiliar', lugar: null, hora_inicio: '08:00:00', hora_fin: '16:00:00',
  horas: 8, valor_base: valor, pago_extra: 0, bono_monto: 0, bono_motivo: null, valor, ...extra,
});
const cuenta = (items: unknown[], valor_total: number) => ({
  id: 5, numero_cuenta: 'CC-1-2', secuencia: 1, fecha_inicio: '2030-01-01', fecha_fin: '2030-01-15', total_turnos: items.length, total_horas: items.length * 8,
  valor_total, firmado_trabajador: false, firmado_at: null, empresa_id: 1, periodo_id: 1, trabajador_id: 2, items, firma_b64: null, created_at: '2030-01-16',
  trabajador_nombre: 'Ana', trabajador_apellido: 'Test', trabajador_cedula: '1', empresa_nombre: 'Acme', empresa_nit: null,
  trabajador_banco: null, trabajador_tipo_cuenta: null, trabajador_numero_cuenta: null,
});
const pinta = async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><CuentaCobroScreen /></QueryClientProvider>);
  await screen.findByText('Turno 1');
};

test('con grupos: encabezado y subtotal por grupo, y "sin grupo" al final', async () => {
  mockObtener.mockResolvedValue(cuenta([
    item(1, 50000, { grupo_id: 3, grupo_nombre: 'Feria del Libro' }),
    item(2, 40000),
    item(3, 60000, { grupo_id: 3, grupo_nombre: 'Feria del Libro' }),
  ], 150000));
  await pinta();
  expect(screen.getByText('Feria del Libro')).toBeTruthy();
  expect(screen.getByText('Sin grupo')).toBeTruthy();
  expect(screen.getByText('Subtotal Feria del Libro')).toBeTruthy();
  expect(screen.getByText('Subtotal sin grupo')).toBeTruthy();
});

test('sin grupos: la tabla plana de siempre, sin encabezados ni subtotales', async () => {
  mockObtener.mockResolvedValue(cuenta([item(1, 50000), item(2, 60000)], 110000));
  await pinta();
  expect(screen.queryByText('Sin grupo')).toBeNull();
  expect(screen.queryByText(/^Subtotal/)).toBeNull();
});

/** Reporte por grupo: costo de cada evento/obra y su peso en el costo de turnos, con el nombre que la empresa eligió. */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PorGrupo } from '../PorGrupo';
import { formatCOP } from '@/lib/formatters';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('@/components/ui/Text');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockOpciones: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockQuery: any;
const mockUsar = jest.fn();
jest.mock('@/features/empresas/useOpcionesGrupos', () => ({ useOpcionesGrupos: () => mockOpciones }));
jest.mock('@tanstack/react-query', () => ({ useQuery: (o: unknown) => { mockUsar(o); return mockQuery; } }));

const G = (o: Record<string, unknown> = {}) => ({
  grupo_id: 1, nombre: 'Feria del libro', estado: 'activo', turnos: 2, convocados: 4, completados: 3, no_presentados: 1,
  costo: 300000, plazas: 5, cubiertas: 4, pct: 60, ...o,
});
const datos = (o: Record<string, unknown> = {}) => ({
  data: { rango: { desde: 'a', hasta: 'b' }, costo_total: 500000, sin_grupo: { completados: 0, costo: 0 }, grupos: [G()], ...o },
});

beforeEach(() => {
  mockUsar.mockClear();
  mockOpciones = { usa: true, etiqueta: 'Evento', etiquetaPlural: 'Eventos' };
  mockQuery = datos();
});

test('muestra cada grupo con su costo, turnos, ausencias, cobertura y peso en el total', () => {
  render(<PorGrupo desde="2031-03-01" hasta="2031-03-31" />);
  expect(screen.getByText('Costo por evento')).toBeTruthy();
  expect(screen.getByText('Feria del libro')).toBeTruthy();
  expect(screen.getByText(formatCOP(300000))).toBeTruthy();
  expect(screen.getByText('2 turnos · 3 completados · 1 ausencia · 4 de 5 plazas')).toBeTruthy();
  expect(screen.getByText('60 % del costo de turnos')).toBeTruthy();
});

test('usa el nombre que la empresa le puso a los grupos', () => {
  mockOpciones = { usa: true, etiqueta: 'Obra', etiquetaPlural: 'Obras' };
  render(<PorGrupo desde="a" hasta="b" />);
  expect(screen.getByText('Costo por obra')).toBeTruthy();
  expect(screen.queryByText(/evento/i)).toBeNull();
});

test('lo que no tiene grupo sale aparte; sin costo no aparece la fila', () => {
  mockQuery = datos({ sin_grupo: { completados: 2, costo: 200000 } });
  const { unmount } = render(<PorGrupo desde="a" hasta="b" />);
  expect(screen.getByText('Turnos sin evento')).toBeTruthy();
  expect(screen.getByText(formatCOP(200000))).toBeTruthy();
  unmount();
  mockQuery = datos();
  render(<PorGrupo desde="a" hasta="b" />);
  expect(screen.queryByText('Turnos sin evento')).toBeNull();
});

test('con más de 8 grupos muestra los 8 de más costo y cuenta el resto', () => {
  const grupos = Array.from({ length: 11 }, (_, i) => G({ grupo_id: i + 1, nombre: `G${i + 1}`, costo: 1000 - i }));
  mockQuery = datos({ grupos });
  render(<PorGrupo desde="a" hasta="b" />);
  expect(screen.getByText('G8')).toBeTruthy();
  expect(screen.queryByText('G9')).toBeNull();
  expect(screen.getByText('+3 más')).toBeTruthy();
});

test('no aparece ni pide nada si la empresa no usa grupos', () => {
  mockOpciones = { usa: false, etiqueta: 'Evento', etiquetaPlural: 'Eventos' };
  mockQuery = { data: undefined };
  const { toJSON } = render(<PorGrupo desde="a" hasta="b" />);
  expect(toJSON()).toBeNull();
  expect(mockUsar).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
});

test('no aparece sin grupos con turnos en el período, ni mientras carga', () => {
  mockQuery = datos({ grupos: [] });
  const a = render(<PorGrupo desde="a" hasta="b" />);
  expect(a.toJSON()).toBeNull();
  a.unmount();
  mockQuery = { data: undefined };
  expect(render(<PorGrupo desde="a" hasta="b" />).toJSON()).toBeNull();
});

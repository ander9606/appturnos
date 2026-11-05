import { aElegido, lugarEsDelGrupo, parcheAlElegirGrupo, rangoDeFechas, subtituloGrupo } from '../grupoUtils';
import { formatShortDate } from '@/lib/formatters';
import type { GrupoElegido } from '@/features/turnos/crear/types';

const FERIA: GrupoElegido = { id: 3, nombre: 'Feria', lugar: 'Corferias', latitud: 4.63, longitud: -74.09 };
const OBRA: GrupoElegido = { id: 4, nombre: 'Obra', lugar: 'Bodega Norte', latitud: 4.7, longitud: -74.1 };
const SIN_LUGAR: GrupoElegido = { id: 5, nombre: 'Proyecto', lugar: null, latitud: null, longitud: null };
const turno = (extra = {}) => ({ lugar: '', ubicacion_libre: false, grupo: null as GrupoElegido | null, ...extra });

describe('rangoDeFechas / subtituloGrupo', () => {
  test('sin turnos no hay rango', () => {
    expect(rangoDeFechas({ fecha_inicio: null, fecha_fin: null })).toBeNull();
    expect(subtituloGrupo({ fecha_inicio: null, fecha_fin: null, total_turnos: 0 })).toBe('Sin turnos todavía');
  });
  test('un solo día muestra una fecha; varios días, el rango', () => {
    expect(rangoDeFechas({ fecha_inicio: '2026-11-09', fecha_fin: '2026-11-09' })).toBe(formatShortDate('2026-11-09'));
    expect(rangoDeFechas({ fecha_inicio: '2026-11-09', fecha_fin: '2026-11-11' }))
      .toBe(`${formatShortDate('2026-11-09')} – ${formatShortDate('2026-11-11')}`);
  });
  test('el subtítulo cuenta los turnos en singular y plural', () => {
    expect(subtituloGrupo({ fecha_inicio: '2026-11-09', fecha_fin: '2026-11-09', total_turnos: 1 })).toMatch(/· 1 turno$/);
    expect(subtituloGrupo({ fecha_inicio: '2026-11-09', fecha_fin: '2026-11-11', total_turnos: 3 })).toMatch(/· 3 turnos$/);
  });
});

describe('parcheAlElegirGrupo', () => {
  test('turno sin lugar: toma el lugar del grupo (con sus coordenadas)', () => {
    expect(parcheAlElegirGrupo(turno(), FERIA)).toEqual({ grupo: FERIA, lugar: 'Corferias', lugar_alias: '', latitud: 4.63, longitud: -74.09 });
  });
  test('el nombre corto del lugar del grupo se copia al turno junto con el lugar', () => {
    const conAlias = { ...FERIA, lugar: 'Corferias, Carrera 37, Bogotá', lugar_alias: 'Corferias' };
    expect(parcheAlElegirGrupo(turno(), conAlias)).toMatchObject({ lugar: 'Corferias, Carrera 37, Bogotá', lugar_alias: 'Corferias' });
    expect(parcheAlElegirGrupo(turno({ lugar: 'Mi bodega' }), conAlias)).toEqual({ grupo: conAlias }); // no pisa un lugar propio, ni su nombre corto
  });
  test('nunca pisa un lugar que el usuario ya escribió', () => {
    expect(parcheAlElegirGrupo(turno({ lugar: 'Mi bodega' }), FERIA)).toEqual({ grupo: FERIA });
  });
  test('turno de ubicación libre: no se le pone lugar', () => {
    expect(parcheAlElegirGrupo(turno({ ubicacion_libre: true }), FERIA)).toEqual({ grupo: FERIA });
  });
  test('grupo sin lugar, o con lugar sin coordenadas, no cambia el del turno', () => {
    expect(parcheAlElegirGrupo(turno(), SIN_LUGAR)).toEqual({ grupo: SIN_LUGAR });
    expect(parcheAlElegirGrupo(turno(), { ...FERIA, latitud: null, longitud: null })).toEqual({ grupo: { ...FERIA, latitud: null, longitud: null } });
  });
  test('cambiar de grupo reemplaza el lugar que había puesto el anterior, pero no uno escrito a mano', () => {
    expect(parcheAlElegirGrupo(turno({ lugar: 'Corferias', grupo: FERIA }), OBRA))
      .toEqual({ grupo: OBRA, lugar: 'Bodega Norte', lugar_alias: '', latitud: 4.7, longitud: -74.1 });
    expect(parcheAlElegirGrupo(turno({ lugar: 'Otro sitio', grupo: FERIA }), OBRA)).toEqual({ grupo: OBRA });
  });
  test('quitar el grupo no borra el lugar', () => {
    expect(parcheAlElegirGrupo(turno({ lugar: 'Corferias', grupo: FERIA }), null)).toEqual({ grupo: null });
  });
});

describe('lugarEsDelGrupo', () => {
  test('solo si el lugar y las coordenadas son los del grupo', () => {
    expect(lugarEsDelGrupo({ lugar: 'Corferias', latitud: 4.63, longitud: -74.09, grupo: FERIA })).toBe(true);
    expect(lugarEsDelGrupo({ lugar: 'Corferias 2', latitud: 4.63, longitud: -74.09, grupo: FERIA })).toBe(false);
    expect(lugarEsDelGrupo({ lugar: 'Corferias', latitud: null, longitud: null, grupo: FERIA })).toBe(false);
    expect(lugarEsDelGrupo({ lugar: '', latitud: null, longitud: null, grupo: null })).toBe(false);
    expect(lugarEsDelGrupo({ lugar: '', latitud: null, longitud: null, grupo: SIN_LUGAR })).toBe(false);
  });
});

test('aElegido se queda solo con lo que usa el asistente', () => {
  const completo = { ...FERIA, empresa_id: 1, estado: 'activo', total_turnos: 3 } as never;
  expect(aElegido(completo)).toEqual({ ...FERIA, lugar_alias: null }); // sin nombre corto → null
});

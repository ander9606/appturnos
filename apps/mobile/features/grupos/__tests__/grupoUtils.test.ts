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

describe('ultimoTurnoCopiable', () => {
  const t = (id: number, fecha: string, hora_inicio = '08:00:00', estado = 'abierta') =>
    ({ id, titulo: `T${id}`, fecha, hora_inicio, estado }) as never;
  const { ultimoTurnoCopiable } = jest.requireActual('../grupoUtils');

  test('sin turnos no hay nada que copiar', () => {
    expect(ultimoTurnoCopiable([])).toBeNull();
  });
  test('elige el de fecha más reciente, sin importar el orden de la lista', () => {
    expect(ultimoTurnoCopiable([t(1, '2026-11-11'), t(2, '2026-11-09'), t(3, '2026-11-10')]).id).toBe(1);
  });
  test('el mismo día gana el de hora de inicio más tarde', () => {
    expect(ultimoTurnoCopiable([t(1, '2026-11-09', '08:00:00'), t(2, '2026-11-09', '14:00:00')]).id).toBe(2);
  });
  test('ignora los cancelados', () => {
    expect(ultimoTurnoCopiable([t(1, '2026-11-09'), t(2, '2026-11-12', '08:00:00', 'cancelada')]).id).toBe(1);
    expect(ultimoTurnoCopiable([t(1, '2026-11-09', '08:00:00', 'cancelada')])).toBeNull();
  });
});

describe('cambiosDeGrupo / formularioDeGrupo (editar un grupo)', () => {
  const { cambiosDeGrupo, formularioDeGrupo } = jest.requireActual('../grupoUtils');
  const form = (extra = {}) => ({ nombre: 'Feria', descripcion: '', lugar: '', lugarAlias: '', latitud: null, longitud: null, ...extra });

  test('sin nombre no se guarda', () => {
    expect(cambiosDeGrupo(form({ nombre: '   ' }))).toEqual({ ok: false, campo: 'nombre', mensaje: 'Escribe un nombre.' });
  });

  test('sin lugar manda en null el lugar, el nombre corto y las coordenadas (así se quitan)', () => {
    expect(cambiosDeGrupo(form({ nombre: ' Feria ', lugarAlias: 'Corferias' }))).toEqual({
      ok: true,
      payload: { nombre: 'Feria', descripcion: null, lugar: null, lugar_alias: null, latitud: null, longitud: null },
    });
  });

  test('una dirección escrita a mano (sin coordenadas) no se guarda: hay que elegirla de la lista', () => {
    expect(cambiosDeGrupo(form({ lugar: 'Calle 1', latitud: null, longitud: null }))).toMatchObject({ ok: false, campo: 'lugar' });
    expect(cambiosDeGrupo(form({ lugar: 'Calle 1', latitud: 4.6, longitud: null }))).toMatchObject({ ok: false, campo: 'lugar' });
  });

  test('con lugar y coordenadas manda todo junto; el texto vacío de descripción y nombre corto se quita', () => {
    expect(cambiosDeGrupo(form({ descripcion: '  Para la feria ', lugar: ' Corferias, Cra 37 ', lugarAlias: ' Corferias ', latitud: 4.63, longitud: -74.09 }))).toEqual({
      ok: true,
      payload: { nombre: 'Feria', descripcion: 'Para la feria', lugar: 'Corferias, Cra 37', lugar_alias: 'Corferias', latitud: 4.63, longitud: -74.09 },
    });
    expect(cambiosDeGrupo(form({ lugar: 'Corferias', lugarAlias: '  ', latitud: 4.63, longitud: -74.09 }))).toMatchObject({ ok: true, payload: { lugar_alias: null } });
  });

  test('formularioDeGrupo convierte lo guardado (nulls, y coordenadas que MySQL manda como texto)', () => {
    expect(formularioDeGrupo({ nombre: 'Feria', descripcion: null, lugar: null, lugar_alias: null, latitud: null, longitud: null }))
      .toEqual({ nombre: 'Feria', descripcion: '', lugar: '', lugarAlias: '', latitud: null, longitud: null });
    expect(formularioDeGrupo({ nombre: 'Feria', descripcion: 'x', lugar: 'C', lugar_alias: 'A', latitud: '4.63' as never, longitud: '-74.09' as never }))
      .toEqual({ nombre: 'Feria', descripcion: 'x', lugar: 'C', lugarAlias: 'A', latitud: 4.63, longitud: -74.09 });
  });
});

describe('período de facturación en el selector', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { periodoDeFecha, grupoEnPeriodo, coincideBusqueda } = require('../grupoUtils');

  test('periodoDeFecha: quincenas, fin de mes y febrero bisiesto', () => {
    expect(periodoDeFecha('2026-11-15')).toEqual({ desde: '2026-11-01', hasta: '2026-11-15' });
    expect(periodoDeFecha('2026-11-16')).toEqual({ desde: '2026-11-16', hasta: '2026-11-30' });
    expect(periodoDeFecha('2026-12-31')).toEqual({ desde: '2026-12-16', hasta: '2026-12-31' });
    expect(periodoDeFecha('2028-02-20')).toEqual({ desde: '2028-02-16', hasta: '2028-02-29' });
  });

  test('grupoEnPeriodo: traslape en cualquier borde, y sin turnos siempre cuenta', () => {
    const p = { desde: '2026-11-01', hasta: '2026-11-15' };
    expect(grupoEnPeriodo({ fecha_inicio: '2026-11-15', fecha_fin: '2026-11-20' }, p)).toBe(true); // empieza el último día
    expect(grupoEnPeriodo({ fecha_inicio: '2026-10-20', fecha_fin: '2026-11-01' }, p)).toBe(true); // termina el primer día
    expect(grupoEnPeriodo({ fecha_inicio: '2026-10-01', fecha_fin: '2026-12-01' }, p)).toBe(true); // lo cubre entero
    expect(grupoEnPeriodo({ fecha_inicio: '2026-11-16', fecha_fin: '2026-11-20' }, p)).toBe(false);
    expect(grupoEnPeriodo({ fecha_inicio: '2026-10-01', fecha_fin: '2026-10-31' }, p)).toBe(false);
    expect(grupoEnPeriodo({ fecha_inicio: null, fecha_fin: null }, p)).toBe(true);
  });

  test('coincideBusqueda: nombre, alias o lugar; sin tildes ni mayúsculas; vacío coincide con todo', () => {
    const g = { nombre: 'Feria del Libro', lugar: 'Corferias, Bogotá', lugar_alias: 'Ágora' };
    expect(coincideBusqueda(g, 'LIBRO')).toBe(true);
    expect(coincideBusqueda(g, 'bogota')).toBe(true);
    expect(coincideBusqueda(g, 'agora')).toBe(true);
    expect(coincideBusqueda(g, '   ')).toBe(true);
    expect(coincideBusqueda(g, 'concierto')).toBe(false);
    expect(coincideBusqueda({ nombre: 'X', lugar: null }, 'x')).toBe(true);
  });
});

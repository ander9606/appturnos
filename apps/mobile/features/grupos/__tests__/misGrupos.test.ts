import type { Asignacion } from '@api-client';
import { agruparMisTurnos, avisoSinFirmar, resumenAvance, tieneGrupos } from '../misGrupos';

let n = 0;
const a = (o: Partial<Asignacion> & Record<string, unknown> = {}): Asignacion => ({
  id: ++n, empresa_id: 1, oferta_id: n, estado: 'confirmado', oferta_fecha: '2030-01-10', hora_inicio: '08:00:00',
  grupo_id: 3, grupo_nombre: 'Feria', contrato_firmado: 1, ...o,
}) as unknown as Asignacion;

describe('agruparMisTurnos', () => {
  test('cuenta terminados, por hacer y sin firmar; fechas y próximo', () => {
    const [g] = agruparMisTurnos([
      a({ estado: 'completado', oferta_fecha: '2030-01-05', contrato_firmado: 0 }),
      a({ estado: 'completado', oferta_fecha: '2030-01-06', contrato_firmado: 1 }),
      a({ estado: 'confirmado', oferta_fecha: '2030-01-20' }),
      a({ estado: 'en_progreso', oferta_fecha: '2030-01-12' }),
    ]);
    expect(g).toMatchObject({ total: 4, terminados: 2, porHacer: 2, sinFirmar: 1, fechaInicio: '2030-01-05', fechaFin: '2030-01-20', proximo: '2030-01-12' });
    expect(g.turnos.map((t) => t.oferta_fecha)).toEqual(['2030-01-05', '2030-01-06', '2030-01-12', '2030-01-20']);
  });

  test('cancelados y los que no se presentó no cuentan; un fallido sí es terminado y nunca "sin firmar"', () => {
    const [g] = agruparMisTurnos([
      a({ estado: 'cancelado' }), a({ estado: 'no_presentado' }), a({ estado: 'fallido', contrato_firmado: 0 }),
    ]);
    expect(g).toMatchObject({ total: 1, terminados: 1, porHacer: 0, sinFirmar: 0, proximo: null });
  });

  test('un grupo del que todo se canceló no aparece', () => {
    expect(agruparMisTurnos([a({ estado: 'cancelado' })])).toEqual([]);
  });

  test('grupos con lo próximo primero (el más cercano arriba), luego los terminados (el más reciente arriba), y sin grupo al final', () => {
    const lista = agruparMisTurnos([
      a({ grupo_id: 1, grupo_nombre: 'Terminado viejo', estado: 'completado', oferta_fecha: '2030-01-01' }),
      a({ grupo_id: 2, grupo_nombre: 'Lejano', oferta_fecha: '2030-03-01' }),
      a({ grupo_id: null, grupo_nombre: null, oferta_fecha: '2030-01-02' }),
      a({ grupo_id: 3, grupo_nombre: 'Cercano', oferta_fecha: '2030-02-01' }),
      a({ grupo_id: 4, grupo_nombre: 'Terminado reciente', estado: 'completado', oferta_fecha: '2030-01-15' }),
    ]);
    expect(lista.map((g) => g.nombre)).toEqual(['Cercano', 'Lejano', 'Terminado reciente', 'Terminado viejo', null]);
  });

  test('el mismo grupo en dos empresas no se mezcla', () => {
    const lista = agruparMisTurnos([a({ empresa_id: 1 }), a({ empresa_id: 2 }), a({ empresa_id: 1 })]);
    expect(lista.map((g) => [g.clave, g.total])).toEqual([['1:3', 2], ['2:3', 1]]);
  });

  test('un grupo sin nombre usa «Grupo»', () => {
    expect(agruparMisTurnos([a({ grupo_nombre: null })])[0].nombre).toBe('Grupo');
  });
});

describe('textos', () => {
  test('tieneGrupos', () => {
    expect(tieneGrupos([a({ grupo_id: null }), a({ grupo_id: undefined })])).toBe(false);
    expect(tieneGrupos([a({ grupo_id: null }), a()])).toBe(true);
    expect(tieneGrupos([])).toBe(false);
  });

  test('avisoSinFirmar: singular, plural y nada', () => {
    expect(avisoSinFirmar(0)).toBeNull();
    expect(avisoSinFirmar(1)).toMatch(/^Tienes 1 turno terminado sin firmar el contrato\. No entra en tu cuenta de cobro/);
    expect(avisoSinFirmar(3)).toMatch(/^Tienes 3 turnos terminados sin firmar el contrato\. No entran/);
  });

  test('resumenAvance', () => {
    expect(resumenAvance({ total: 4, terminados: 2, porHacer: 2 })).toBe('2 de 4 terminados · 2 por hacer');
    expect(resumenAvance({ total: 1, terminados: 1, porHacer: 0 })).toBe('1 de 1 terminado');
  });
});

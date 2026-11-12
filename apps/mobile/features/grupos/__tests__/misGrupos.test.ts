import type { Asignacion } from '@api-client';
import { agruparMisTurnos, avisoSinFirmar, cobroDelTurno, nombresDeMisGrupos, resumenAvance, tieneGrupos } from '../misGrupos';
import { formatCOP } from '@/lib/formatters';

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

describe('vista propia del trabajador', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { soloConGrupo, faseDeMiGrupo, porcentajeAvance } = require('../misGrupos');

  test('soloConGrupo deja fuera los turnos sueltos', () => {
    const lista = agruparMisTurnos([a({ grupo_id: null, grupo_nombre: null }), a()]);
    expect(lista).toHaveLength(2);
    expect(soloConGrupo(lista).map((g: { nombre: string }) => g.nombre)).toEqual(['Feria']);
  });

  test('faseDeMiGrupo: terminado, en curso (ya empezó) o próximo', () => {
    expect(faseDeMiGrupo({ porHacer: 0, fechaInicio: '2030-01-01' }, '2030-01-10')).toBe('terminado');
    expect(faseDeMiGrupo({ porHacer: 2, fechaInicio: '2030-01-10' }, '2030-01-10')).toBe('en_curso'); // empieza hoy
    expect(faseDeMiGrupo({ porHacer: 2, fechaInicio: '2030-01-01' }, '2030-01-10')).toBe('en_curso');
    expect(faseDeMiGrupo({ porHacer: 2, fechaInicio: '2030-01-11' }, '2030-01-10')).toBe('proximo');
  });

  test('porcentajeAvance se redondea y no divide por cero', () => {
    expect(porcentajeAvance({ total: 3, terminados: 1 })).toBe(33);
    expect(porcentajeAvance({ total: 4, terminados: 4 })).toBe(100);
    expect(porcentajeAvance({ total: 0, terminados: 0 })).toBe(0);
  });
});

describe('el nombre de los grupos según la empresa de cada turno', () => {
  test('cada evento lleva la etiqueta de su empresa; sin etiqueta propia es «Grupo»', () => {
    const lista = agruparMisTurnos([
      a({ empresa_id: 1, grupo_id: 3, grupo_etiqueta: 'Evento' }),
      a({ empresa_id: 2, grupo_id: 5, grupo_etiqueta: 'Obra' }),
      a({ empresa_id: 3, grupo_id: 7, grupo_etiqueta: null }),
      a({ empresa_id: 4, grupo_id: 8, grupo_etiqueta: '   ' }),
    ]);
    expect(lista.map((g) => g.etiqueta).sort()).toEqual(['Evento', 'Grupo', 'Grupo', 'Obra']);
  });

  test('nombresDeMisGrupos: uno, dos, tres, ninguno, y sin repetir (ni por mayúsculas)', () => {
    const t = (grupo_etiqueta: string | null, grupo_id: number | null = 1) => ({ grupo_id, grupo_etiqueta });
    expect(nombresDeMisGrupos([t('Evento'), t('Evento'), t('evento')])).toBe('eventos');
    expect(nombresDeMisGrupos([t('Evento'), t('Obra')])).toBe('eventos y obras');
    expect(nombresDeMisGrupos([t('Evento'), t('Obra'), t('Proyecto')])).toBe('eventos, obras y proyectos');
    expect(nombresDeMisGrupos([t(null)])).toBe('grupos');
    expect(nombresDeMisGrupos([t('Lugar')])).toBe('lugares');
    expect(nombresDeMisGrupos([])).toBe('grupos');
  });

  test('los turnos sin grupo no aportan nombre', () => {
    expect(nombresDeMisGrupos([{ grupo_id: null, grupo_etiqueta: 'Evento' }, { grupo_id: 2, grupo_etiqueta: 'Obra' }])).toBe('obras');
  });
});

describe('acumulado por evento', () => {
  const p = (pago_total: unknown, o: Record<string, unknown> = {}) => a({ estado: 'completado', pago_total, ...o } as never);

  test('cobroDelTurno: bruto menos descuentos aceptados, nunca negativo, y acepta los números que MySQL manda como texto', () => {
    expect(cobroDelTurno({ pago_total: 100000, descuento_aceptado: 10000 })).toBe(90000);
    expect(cobroDelTurno({ pago_total: '100000.00' as never, descuento_aceptado: '2500.50' as never })).toBe(97499.5);
    expect(cobroDelTurno({ pago_total: 5000, descuento_aceptado: 9000 })).toBe(0);
    expect(cobroDelTurno({ pago_total: null, descuento_aceptado: null })).toBe(0);
    expect(cobroDelTurno({ pago_total: 40000 })).toBe(40000);
  });

  test('el acumulado suma lo terminado y firmado con sus descuentos; lo no firmado va aparte y no suma', () => {
    const [g] = agruparMisTurnos([
      p(100000, { descuento_aceptado: 10000, oferta_fecha: '2030-01-01' }),                       // 90.000 firmado
      p(50000, { oferta_fecha: '2030-01-02' }),                                                    // 50.000 firmado
      p(80000, { contrato_firmado: 0, oferta_fecha: '2030-01-03' }),                               // 80.000 por firmar
      a({ estado: 'fallido', pago_total: 30000, contrato_firmado: 0, oferta_fecha: '2030-01-04' }), // compensación: se paga sin firma
      a({ estado: 'confirmado', pago_total: 999999, oferta_fecha: '2030-01-30' }),                 // aún no se hace: no cuenta
    ] as never);
    expect(g.acumulado).toBe(90000 + 50000 + 30000);
    expect(g.porFirmar).toBe(80000);
    expect(g.sinFirmar).toBe(1);
  });

  test('un turno con la compensación sin responder (en espera) no suma, no cuenta como sin firmar y no cambia al responder', () => {
    const lista = (decision: unknown) => agruparMisTurnos([
      p(50000, { oferta_fecha: '2030-01-01' }),
      p(90000, { contrato_firmado: 0, compensacion_decision: decision, oferta_fecha: '2030-01-02' }),
      p(70000, { compensacion_decision: decision, oferta_fecha: '2030-01-03' }),
    ] as never)[0];
    const espera = lista('pendiente');
    expect(espera).toMatchObject({ acumulado: 50000, porFirmar: 0, sinFirmar: 0, terminados: 3 });
    expect(lista('autorizada')).toMatchObject({ acumulado: 120000, porFirmar: 90000 - 0, sinFirmar: 1 }); // vuelve a contar
    expect(lista('rechazada')).toMatchObject({ acumulado: 120000, sinFirmar: 1 });
  });

  test('un evento sin nada terminado acumula cero', () => {
    const [g] = agruparMisTurnos([a({ estado: 'confirmado', pago_total: 70000 })]);
    expect(g).toMatchObject({ acumulado: 0, porFirmar: 0 });
  });

  test('el aviso de contratos sin firmar dice cuánto está esperando la firma', () => {
    expect(avisoSinFirmar(1, 80000)).toContain(`(${formatCOP(80000)})`);
    expect(avisoSinFirmar(2, 0)).not.toContain('$');
    expect(avisoSinFirmar(0, 80000)).toBeNull();
  });
});

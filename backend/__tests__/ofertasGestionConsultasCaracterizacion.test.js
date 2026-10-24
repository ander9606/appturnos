'use strict';

// Test de caracterización de las 4 consultas de ofertas.gestion.service: destinatarios válidos,
// advertencia de cargos, candidatos a notificar por puesto y trabajadores sin "extras". Usa OfertasModel REAL
// (con spies solo en lo que no se prueba) y simula solo el borde (pool), así que vale igual si el SQL vive
// en el service o en el model. Se ejercita todo a través de OfertasService.crear.
jest.mock('../config/database', () => {
  const llamadas = [];
  let respuestas = [];
  const ejecutar = async (sql, params) => {
    sql = sql.replace(/\s+/g, ' ').trim();
    llamadas.push([sql, params]);
    for (const [re, valor] of respuestas) if (re.test(sql)) return valor;
    return [[]];
  };
  return { pool: { query: ejecutar, execute: ejecutar }, __llamadas: llamadas, __responder: (r) => { respuestas = r; } };
});
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.service');
jest.mock('../modules/cargos/cargos.model');
jest.mock('../modules/trabajadores/trabajadores.service');
jest.mock('../modules/puntos-marcaje/puntos-marcaje.model');
jest.mock('../modules/integracion/costo-labor.service');
jest.mock('../modules/turnos/periodos/periodos-turnos.service');
jest.mock('../modules/geocoding/geocoding.service');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { __llamadas: llamadas, __responder: responder } = require('../config/database');
const { DELAY_RANKING_SQL_CASE } = require('../utils/rankingUtils');
const CargosModel = require('../modules/cargos/cargos.model');
const Notificaciones = require('../modules/notificaciones/notificaciones.service');
const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const SQL_VALIDAR = "SELECT t.id FROM trabajadores t JOIN trabajador_empresa te ON te.trabajador_id = t.id WHERE t.id IN (?) AND te.empresa_id = ? AND te.estado = 'activo'";
const SQL_ADVERTENCIA = 'SELECT t.nombre, t.apellido FROM trabajadores t WHERE t.id IN (?) AND NOT EXISTS ( SELECT 1 FROM trabajador_empresa te JOIN trabajador_cargos tc ON tc.trabajador_empresa_id = te.id WHERE te.trabajador_id = t.id AND te.empresa_id = ? AND tc.cargo_id IN (?) )';
const SQL_SIN_EXTRAS = 'SELECT t.id AS trabajador_id FROM trabajadores t JOIN usuarios u ON u.id = t.usuario_id WHERE t.id IN (?) AND u.rol = ? AND t.acepta_extras = 0';
const SQL_PENDIENTES = norm(`SELECT DISTINCT u.id AS usuario_id
  FROM trabajador_cargos tc
  JOIN trabajador_empresa te ON te.id = tc.trabajador_empresa_id
  JOIN trabajadores t        ON t.id  = te.trabajador_id
  JOIN usuarios u            ON u.id  = t.usuario_id
  WHERE te.empresa_id = ?
    AND tc.cargo_id   = ?
    AND te.estado     = 'activo'
    AND u.activo      = 1
    AND u.rol IN (?)
    AND (u.rol != ? OR t.acepta_extras = 1)
    AND TIMESTAMPDIFF(MINUTE, ?, NOW()) >= ${DELAY_RANKING_SQL_CASE}
    AND NOT EXISTS (
      SELECT 1 FROM notificaciones n
      WHERE n.usuario_id = u.id AND n.tipo = 'oferta.nueva'
        AND CAST(n.data->>'$.oferta_id' AS UNSIGNED) = ?
        AND CAST(n.data->>'$.puesto_id' AS UNSIGNED) = ?
    )`);

const consulta = (frag) => llamadas.find(([s]) => s.includes(frag));
const puesto = { id: 20, cargo_id: 3, cargo_nombre: 'Mesero', plazas: 2, plazas_cubiertas: 0, tarifa_dia: 50000 };
const datosAbierta = { titulo: 'Evento', fecha: '2099-01-01', visibilidad: 'abierta', puestos: [{ cargo_id: 3, plazas: 2, tarifa_dia: 50000 }] };
const datosDirigida = { titulo: 'Privado', fecha: '2099-01-01', visibilidad: 'dirigida', trabajador_ids: [55, 56], puestos: [{ cargo_id: 3, plazas: 1, tarifa_dia: 50000 }] };

beforeEach(() => {
  llamadas.length = 0;
  jest.clearAllMocks();
  responder([]);
  CargosModel.obtenerPorId.mockResolvedValue({ id: 3, nombre: 'Mesero', activo: 1, empresa_id: 7 });
  CargosModel.contarActivosPorEmpresa.mockResolvedValue(99); // sin advertencia de capacidad
  jest.spyOn(OfertasModel, 'contarActivasPorEmpresa').mockResolvedValue(0);
  jest.spyOn(OfertasModel, 'crear').mockResolvedValue(1);
});

describe('aviso a candidatos por puesto (oferta abierta)', () => {
  const ofertaAbierta = (extra = {}) => ({
    id: 1, titulo: 'Evento', fecha: '2099-01-01', visibilidad: 'abierta', para_quien: 'ambos',
    created_at: '2026-01-01 10:00:00', puestos: [puesto], ...extra,
  });

  test('busca candidatos certificados y avisa a quienes ya les toca (consulta y parámetros literales)', async () => {
    jest.spyOn(OfertasModel, 'obtenerPorId').mockResolvedValue(ofertaAbierta());
    responder([[/SELECT DISTINCT u\.id AS usuario_id/, [[{ usuario_id: 501 }, { usuario_id: 502 }]]]]);

    await OfertasService.crear(7, datosAbierta, 1);

    const [sql, params] = consulta('SELECT DISTINCT u.id AS usuario_id');
    expect(sql).toBe(SQL_PENDIENTES);
    expect(params).toEqual([7, 3, ['trabajador_nomina', 'trabajador_turnos'], 'trabajador_nomina', '2026-01-01 10:00:00', 1, 20]);
    expect(Notificaciones.notificarVarios).toHaveBeenCalledWith([501, 502], expect.objectContaining({
      empresaId: 7, tipo: 'oferta.nueva', data: { oferta_id: 1, puesto_id: 20 },
    }));
  });

  test('regresión: respeta el delay de visibilidad por ranking y no duplica a quien ya fue notificado', async () => {
    jest.spyOn(OfertasModel, 'obtenerPorId').mockResolvedValue(ofertaAbierta());
    await OfertasService.crear(7, datosAbierta, 1);

    const [sql] = consulta('SELECT DISTINCT u.id AS usuario_id');
    expect(sql).toContain('TIMESTAMPDIFF(MINUTE, ?, NOW())');
    expect(sql).toContain('t.ranking');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain("n.tipo = 'oferta.nueva'");
  });

  test('un puesto ya lleno no se consulta ni se avisa', async () => {
    jest.spyOn(OfertasModel, 'obtenerPorId').mockResolvedValue(ofertaAbierta({ puestos: [{ ...puesto, plazas_cubiertas: 2 }] }));
    await OfertasService.crear(7, datosAbierta, 1);
    expect(consulta('SELECT DISTINCT u.id')).toBeUndefined();
    expect(Notificaciones.notificarVarios).not.toHaveBeenCalled();
  });

  test('para_quien "turnos": solo se buscan trabajadores de turnos', async () => {
    jest.spyOn(OfertasModel, 'obtenerPorId').mockResolvedValue(ofertaAbierta({ para_quien: 'turnos' }));
    await OfertasService.crear(7, datosAbierta, 1);
    expect(consulta('SELECT DISTINCT u.id')[1][2]).toEqual(['trabajador_turnos']);
  });

  test('una oferta abierta no valida destinatarios ni advierte de invitados', async () => {
    jest.spyOn(OfertasModel, 'obtenerPorId').mockResolvedValue(ofertaAbierta());
    await OfertasService.crear(7, datosAbierta, 1);
    expect(consulta(SQL_VALIDAR)).toBeUndefined();
    expect(consulta('t.nombre, t.apellido')).toBeUndefined();
  });
});

describe('turno dirigido', () => {
  const ofertaDirigida = {
    id: 1, titulo: 'Privado', fecha: '2099-01-01', visibilidad: 'dirigida', puestos: [puesto],
    destinatarios: [
      { trabajador_id: 55, usuario_id: 501, nombre: 'Ana', apellido: 'Ruiz' },
      { trabajador_id: 56, usuario_id: 502, nombre: 'Luis', apellido: 'Paz' },
    ],
  };
  const validarOk = [/FROM trabajadores t JOIN trabajador_empresa te ON te\.trabajador_id = t\.id/, [[{ id: 55 }, { id: 56 }]]];

  beforeEach(() => jest.spyOn(OfertasModel, 'obtenerPorId').mockResolvedValue(ofertaDirigida));

  test('valida que todos los destinatarios tengan vínculo activo (consulta literal)', async () => {
    responder([validarOk]);
    await OfertasService.crear(7, datosDirigida, 1);
    expect(consulta(SQL_VALIDAR)).toEqual([SQL_VALIDAR, [[55, 56], 7]]);
  });

  test('si alguno no pertenece a la empresa → 400 y no se crea la oferta', async () => {
    responder([[/FROM trabajadores t JOIN trabajador_empresa te ON te\.trabajador_id/, [[{ id: 55 }]]]]);
    await expect(OfertasService.crear(7, datosDirigida, 1)).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('no pertenece a esta empresa') });
    expect(OfertasModel.crear).not.toHaveBeenCalled();
  });

  test('ids repetidos se cuentan una sola vez al validar', async () => {
    responder([validarOk]);
    await OfertasService.crear(7, { ...datosDirigida, trabajador_ids: [55, 56, 55, '56'] }, 1);
    expect(consulta(SQL_VALIDAR)[1]).toEqual([[55, 56], 7]);
  });

  test('un trabajador_nomina sin acepta_extras no recibe el aviso (consulta literal)', async () => {
    responder([validarOk, [/SELECT t\.id AS trabajador_id FROM trabajadores t JOIN usuarios u/, [[{ trabajador_id: 56 }]]]]);
    await OfertasService.crear(7, datosDirigida, 1);

    expect(consulta(SQL_SIN_EXTRAS)).toEqual([SQL_SIN_EXTRAS, [[55, 56], 'trabajador_nomina']]);
    expect(Notificaciones.notificarVarios).toHaveBeenCalledWith([501], expect.objectContaining({ tipo: 'oferta.nueva' }));
  });

  test('si nadie queda tras quitar a los sin extras, no se avisa a nadie', async () => {
    responder([validarOk, [/SELECT t\.id AS trabajador_id FROM trabajadores t JOIN usuarios u/, [[{ trabajador_id: 55 }, { trabajador_id: 56 }]]]]);
    await OfertasService.crear(7, datosDirigida, 1);
    expect(Notificaciones.notificarVarios).not.toHaveBeenCalled();
  });

  test('advierte de los invitados sin ningún cargo de los puestos (consulta literal)', async () => {
    responder([validarOk, [/SELECT t\.nombre, t\.apellido FROM trabajadores t/, [[{ nombre: 'Luis', apellido: 'Paz' }]]]]);
    const oferta = await OfertasService.crear(7, datosDirigida, 1);

    expect(consulta('t.nombre, t.apellido')).toEqual([SQL_ADVERTENCIA, [[55, 56], 7, [3]]]);
    expect(oferta.advertencias).toEqual([expect.stringContaining('Esta persona no tiene ningún cargo de los puestos del turno y no podrán postularse: Luis Paz.')]);
  });

  test('sin invitados sin cargo → ninguna advertencia', async () => {
    responder([validarOk]);
    const oferta = await OfertasService.crear(7, datosDirigida, 1);
    expect(oferta.advertencias).toEqual([]);
  });
});

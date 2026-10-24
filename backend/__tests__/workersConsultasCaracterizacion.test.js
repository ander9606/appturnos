'use strict';

// Test de caracterización de los workers compensatorios, registros (horas extra) y suscripcion: a quién avisan y con
// qué consultas. Ninguno tenía tests y sus funciones son privadas, así que se ejercitan a través de iniciarWorker()
// avanzando los temporizadores. Simula solo el borde (pool), así que vale igual si el SQL vive en el worker o en un model.
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
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../utils/mailer', () => ({ enviarEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../modules/webhooks/wompi.service', () => ({ generarLinkPago: jest.fn() }));
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
  notificarSuperAdmins: jest.fn().mockResolvedValue(undefined),
}));

const { __llamadas: llamadas, __responder: responder } = require('../config/database');
const { enviarEmail } = require('../utils/mailer');
const Wompi = require('../modules/webhooks/wompi.service');
const Notificaciones = require('../modules/notificaciones/notificaciones.service');
const CompensatoriosModel = require('../modules/nomina/compensatorios/compensatorios.model');
const RegistrosModel = require('../modules/nomina/registros/registros.model');
const compensatoriosWorker = require('../modules/nomina/compensatorios/compensatorios.worker');
const registrosWorker = require('../modules/nomina/registros/registros.worker');
const suscripcionWorker = require('../modules/suscripciones/suscripcion.worker');

const SQL_GESTORES_NOMINA = "SELECT id FROM usuarios WHERE empresa_id = ? AND rol IN ('jefe_nomina','admin_empresa','nomina') AND activo = 1";
const gestores = (...ids) => [/^SELECT id FROM usuarios WHERE empresa_id = \? AND rol IN \('jefe_nomina'/, [ids.map((id) => ({ id }))]];
const sqls = () => llamadas.map(([s]) => s);

/** Avanza el reloj y deja que las promesas encadenadas del worker terminen. */
async function avanzar(ms) {
  await jest.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

beforeEach(() => {
  jest.useFakeTimers();
  llamadas.length = 0;
  jest.clearAllMocks();
  responder([]);
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

describe('compensatorios.worker', () => {
  const pendiente = (id, empresa, nombre) => ({ id, empresa_id: empresa, nombre, apellido: 'Pérez' });

  test('avisa a los gestores de nómina de cada empresa y marca los compensatorios como notificados', async () => {
    jest.spyOn(CompensatoriosModel, 'listarHoyPendientesNotificar').mockResolvedValue([pendiente(1, 7, 'Ana'), pendiente(2, 7, 'Luis')]);
    const marcar = jest.spyOn(CompensatoriosModel, 'marcarNotificadosGestor').mockResolvedValue(undefined);
    responder([gestores(3, 8)]);

    compensatoriosWorker.iniciarWorker();
    await avanzar(15 * 60_000);

    expect(llamadas).toEqual([[SQL_GESTORES_NOMINA, [7]]]);
    expect(Notificaciones.notificarVarios).toHaveBeenCalledWith([3, 8], expect.objectContaining({
      empresaId: 7, tipo: 'nomina.compensatorios_hoy', titulo: '2 trabajadores de compensatorio hoy', mensaje: 'Ana Pérez, Luis Pérez',
    }));
    expect(marcar).toHaveBeenCalledWith([1, 2]);
  });

  test('una consulta de gestores por empresa', async () => {
    jest.spyOn(CompensatoriosModel, 'listarHoyPendientesNotificar').mockResolvedValue([pendiente(1, 7, 'Ana'), pendiente(2, 9, 'Luis')]);
    jest.spyOn(CompensatoriosModel, 'marcarNotificadosGestor').mockResolvedValue(undefined);
    responder([gestores(3)]);

    compensatoriosWorker.iniciarWorker();
    await avanzar(15 * 60_000);

    expect(llamadas.map(([, p]) => p)).toEqual([[7], [9]]);
    expect(Notificaciones.notificarVarios).toHaveBeenCalledTimes(2);
  });

  test('sin gestores en la empresa: no avisa, pero igual marca como notificados', async () => {
    jest.spyOn(CompensatoriosModel, 'listarHoyPendientesNotificar').mockResolvedValue([pendiente(1, 7, 'Ana')]);
    const marcar = jest.spyOn(CompensatoriosModel, 'marcarNotificadosGestor').mockResolvedValue(undefined);

    compensatoriosWorker.iniciarWorker();
    await avanzar(15 * 60_000);

    expect(Notificaciones.notificarVarios).not.toHaveBeenCalled();
    expect(marcar).toHaveBeenCalledWith([1]);
  });

  test('sin compensatorios pendientes: no consulta nada', async () => {
    jest.spyOn(CompensatoriosModel, 'listarHoyPendientesNotificar').mockResolvedValue([]);
    compensatoriosWorker.iniciarWorker();
    await avanzar(15 * 60_000);
    expect(llamadas).toHaveLength(0);
  });
});

describe('registros.worker (horas extra en jornada activa)', () => {
  // 2026-06-02T01:00Z = 20:00 en Colombia del 2026-06-01. Las extras se miden contra el acumulado SEMANAL
  // (42 h, Ley 2101): con 42 h ya acumuladas, todo lo trabajado hoy es extra; con 0, 15 h en un día no lo son.
  const AHORA = new Date('2026-06-02T01:00:00Z');
  const registro = (extra = {}) => ({
    id: 11, empresa_id: 7, trabajador_id: 5, usuario_id: 42, fecha: '2026-06-01', hora_entrada: '05:00:00',
    sesiones: 1, horas_ordinarias: 0, horas_nocturnas: 0, sumar_nocturnas_festivo: 1, nombre: 'Ana', apellido: 'Ruiz', ...extra,
  });

  beforeEach(() => {
    jest.setSystemTime(AHORA);
    jest.spyOn(RegistrosModel, 'sumarOrdinariasEnSemana').mockResolvedValue({ ordinarias: 42 });
  });

  test('con horas extra: avisa al trabajador y a los gestores de nómina, y marca la alerta enviada', async () => {
    jest.spyOn(RegistrosModel, 'listarActivosSinAlertaExtra').mockResolvedValue([registro()]);
    const marcar = jest.spyOn(RegistrosModel, 'marcarAlertaExtraEnviada').mockResolvedValue(undefined);
    responder([gestores(3, 8)]);

    registrosWorker.iniciarWorker();
    await avanzar(15 * 60_000);

    expect(llamadas).toEqual([[SQL_GESTORES_NOMINA, [7]]]);
    expect(Notificaciones.notificar).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 42, tipo: 'nomina.recordatorio_salida' }));
    expect(Notificaciones.notificarVarios).toHaveBeenCalledWith([3, 8], expect.objectContaining({
      empresaId: 7, tipo: 'nomina.horas_extra_iniciadas', data: { registro_id: 11, trabajador_id: 5 },
    }));
    expect(marcar).toHaveBeenCalledWith(11);
  });

  test('sin gestores: avisa al trabajador y marca la alerta, sin aviso a gestores', async () => {
    jest.spyOn(RegistrosModel, 'listarActivosSinAlertaExtra').mockResolvedValue([registro()]);
    const marcar = jest.spyOn(RegistrosModel, 'marcarAlertaExtraEnviada').mockResolvedValue(undefined);

    registrosWorker.iniciarWorker();
    await avanzar(15 * 60_000);

    expect(Notificaciones.notificar).toHaveBeenCalledTimes(1);
    expect(Notificaciones.notificarVarios).not.toHaveBeenCalled();
    expect(marcar).toHaveBeenCalledWith(11);
  });

  test('jornada larga pero dentro del tope semanal (sin extras): no consulta gestores ni avisa ni marca', async () => {
    RegistrosModel.sumarOrdinariasEnSemana.mockResolvedValue({ ordinarias: 0 });
    jest.spyOn(RegistrosModel, 'listarActivosSinAlertaExtra').mockResolvedValue([registro()]);
    const marcar = jest.spyOn(RegistrosModel, 'marcarAlertaExtraEnviada').mockResolvedValue(undefined);

    registrosWorker.iniciarWorker();
    await avanzar(15 * 60_000);

    expect(llamadas).toHaveLength(0);
    expect(Notificaciones.notificar).not.toHaveBeenCalled();
    expect(marcar).not.toHaveBeenCalled();
  });
});

describe('suscripcion.worker (avisos de renovación)', () => {
  const SQL_RENOVACIONES = "SELECT e.id, e.nombre, e.plan, e.suscripcion_vigente_hasta, DATEDIFF(e.suscripcion_vigente_hasta, CURDATE()) AS dias_restantes, u.email, u.nombre AS admin_nombre FROM empresas e JOIN usuarios u ON u.empresa_id = e.id AND u.rol = 'admin_empresa' AND u.activo = 1 WHERE e.activo = 1 AND e.suscripcion_origen != 'logiq360' AND e.suscripcion_vigente_hasta IS NOT NULL AND DATEDIFF(e.suscripcion_vigente_hasta, CURDATE()) IN (7, 3, 0, -3) LIMIT 100";
  const empresa = (dias) => ({ id: 7, nombre: 'ACME', plan: 'basico', dias_restantes: dias, email: 'a@acme.co', admin_nombre: 'Marta' });
  const conEmpresas = (...filas) => responder([[/FROM empresas e JOIN usuarios u/, [filas]]]);

  beforeEach(() => Wompi.generarLinkPago.mockResolvedValue({ url: 'https://pago/x', monto_cop: 129000 }));

  test('busca las empresas por vencer (consulta literal) y no hace nada si no hay ninguna', async () => {
    suscripcionWorker.iniciarWorker();
    await avanzar(60_000);

    expect(llamadas).toEqual([[SQL_RENOVACIONES, undefined]]);
    expect(Wompi.generarLinkPago).not.toHaveBeenCalled();
    expect(Notificaciones.notificarSuperAdmins).not.toHaveBeenCalled();
  });

  test('vence en 7 días: genera el link de pago, envía el email al admin y avisa al super_admin', async () => {
    conEmpresas(empresa(7));

    suscripcionWorker.iniciarWorker();
    await avanzar(60_000);

    expect(Wompi.generarLinkPago).toHaveBeenCalledWith({ empresaId: 7, nombreEmpresa: 'ACME', meses: 1 });
    expect(enviarEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@acme.co', subject: 'Tu suscripción de Zaturno vence en 7 días' }));
    expect(Notificaciones.notificarSuperAdmins).toHaveBeenCalledWith(expect.objectContaining({
      empresaId: 7, tipo: 'admin.suscripcion_vencimiento', titulo: 'Suscripción por vencer', mensaje: 'ACME: suscripción vence en 7 días.',
    }));
  });

  test('vence hoy: el asunto lo dice', async () => {
    conEmpresas(empresa(0));
    suscripcionWorker.iniciarWorker();
    await avanzar(60_000);
    expect(enviarEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: '⚠️ Tu suscripción de Zaturno vence hoy' }));
  });

  test('ya vencida (-3): no manda email ni link, solo avisa al super_admin', async () => {
    conEmpresas(empresa(-3));
    suscripcionWorker.iniciarWorker();
    await avanzar(60_000);

    expect(Wompi.generarLinkPago).not.toHaveBeenCalled();
    expect(enviarEmail).not.toHaveBeenCalled();
    expect(Notificaciones.notificarSuperAdmins).toHaveBeenCalledWith(expect.objectContaining({
      titulo: 'Suscripción vencida', mensaje: 'ACME: suscripción vencida hace 3 días (ya pasó el período de gracia).',
    }));
  });

  test('si falla generar el link: no se envía el email, pero igual se avisa al super_admin', async () => {
    Wompi.generarLinkPago.mockRejectedValue(new Error('wompi caído'));
    conEmpresas(empresa(3));
    suscripcionWorker.iniciarWorker();
    await avanzar(60_000);

    expect(enviarEmail).not.toHaveBeenCalled();
    expect(Notificaciones.notificarSuperAdmins).toHaveBeenCalledTimes(1);
  });
});

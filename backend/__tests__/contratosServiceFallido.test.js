'use strict';

// Un turno dado por fallido (fuerza mayor) que antes estaba completado conserva su contrato en la base
// (auditoría) con el valor anterior. Ese contrato no debe verse, descargarse, firmarse ni generarse de nuevo:
// su pago ahora es una compensación (ver OfertasService.marcarFallida).
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/contratos/contratos.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/turnos/descuentos/descuentos-turno.model');
jest.mock('../modules/integracion/integracion.service', () => ({ emitir: jest.fn() }));
jest.mock('../modules/cuentas-cobro/cuentas-cobro.service', () => ({ actualizarPorTurnoFirmado: jest.fn() }));

const ContratosModel = require('../modules/contratos/contratos.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const DescuentosTurnoModel = require('../modules/turnos/descuentos/descuentos-turno.model');
const ContratosService = require('../modules/contratos/contratos.service');
const { ROLES } = require('../config/constants');

afterEach(() => jest.clearAllMocks());

const gestor = { sub: 1, rol: ROLES.ADMIN_EMPRESA };
const trabajador = { sub: 42, rol: ROLES.TRABAJADOR_TURNOS };
const contrato = (estado) => ({
  id: 77, empresa_id: 7, asignacion_id: 500, numero_contrato: 'C-77', valor_dia: 135000,
  firmado_trabajador: 1, trabajador_usuario_id: 42, asignacion_estado: estado,
});

describe('ContratosService — turno fallido', () => {
  test.each([
    ['obtener', () => ContratosService.obtener(7, 77, gestor), 'obtenerPorId'],
    ['obtenerPorAsignacion', () => ContratosService.obtenerPorAsignacion(7, 500, gestor), 'obtenerPorAsignacion'],
  ])('%s: 409 si el turno está fallido (ni el gestor lo ve)', async (_n, llamar, metodo) => {
    ContratosModel[metodo].mockResolvedValue(contrato('fallido'));
    await expect(llamar()).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('fallido') });
  });

  test('obtener: un turno completado sigue funcionando igual', async () => {
    ContratosModel.obtenerPorId.mockResolvedValue(contrato('completado'));
    DescuentosTurnoModel.listarPorAsignacion.mockResolvedValue([]);
    await expect(ContratosService.obtener(7, 77, gestor)).resolves.toMatchObject({ id: 77 });
  });

  test('firmar: el trabajador no puede firmar el contrato de un turno fallido', async () => {
    ContratosModel.obtenerPorId.mockResolvedValue({ ...contrato('fallido'), firmado_trabajador: 0 });
    await expect(ContratosService.firmar(7, 77, trabajador, 'firma')).rejects.toMatchObject({ statusCode: 409 });
    expect(ContratosModel.firmar).not.toHaveBeenCalled();
  });

  test('generarSiNoExiste: no reutiliza el contrato viejo de un turno fallido', async () => {
    ContratosModel.obtenerPorAsignacion.mockResolvedValue(contrato('fallido'));
    await expect(ContratosService.generarSiNoExiste(7, 500, trabajador)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('generarSiNoExiste: tampoco genera uno nuevo si el turno ya está fallido', async () => {
    ContratosModel.obtenerPorAsignacion.mockResolvedValue(null);
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ id: 500, empresa_id: 7, usuario_id: 42, estado: 'fallido' });
    await expect(ContratosService.generarSiNoExiste(7, 500, trabajador)).rejects.toMatchObject({ statusCode: 409 });
    expect(ContratosModel.crear).not.toHaveBeenCalled();
  });

  test('generarParaAsignacion (flujos internos): no crea contrato de un turno fallido', async () => {
    ContratosModel.obtenerPorAsignacion.mockResolvedValue(null);
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ id: 500, empresa_id: 7, estado: 'fallido', tarifa_dia: 120000 });
    await expect(ContratosService.generarParaAsignacion(7, 500)).rejects.toMatchObject({ statusCode: 409 });
    expect(ContratosModel.crear).not.toHaveBeenCalled();
  });
});

test('la lista de contratos del trabajador excluye los de turnos fallidos', async () => {
  jest.resetModules();
  const consulta = jest.fn().mockResolvedValue([[]]);
  jest.doMock('../config/database', () => ({ pool: { query: consulta } }));
  const ModeloReal = jest.requireActual('../modules/contratos/contratos.model');
  await ModeloReal.listarPorUsuario(42);
  expect(consulta.mock.calls[0][0]).toMatch(/a\.estado <> 'fallido'/);
});

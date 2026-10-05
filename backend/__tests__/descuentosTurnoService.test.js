'use strict';

// Reglas de los descuentos por turno: solo turnos completados, tope legal (art. 113
// CST: 1/5 de la tarifa diaria por turno), solo el trabajador dueño responde, aceptar
// reinicia la firma del contrato y una cuenta de cobro firmada no se mueve.
// Mocks en lugar de DB, igual que descuentosService.test.js.
jest.mock('../modules/turnos/descuentos/descuentos-turno.model', () => ({
  crear: jest.fn(), obtenerPorId: jest.fn(), listarPorAsignacion: jest.fn(),
  sumaComprometida: jest.fn(), responder: jest.fn(), eliminar: jest.fn(),
}));
jest.mock('../modules/turnos/asignaciones/asignaciones.consultas.model', () => ({ obtenerConDetalles: jest.fn() }));
jest.mock('../modules/contratos/contratos.model', () => ({ obtenerPorAsignacion: jest.fn(), resetearFirma: jest.fn() }));
jest.mock('../modules/cuentas-cobro/cuentas-cobro.model', () => ({ obtenerPorOfertaYTrabajador: jest.fn() }));
jest.mock('../modules/cuentas-cobro/cuentas-cobro.service', () => ({ generarParaPeriodo: jest.fn() }));
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
}));

const DescuentosTurnoModel = require('../modules/turnos/descuentos/descuentos-turno.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.consultas.model');
const ContratosModel = require('../modules/contratos/contratos.model');
const CuentasCobroModel = require('../modules/cuentas-cobro/cuentas-cobro.model');
const CuentasCobroService = require('../modules/cuentas-cobro/cuentas-cobro.service');
const DescuentosTurnoService = require('../modules/turnos/descuentos/descuentos-turno.service');
const { ROLES } = require('../config/constants');

afterEach(() => jest.clearAllMocks());

// Tarifa 100.000 → tope legal 20.000 por turno.
const asignacion = {
  id: 10, empresa_id: 7, oferta_id: 3, trabajador_id: 99, usuario_id: 42,
  estado: 'completado', tarifa_dia: 100000, trabajador_tipo: 'turnos', contrato_firmado: 0,
};
const descuento = {
  id: 500, empresa_id: 7, asignacion_id: 10, trabajador_id: 99, monto: 5000, motivo: 'llegada tarde',
  estado: 'pendiente', creado_por: 1, trabajador_usuario_id: 42,
};
const dueno = { sub: 42, rol: ROLES.TRABAJADOR_TURNOS };
const gestor = { sub: 1, rol: ROLES.JEFE_TURNOS };

beforeEach(() => {
  AsignacionesModel.obtenerConDetalles.mockResolvedValue(asignacion);
  CuentasCobroModel.obtenerPorOfertaYTrabajador.mockResolvedValue(null);
  DescuentosTurnoModel.obtenerPorId.mockResolvedValue(descuento);
  DescuentosTurnoModel.sumaComprometida.mockResolvedValue(0);
  DescuentosTurnoModel.crear.mockResolvedValue(501);
  DescuentosTurnoModel.responder.mockResolvedValue(1);
});

test('no descuenta turnos que no están completados', async () => {
  AsignacionesModel.obtenerConDetalles.mockResolvedValue({ ...asignacion, estado: 'confirmado' });

  await expect(DescuentosTurnoService.crear(7, gestor.sub, 10, { monto: 1000, motivo: 'x' }))
    .rejects.toThrow('Solo se pueden descontar turnos completados');
  expect(DescuentosTurnoModel.crear).not.toHaveBeenCalled();
});

test('no supera la quinta parte de la tarifa diaria del turno (art. 113 CST) y explica por qué', async () => {
  DescuentosTurnoModel.sumaComprometida.mockResolvedValue(15000);

  // 15.000 ya comprometidos + 6.000 = 21.000 > tope 20.000
  await expect(DescuentosTurnoService.crear(7, gestor.sub, 10, { monto: 6000, motivo: 'daño' }))
    .rejects.toThrow('quinta parte del salario de un día');
  expect(DescuentosTurnoModel.crear).not.toHaveBeenCalled();

  // 15.000 + 5.000 = 20.000 exacto sí cabe
  await DescuentosTurnoService.crear(7, gestor.sub, 10, { monto: 5000, motivo: 'daño' });
  expect(DescuentosTurnoModel.crear).toHaveBeenCalledTimes(1);
});

test('solo el trabajador dueño del turno puede responder', async () => {
  await expect(DescuentosTurnoService.responder({ sub: 999, rol: ROLES.TRABAJADOR_TURNOS }, 500, true))
    .rejects.toThrow('No autorizado');
  expect(DescuentosTurnoModel.responder).not.toHaveBeenCalled();
});

test('aceptar con contrato firmado reinicia la firma y avisa que hay que firmar otra vez', async () => {
  AsignacionesModel.obtenerConDetalles.mockResolvedValue({ ...asignacion, contrato_firmado: 1 });
  ContratosModel.obtenerPorAsignacion.mockResolvedValue({ id: 77, firmado_trabajador: 1 });

  const resultado = await DescuentosTurnoService.responder(dueno, 500, true);

  expect(ContratosModel.resetearFirma).toHaveBeenCalledWith(7, 77);
  expect(resultado.requiere_nueva_firma).toBe(true);
});

test('aceptar refresca solo la cuenta sin firmar de ese trabajador, sin volver a notificar; rechazar no toca nada', async () => {
  CuentasCobroModel.obtenerPorOfertaYTrabajador.mockResolvedValue({ id: 5, periodo_id: 2, firmado_trabajador: 0 });

  await DescuentosTurnoService.responder(dueno, 500, true);
  expect(DescuentosTurnoModel.responder).toHaveBeenCalledWith(7, 500, 'aceptado');
  expect(CuentasCobroService.generarParaPeriodo).toHaveBeenCalledWith(7, 2, { trabajadorId: 99, notificar: false });

  jest.clearAllMocks();
  DescuentosTurnoModel.obtenerPorId.mockResolvedValue(descuento);
  DescuentosTurnoModel.responder.mockResolvedValue(1);
  CuentasCobroModel.obtenerPorOfertaYTrabajador.mockResolvedValue({ id: 5, periodo_id: 2, firmado_trabajador: 0 });

  const rechazado = await DescuentosTurnoService.responder(dueno, 500, false);
  expect(DescuentosTurnoModel.responder).toHaveBeenCalledWith(7, 500, 'rechazado');
  expect(CuentasCobroService.generarParaPeriodo).not.toHaveBeenCalled();
  expect(ContratosModel.resetearFirma).not.toHaveBeenCalled();
  expect(rechazado.requiere_nueva_firma).toBe(false);
});

test('no mueve descuentos de un turno cuya cuenta de cobro ya fue firmada', async () => {
  CuentasCobroModel.obtenerPorOfertaYTrabajador.mockResolvedValue({ id: 5, periodo_id: 2, firmado_trabajador: 1 });

  await expect(DescuentosTurnoService.eliminar(7, 500)).rejects.toThrow('ya fue firmada');
  expect(DescuentosTurnoModel.eliminar).not.toHaveBeenCalled();
});

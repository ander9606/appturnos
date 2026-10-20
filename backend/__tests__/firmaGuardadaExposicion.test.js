'use strict';

// Seguridad: trabajador_firma_guardada es un atajo reutilizable para firmar
// sin redibujar (ver TrabajadoresModel.guardarFirma). Solo le sirve al propio
// trabajador — un gestor u otro trabajador viendo el mismo contrato/cuenta de
// cobro no debe recibirlo en la respuesta (ver limpiarCamposSensibles en
// contratos.service.js y cuentas-cobro.service.js).
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/contratos/contratos.model');
jest.mock('../modules/turnos/descuentos/descuentos-turno.model', () => ({
  listarPorAsignacion: jest.fn().mockResolvedValue([]),
}));
jest.mock('../modules/cuentas-cobro/cuentas-cobro.model');

const ContratosModel = require('../modules/contratos/contratos.model');
const ContratosService = require('../modules/contratos/contratos.service');
const CuentasCobroModel = require('../modules/cuentas-cobro/cuentas-cobro.model');
const CuentasCobroService = require('../modules/cuentas-cobro/cuentas-cobro.service');

afterEach(() => jest.clearAllMocks());

describe('ContratosService — exposición de trabajador_firma_guardada', () => {
  test('el dueño del contrato sí recibe su propia firma guardada', async () => {
    ContratosModel.obtenerPorId.mockResolvedValue({
      id: 1, empresa_id: 3, trabajador_usuario_id: 69, trabajador_firma_guardada: 'firma-svg',
    });

    const contrato = await ContratosService.obtener(3, 1, { sub: 69, rol: 'trabajador_turnos' });

    expect(contrato.trabajador_firma_guardada).toBe('firma-svg');
  });

  test('un gestor viendo el contrato de otra persona NO recibe la firma guardada', async () => {
    ContratosModel.obtenerPorId.mockResolvedValue({
      id: 1, empresa_id: 3, trabajador_usuario_id: 69, trabajador_firma_guardada: 'firma-svg',
    });

    const contrato = await ContratosService.obtener(3, 1, { sub: 5, rol: 'admin_empresa' });

    expect(contrato.trabajador_firma_guardada).toBeNull();
  });

  test('obtenerPorAsignacion aplica el mismo recorte', async () => {
    ContratosModel.obtenerPorAsignacion.mockResolvedValue({
      id: 1, empresa_id: 3, asignacion_id: 500, trabajador_usuario_id: 69, trabajador_firma_guardada: 'firma-svg',
    });

    const contrato = await ContratosService.obtenerPorAsignacion(3, 500, { sub: 5, rol: 'admin_empresa' });

    expect(contrato.trabajador_firma_guardada).toBeNull();
  });
});

describe('CuentasCobroService — exposición de trabajador_firma_guardada', () => {
  test('el dueño de la cuenta de cobro sí recibe su propia firma guardada', async () => {
    CuentasCobroModel.obtenerPorId.mockResolvedValue({
      id: 1, empresa_id: 3, trabajador_usuario_id: 69, trabajador_firma_guardada: 'firma-svg',
    });

    const cuenta = await CuentasCobroService.obtener(3, 1, { sub: 69, rol: 'trabajador_turnos' });

    expect(cuenta.trabajador_firma_guardada).toBe('firma-svg');
  });

  test('un gestor viendo la cuenta de cobro de otra persona NO recibe la firma guardada', async () => {
    CuentasCobroModel.obtenerPorId.mockResolvedValue({
      id: 1, empresa_id: 3, trabajador_usuario_id: 69, trabajador_firma_guardada: 'firma-svg',
    });

    const cuenta = await CuentasCobroService.obtener(3, 1, { sub: 5, rol: 'admin_empresa' });

    expect(cuenta.trabajador_firma_guardada).toBeNull();
  });
});

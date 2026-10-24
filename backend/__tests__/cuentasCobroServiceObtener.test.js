'use strict';

// Seguridad: jefe_turnos puede descargar/consultar la cuenta de cobro (gestiona
// la pantalla de Liquidación), pero no debe ver cédula ni datos bancarios del
// trabajador — esos son de admin_empresa/jefe_nomina/nomina y del propio trabajador.
jest.mock('../modules/cuentas-cobro/cuentas-cobro.model');

const { ROLES } = require('../config/constants');
const CuentasCobroModel = require('../modules/cuentas-cobro/cuentas-cobro.model');
const CuentasCobroService = require('../modules/cuentas-cobro/cuentas-cobro.service');

const CUENTA = () => ({
  id: 5, empresa_id: 1, trabajador_usuario_id: 42,
  trabajador_cedula: '999888777', trabajador_banco: 'BBVA',
  trabajador_tipo_cuenta: 'ahorros', trabajador_numero_cuenta: '111222333',
  trabajador_firma_guardada: 'data:image/png;base64,xyz',
  numero_cuenta: 'CC-1-1',
});

beforeEach(() => jest.clearAllMocks());

describe('CuentasCobroService.obtener — visibilidad por rol', () => {
  test('jefe_turnos no recibe cédula ni datos bancarios', async () => {
    CuentasCobroModel.obtenerPorId.mockResolvedValue(CUENTA());

    const data = await CuentasCobroService.obtener(1, 5, { sub: 10, rol: ROLES.JEFE_TURNOS });

    expect(data.trabajador_cedula).toBeNull();
    expect(data.trabajador_banco).toBeNull();
    expect(data.trabajador_tipo_cuenta).toBeNull();
    expect(data.trabajador_numero_cuenta).toBeNull();
    expect(data.trabajador_firma_guardada).toBeNull(); // no es el dueño
  });

  test('admin_empresa sigue viendo cédula y datos bancarios', async () => {
    CuentasCobroModel.obtenerPorId.mockResolvedValue(CUENTA());

    const data = await CuentasCobroService.obtener(1, 5, { sub: 2, rol: ROLES.ADMIN_EMPRESA });

    expect(data.trabajador_cedula).toBe('999888777');
    expect(data.trabajador_banco).toBe('BBVA');
  });

  test('el propio trabajador ve sus datos bancarios y su firma guardada', async () => {
    CuentasCobroModel.obtenerPorId.mockResolvedValue(CUENTA());

    const data = await CuentasCobroService.obtener(1, 5, { sub: 42, rol: ROLES.TRABAJADOR_TURNOS });

    expect(data.trabajador_banco).toBe('BBVA');
    expect(data.trabajador_firma_guardada).toBe('data:image/png;base64,xyz');
  });

  test('otro trabajador_turnos no puede ver la cuenta de un compañero', async () => {
    CuentasCobroModel.obtenerPorId.mockResolvedValue(CUENTA());

    await expect(
      CuentasCobroService.obtener(1, 5, { sub: 999, rol: ROLES.TRABAJADOR_TURNOS })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

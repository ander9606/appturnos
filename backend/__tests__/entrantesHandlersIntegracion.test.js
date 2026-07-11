'use strict';

jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/integracion/integracion.model');

const IntegracionModel = require('../modules/integracion/integracion.model');
const { procesar } = require('../modules/integracion/entrantes.handlers');

describe('entrantes.handlers — integracion.activada / integracion.desactivada', () => {
  test('integracion.activada marca integracion_config.activo = true', async () => {
    const manejado = await procesar('integracion.activada', 7, {});
    expect(manejado).toBe(true);
    expect(IntegracionModel.actualizarActivo).toHaveBeenCalledWith(7, true);
  });

  test('integracion.desactivada marca integracion_config.activo = false', async () => {
    const manejado = await procesar('integracion.desactivada', 7, {});
    expect(manejado).toBe(true);
    expect(IntegracionModel.actualizarActivo).toHaveBeenCalledWith(7, false);
  });
});

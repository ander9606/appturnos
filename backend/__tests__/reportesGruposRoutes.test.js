'use strict';

// GET /api/reportes/grupos: sin el interruptor de la empresa responde 403 (para el resto de clientes la función no
// existe), exige el rango de fechas y la empresa sale siempre del token.
jest.mock('../middleware/authMiddleware', () => ({
  verificarToken: (req, _res, next) => { req.usuario = { sub: 1, rol: 'jefe_turnos', empresa_id: 7 }; req.empresa_id = 7; next(); },
  verificarRol: () => (_req, _res, next) => next(),
}));
jest.mock('../modules/empresas/empresas.model');
jest.mock('../modules/reportes/reportes.service');

const express = require('express');
const EmpresasModel = require('../modules/empresas/empresas.model');
const Servicio = require('../modules/reportes/reportes.service');
const errorHandler = require('../middleware/errorHandler');

let servidor, base;
beforeAll((done) => {
  const app = express();
  app.use('/api/reportes', require('../modules/reportes/reportes.routes'));
  app.use(errorHandler.errorHandler || errorHandler);
  servidor = app.listen(0, () => { base = `http://127.0.0.1:${servidor.address().port}/api/reportes`; done(); });
});
afterAll(() => new Promise((listo) => { servidor.close(() => listo()); servidor.closeAllConnections(); }));
afterEach(() => jest.clearAllMocks());

const pedir = (qs = '?desde=2030-01-01&hasta=2030-01-31') => fetch(`${base}/grupos${qs}`);

test('empresa sin la función activada → 403 y no llega al servicio', async () => {
  EmpresasModel.usaGruposTurno.mockResolvedValue(false);
  const r = await pedir();
  expect(r.status).toBe(403);
  expect(Servicio.porGrupo).not.toHaveBeenCalled();
});

describe('empresa con la función activada', () => {
  beforeEach(() => EmpresasModel.usaGruposTurno.mockResolvedValue(true));

  test('devuelve el reporte de la empresa del token', async () => {
    Servicio.porGrupo.mockResolvedValue({ costo_total: 10, grupos: [] });
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(Servicio.porGrupo).toHaveBeenCalledWith(7, { desde: '2030-01-01', hasta: '2030-01-31' });
    expect((await r.json()).data).toEqual({ costo_total: 10, grupos: [] });
  });

  test.each([['sin fechas', ''], ['hasta antes de desde', '?desde=2030-02-01&hasta=2030-01-01'], ['fecha inválida', '?desde=x&hasta=2030-01-01'], ['rango de más de 366 días', '?desde=2020-01-01&hasta=2030-01-01']])(
    '%s → 422', async (_n, qs) => {
      expect((await pedir(qs)).status).toBe(422);
      expect(Servicio.porGrupo).not.toHaveBeenCalled();
    }
  );
});

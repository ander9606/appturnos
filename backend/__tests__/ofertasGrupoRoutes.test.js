'use strict';

// Validaciones de grupo_id en las rutas de ofertas. Lo crítico: PUT /:id/grupo exige la clave
// `grupo_id` (un cuerpo vacío NO debe sacar el turno de su grupo por accidente); null sí es válido.
jest.mock('../middleware/authMiddleware', () => ({
  verificarToken: (req, _res, next) => { req.usuario = { sub: 1, rol: 'admin_empresa', empresa_id: 7 }; req.empresa_id = 7; next(); },
  verificarRol: () => (_req, _res, next) => next(),
  resolverEmpresasActivas: (_req, _res, next) => next(),
}));
jest.mock('../middleware/verificarSuscripcion', () => (_req, _res, next) => next());
jest.mock('../modules/turnos/ofertas/ofertas.controller');

const express = require('express');
const ctrl = require('../modules/turnos/ofertas/ofertas.controller');
const { errorHandler } = require('../middleware/errorHandler');

let servidor, base;
beforeAll((done) => {
  const app = express();
  app.use(express.json());
  app.use('/api/turnos/ofertas', require('../modules/turnos/ofertas/ofertas.routes'));
  app.use(errorHandler);
  servidor = app.listen(0, () => { base = `http://127.0.0.1:${servidor.address().port}/api/turnos/ofertas`; done(); });
});
afterAll(() => new Promise((listo) => { servidor.close(() => listo()); servidor.closeAllConnections(); }));
beforeEach(() => {
  for (const nombre of ['vincularGrupo', 'crear']) ctrl[nombre].mockImplementation((req, res) => res.json({ success: true, body: req.body }));
});
afterEach(() => jest.clearAllMocks());

const pedir = (ruta, metodo, cuerpo) => fetch(`${base}${ruta}`, {
  method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
});

describe('PUT /:id/grupo', () => {
  test.each([[{}], [{ grupo_id: 0 }], [{ grupo_id: -2 }], [{ grupo_id: 'abc' }], [{ grupo_id: 1.5 }], [{ grupo_id: '3' }]])(
    'cuerpo %j → 422 y no llega al controlador', async (cuerpo) => {
      expect((await pedir('/5/grupo', 'PUT', cuerpo)).status).toBe(422);
      expect(ctrl.vincularGrupo).not.toHaveBeenCalled();
    }
  );

  test.each([[{ grupo_id: 3 }], [{ grupo_id: null }]])('cuerpo %j → pasa al controlador', async (cuerpo) => {
    const r = await pedir('/5/grupo', 'PUT', cuerpo);
    expect(r.status).toBe(200);
    expect(ctrl.vincularGrupo).toHaveBeenCalledTimes(1);
  });

  test('id de turno inválido → 422', async () => {
    expect((await pedir('/abc/grupo', 'PUT', { grupo_id: 3 })).status).toBe(422);
  });
});

describe('POST / (crear) con grupo_id', () => {
  const turnoValido = { titulo: 'Montaje', fecha: '2099-01-01', hora_inicio: '08:00', puestos: [{ cargo_id: 1, tarifa_dia: 50000 }] };

  test('grupo_id inválido → 422', async () => {
    expect((await pedir('/', 'POST', { ...turnoValido, grupo_id: 'x' })).status).toBe(422);
    expect((await pedir('/', 'POST', { ...turnoValido, grupo_id: 0 })).status).toBe(422);
    expect(ctrl.crear).not.toHaveBeenCalled();
  });

  test('sin grupo_id o con grupo_id válido → pasa', async () => {
    expect((await pedir('/', 'POST', turnoValido)).status).toBe(200);
    expect((await pedir('/', 'POST', { ...turnoValido, grupo_id: 3 })).status).toBe(200);
    expect(ctrl.crear).toHaveBeenCalledTimes(2);
  });
});

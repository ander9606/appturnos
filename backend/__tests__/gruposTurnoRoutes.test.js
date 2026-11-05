'use strict';

// Rutas de grupos de turnos: sin el interruptor `usa_grupos_turno` de la empresa responden 403
// (así la función no existe para el resto de clientes), y las validaciones cortan con 422.
jest.mock('../middleware/authMiddleware', () => ({
  verificarToken: (req, _res, next) => { req.usuario = { sub: 1, rol: 'admin_empresa', empresa_id: 7 }; req.empresa_id = 7; next(); },
  verificarRol: () => (_req, _res, next) => next(),
}));
jest.mock('../middleware/verificarSuscripcion', () => (_req, _res, next) => next());
jest.mock('../modules/empresas/empresas.model');
jest.mock('../modules/grupos-turno/grupos-turno.service');

const express = require('express');
const EmpresasModel = require('../modules/empresas/empresas.model');
const Servicio = require('../modules/grupos-turno/grupos-turno.service');
const errorHandler = require('../middleware/errorHandler');

let servidor, base;
beforeAll((done) => {
  const app = express();
  app.use(express.json());
  app.use('/api/grupos-turno', require('../modules/grupos-turno/grupos-turno.routes'));
  app.use((req, res, next) => next(Object.assign(new Error('no encontrada'), { statusCode: 404 })));
  app.use(errorHandler.errorHandler || errorHandler);
  servidor = app.listen(0, () => { base = `http://127.0.0.1:${servidor.address().port}/api/grupos-turno`; done(); });
});
afterAll(() => new Promise((listo) => { servidor.close(() => listo()); servidor.closeAllConnections(); }));
afterEach(() => jest.clearAllMocks());

const pedir = (ruta, metodo = 'GET', cuerpo) => fetch(`${base}${ruta}`, {
  method: metodo, headers: { 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined,
});

describe('empresa sin la función activada', () => {
  beforeEach(() => EmpresasModel.usaGruposTurno.mockResolvedValue(false));

  test.each([['GET', '/', undefined], ['GET', '/3', undefined], ['POST', '/', { nombre: 'X' }], ['PATCH', '/3', { nombre: 'X' }], ['POST', '/3/cerrar', undefined], ['POST', '/3/reabrir', undefined]])(
    '%s %s → 403 y no llega al servicio', async (metodo, ruta, cuerpo) => {
      const r = await pedir(ruta, metodo, cuerpo);
      expect(r.status).toBe(403);
      expect((await r.json()).message).toContain('no están activados');
      for (const fn of Object.values(Servicio)) expect(fn).not.toHaveBeenCalled();
    }
  );
});

describe('empresa con la función activada', () => {
  beforeEach(() => EmpresasModel.usaGruposTurno.mockResolvedValue(true));

  test('GET / lista (por defecto los activos)', async () => {
    Servicio.listar.mockResolvedValue([{ id: 1, nombre: 'Feria' }]);
    const r = await pedir('/');
    expect(r.status).toBe(200);
    expect(Servicio.listar).toHaveBeenCalledWith(7, undefined);
    expect((await r.json()).data).toEqual([{ id: 1, nombre: 'Feria' }]);
  });

  test('estado inválido → 422', async () => {
    expect((await pedir('/?estado=otro')).status).toBe(422);
  });

  test('POST con nombre vacío, demasiado largo o coordenadas fuera de rango → 422', async () => {
    expect((await pedir('/', 'POST', { nombre: '   ' })).status).toBe(422);
    expect((await pedir('/', 'POST', { nombre: 'x'.repeat(151) })).status).toBe(422);
    expect((await pedir('/', 'POST', { nombre: 'Ok', lugar: 'L', latitud: 95, longitud: 0 })).status).toBe(422);
    expect(Servicio.crear).not.toHaveBeenCalled();
  });

  test('POST válido recorta el nombre, responde 201 y guarda quién lo creó', async () => {
    Servicio.crear.mockResolvedValue({ id: 5, nombre: 'Feria' });
    const r = await pedir('/', 'POST', { nombre: '  Feria  ', lugar: 'Corferias', latitud: 4.63, longitud: -74.09 });
    expect(r.status).toBe(201);
    expect(Servicio.crear).toHaveBeenCalledWith(7, expect.objectContaining({ nombre: 'Feria', lugar: 'Corferias' }), 1);
  });

  test('id inválido → 422', async () => {
    expect((await pedir('/abc')).status).toBe(422);
    expect((await pedir('/0/cerrar', 'POST')).status).toBe(422);
  });
});

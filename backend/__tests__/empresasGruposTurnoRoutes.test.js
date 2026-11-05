'use strict';

// Opciones de grupos de turnos de la empresa: las cambia su admin_empresa con PATCH /me y las
// lee cualquier rol con GET /opciones. Aquí: validaciones de la ruta y conversión del controlador
// (el web manda '1'/'0' como texto: '0' es verdadero en JS, por eso se compara explícito).
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../middleware/authMiddleware', () => ({
  verificarToken: (req, _res, next) => { req.usuario = { sub: 1, nombre: 'Ana', rol: 'admin_empresa', empresa_id: 7 }; req.empresa_id = 7; next(); },
  verificarRol: () => (_req, _res, next) => next(),
}));
jest.mock('../middleware/verificarSuscripcion', () => (_req, _res, next) => next());
jest.mock('../modules/empresas/empresas.service');

const express = require('express');
const EmpresasService = require('../modules/empresas/empresas.service');
const { errorHandler } = require('../middleware/errorHandler');

let servidor, base;
beforeAll((done) => {
  const app = express();
  app.use(express.json());
  app.use('/api/empresas', require('../modules/empresas/empresas.routes'));
  app.use(errorHandler);
  servidor = app.listen(0, () => { base = `http://127.0.0.1:${servidor.address().port}/api/empresas`; done(); });
});
afterAll(() => new Promise((listo) => { servidor.close(() => listo()); servidor.closeAllConnections(); }));
beforeEach(() => { EmpresasService.actualizarMiEmpresa.mockResolvedValue({ id: 7 }); });
afterEach(() => jest.clearAllMocks());

const patch = (cuerpo) => fetch(`${base}/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
const datosGuardados = () => EmpresasService.actualizarMiEmpresa.mock.calls[0][1];

describe('PATCH /me — validaciones', () => {
  test.each([[{ usa_grupos_turno: 'quizás' }], [{ etiqueta_grupo: 'x'.repeat(41) }], [{ etiqueta_grupo: 42 }]])(
    'cuerpo %j → 422 y no llega al servicio', async (cuerpo) => {
      expect((await patch(cuerpo)).status).toBe(422);
      expect(EmpresasService.actualizarMiEmpresa).not.toHaveBeenCalled();
    }
  );

  test('la etiqueta se recorta y se guarda', async () => {
    expect((await patch({ etiqueta_grupo: '  Evento  ' })).status).toBe(200);
    expect(datosGuardados()).toEqual({ etiqueta_grupo: 'Evento' });
  });
});

describe('PATCH /me — conversión del controlador', () => {
  test.each([[true, 1], [false, 0], ['1', 1], ['0', 0], ['true', 1], ['false', 0], [1, 1], [0, 0]])(
    'usa_grupos_turno %j se guarda como %j', async (entrada, esperado) => {
      expect((await patch({ usa_grupos_turno: entrada })).status).toBe(200);
      expect(datosGuardados()).toEqual({ usa_grupos_turno: esperado });
    }
  );

  test.each([[''], [null]])('etiqueta_grupo %j vuelve al nombre por defecto (NULL)', async (entrada) => {
    expect((await patch({ etiqueta_grupo: entrada })).status).toBe(200);
    expect(datosGuardados()).toEqual({ etiqueta_grupo: null });
  });

  test('si no se manda ninguna de las dos, no se toca nada de grupos', async () => {
    expect((await patch({ ciudad: 'Bogotá' })).status).toBe(200);
    expect(datosGuardados()).toEqual({ ciudad: 'Bogotá' });
  });
});

describe('GET /opciones', () => {
  test('devuelve las opciones de la empresa del token', async () => {
    EmpresasService.opcionesGruposTurno.mockResolvedValue({ usa_grupos_turno: true, etiqueta_grupo: 'Evento' });
    const r = await fetch(`${base}/opciones`);
    expect(r.status).toBe(200);
    expect(EmpresasService.opcionesGruposTurno).toHaveBeenCalledWith(7);
    expect((await r.json()).data).toEqual({ usa_grupos_turno: true, etiqueta_grupo: 'Evento' });
  });
});

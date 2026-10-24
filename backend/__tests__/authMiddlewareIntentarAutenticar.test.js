'use strict';

const jwt = require('jsonwebtoken');

jest.mock('../modules/trabajador-empresa/trabajador-empresa.model');

process.env.JWT_SECRET = 'secreto-de-test';
const { intentarAutenticar } = require('../middleware/authMiddleware');

const mockRes = () => ({});

describe('intentarAutenticar', () => {
  test('sin header Authorization: sigue sin req.usuario, nunca bloquea', () => {
    const req = { headers: {} };
    const next = jest.fn();
    intentarAutenticar(req, mockRes(), next);
    expect(req.usuario).toBeUndefined();
    expect(next).toHaveBeenCalledWith(); // sin error
  });

  test('token inválido/expirado: sigue sin req.usuario, nunca bloquea', () => {
    const req = { headers: { authorization: 'Bearer token-basura' } };
    const next = jest.fn();
    intentarAutenticar(req, mockRes(), next);
    expect(req.usuario).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  test('token válido: expone req.usuario y req.empresa_id', () => {
    const token = jwt.sign({ sub: 5, rol: 'admin_empresa', empresa_id: 1 }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();
    intentarAutenticar(req, mockRes(), next);
    expect(req.usuario).toMatchObject({ sub: 5, rol: 'admin_empresa' });
    expect(req.empresa_id).toBe(1);
    expect(next).toHaveBeenCalledWith();
  });
});

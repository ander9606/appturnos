'use strict';

jest.mock('../instrument', () => ({ captureException: jest.fn() }));
jest.mock('../utils/logger', () => ({ error: jest.fn(), info: jest.fn(), debug: jest.fn() }));

const Sentry = require('../instrument');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const { errorHandler } = require('../middleware/errorHandler');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

function mockReq(method = 'GET', originalUrl = '/api/x') {
  return { method, originalUrl };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('errorHandler', () => {
  it('responds with its own status/message for an AppError, without touching Sentry', () => {
    const res = mockRes();
    errorHandler(new AppError('Ya existe un registro con esos datos', 409), mockReq('POST'), res, () => {});

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Ya existe un registro con esos datos' }));
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('reports an unexpected error as 500 and sends it to Sentry', () => {
    const res = mockRes();
    errorHandler(new Error('algo raro'), mockReq(), res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  // raw-body marca así una desconexión del cliente a medio request (logout/backgrounding en
  // mobile con un fetch en vuelo) — no es un bug del servidor, no debe alertar en Sentry.
  it('swallows a client-aborted request (raw-body) without reporting to Sentry', () => {
    const res = mockRes();
    const abortErr = new Error('request aborted');
    abortErr.type = 'request.aborted';

    errorHandler(abortErr, mockReq('DELETE', '/api/push/expo-token'), res, () => {});

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500); // igual responde algo — el socket ya está cerrado del lado del cliente
  });

  it('still translates known MySQL errors (ER_DUP_ENTRY) instead of treating them as unexpected', () => {
    const res = mockRes();
    const mysqlErr = new Error('Duplicate entry');
    mysqlErr.code = 'ER_DUP_ENTRY';

    errorHandler(mysqlErr, mockReq('POST'), res, () => {});

    expect(res.status).toHaveBeenCalledWith(409);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

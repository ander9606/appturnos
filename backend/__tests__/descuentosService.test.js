'use strict';

// Regresión: mismo patrón de bug que asignacionesServiceMarcarIngreso.test.js.
// responder() verificaba la propiedad del descuento resolviendo "cuál es mi
// trabajador en esta empresa" por separado (TrabajadoresModel.obtenerPorUsuarioId,
// LIMIT 1 sin ORDER BY) y comparando su id contra descuento.trabajador_id. La
// tabla `trabajadores` no tiene UNIQUE(usuario_id, empresa_id), así que esa
// búsqueda independiente puede devolver una fila distinta a la que realmente
// generó el descuento — el dueño legítimo recibía "No autorizado" (403) al
// intentar aceptar/rechazar su propio descuento.
jest.mock('../modules/nomina/descuentos/descuentos.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
}));

const DescuentosModel   = require('../modules/nomina/descuentos/descuentos.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const DescuentosService = require('../modules/nomina/descuentos/descuentos.service');
const { ROLES } = require('../config/constants');

afterEach(() => jest.clearAllMocks());

describe('DescuentosService.responder', () => {
  const usuario = { sub: 42, rol: ROLES.TRABAJADOR_NOMINA };
  const descuento = { id: 500, empresa_id: 7, trabajador_id: 99, estado: 'pendiente', motivo: 'préstamo', creado_por: 1 };

  beforeEach(() => {
    DescuentosModel.obtenerPorId.mockResolvedValue(descuento);
    DescuentosModel.responder.mockResolvedValue(1);
  });

  test('permite responder aunque exista otra fila de trabajador para el mismo usuario', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 99, usuario_id: 42, empresa_id: 7 });
    // Si el código todavía llamara a la resolución "independiente" vieja,
    // esto simularía el bug devolviendo una fila DISTINTA — no debe invocarse.
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 55, usuario_id: 42, empresa_id: 7 });

    await DescuentosService.responder(7, usuario, 500, 'aceptado');

    expect(TrabajadoresModel.obtenerPorId).toHaveBeenCalledWith(7, 99);
    expect(TrabajadoresModel.obtenerPorUsuarioId).not.toHaveBeenCalled();
    expect(DescuentosModel.responder).toHaveBeenCalledWith(7, 500, 'aceptado');
  });

  test('rechaza a un usuario que no es dueño del trabajador del descuento', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 99, usuario_id: 999 });

    await expect(
      DescuentosService.responder(7, usuario, 500, 'aceptado')
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(DescuentosModel.responder).not.toHaveBeenCalled();
  });
});

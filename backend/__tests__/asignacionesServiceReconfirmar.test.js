'use strict';

// Nuevo flujo: cuando el gestor edita fecha/hora/lugar de una oferta con
// trabajadores ya 'confirmado', esas asignaciones pasan a 'por_reconfirmar'
// (ver OfertasService.actualizar). El propio trabajador debe resolverlo acá:
// aceptar (reusa confirmar(), re-chequea traslape/lleno) o declinar (libera
// el cupo para siempre, sin volver a descontar la plaza que ya se liberó al
// entrar en por_reconfirmar).
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/contratos/contratos.model');
jest.mock('../modules/integracion/integracion.service', () => ({ emitir: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../modules/integracion/cobertura.service', () => ({ verificarYEmitir: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { pool } = require('../config/database');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const IntegracionService = require('../modules/integracion/integracion.service');
const AsignacionesService = require('../modules/turnos/asignaciones/asignaciones.service');

afterEach(() => jest.clearAllMocks());

const asigPorReconfirmar = {
  id: 500, empresa_id: 7, trabajador_id: 99, usuario_id: 42,
  trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz',
  oferta_id: 1, oferta_titulo: 'Bodega — turno tarde',
  estado: 'por_reconfirmar',
};

describe('AsignacionesService.reconfirmar', () => {
  test('404 si la asignación no existe', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue(null);
    await expect(AsignacionesService.reconfirmar(7, 500, 42, true)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('403 si la asignación no le pertenece al usuario que llama', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue(asigPorReconfirmar);
    await expect(AsignacionesService.reconfirmar(7, 500, 999, true)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('409 si la asignación ya no está por_reconfirmar', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ ...asigPorReconfirmar, estado: 'confirmado' });
    await expect(AsignacionesService.reconfirmar(7, 500, 42, true)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('acepta:false declina, no vuelve a tocar plazas_cubiertas y avisa a los gestores', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue(asigPorReconfirmar);
    AsignacionesModel.declinarReconfirmacion.mockResolvedValue({ ok: true, trabajador_id: 99, oferta_id: 1 });
    AsignacionesModel.obtenerPorId.mockResolvedValue({ id: 500, estado: 'cancelado' });
    pool.query.mockResolvedValueOnce([[{ id: 55 }]]); // gestores de la empresa

    const resultado = await AsignacionesService.reconfirmar(7, 500, 42, false);

    expect(AsignacionesModel.declinarReconfirmacion).toHaveBeenCalledWith(7, 500);
    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith(
      [55], expect.objectContaining({ tipo: 'asignacion.reconfirmacion_rechazada' })
    );
    expect(resultado).toEqual({ id: 500, estado: 'cancelado' });
  });

  test('acepta:true reusa la máquina de estados de confirmar() con el empresa_id real de la fila', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue(asigPorReconfirmar);
    // Dependencias de confirmar(): obtenerPorId (asig cruda), TrabajadoresModel
    // (rol no-turnos/no-nomina para saltar los chequeos extra de traslape),
    // confirmar() del modelo, y el fetch final para el retorno.
    AsignacionesModel.obtenerPorId
      .mockResolvedValueOnce({ id: 500, empresa_id: 7, trabajador_id: 99, estado: 'por_reconfirmar' })
      .mockResolvedValueOnce({ id: 500, empresa_id: 7, estado: 'confirmado' });
    TrabajadoresModel.obtenerUsuarioIdYRol.mockResolvedValue({ usuario_id: 42, rol: 'admin_empresa' });
    TrabajadoresModel.obtenerUsuarioId.mockResolvedValue(42);
    AsignacionesModel.confirmar.mockResolvedValue({ ok: true });

    const resultado = await AsignacionesService.reconfirmar(7, 500, 42, true);

    expect(AsignacionesModel.confirmar).toHaveBeenCalledWith(7, 500, ['por_reconfirmar']);
    expect(resultado).toEqual({ id: 500, empresa_id: 7, estado: 'confirmado' });
  });

  test('acepta:true no reemite asignacion.confirmada a logiq360 (ya lo recibió en la confirmación original)', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ ...asigPorReconfirmar, oferta_external_ref: 'EXT-123' });
    AsignacionesModel.obtenerPorId
      .mockResolvedValueOnce({ id: 500, empresa_id: 7, trabajador_id: 99, estado: 'por_reconfirmar' })
      .mockResolvedValueOnce({ id: 500, empresa_id: 7, estado: 'confirmado' });
    TrabajadoresModel.obtenerUsuarioIdYRol.mockResolvedValue({ usuario_id: 42, rol: 'admin_empresa' });
    TrabajadoresModel.obtenerUsuarioId.mockResolvedValue(42);
    AsignacionesModel.confirmar.mockResolvedValue({ ok: true });

    await AsignacionesService.reconfirmar(7, 500, 42, true);

    expect(IntegracionService.emitir).not.toHaveBeenCalled();
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: 'Participación reconfirmada' })
    );
  });

  test('acepta:true fallido por carrera muestra un mensaje específico de reconfirmación, no el genérico de "pendiente"', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue(asigPorReconfirmar);
    AsignacionesModel.obtenerPorId.mockResolvedValue({ id: 500, empresa_id: 7, trabajador_id: 99, estado: 'por_reconfirmar' });
    TrabajadoresModel.obtenerUsuarioIdYRol.mockResolvedValue({ usuario_id: 42, rol: 'admin_empresa' });
    AsignacionesModel.confirmar.mockResolvedValue({ ok: false, motivo: 'estado' });

    await expect(AsignacionesService.reconfirmar(7, 500, 42, true)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Esta asignación ya no está esperando reconfirmación',
    });
  });
});

// Regresión: AsignacionesModel.confirmar() amplió su guard para aceptar
// 'por_reconfirmar' (necesario para que el trabajador se reconfirme a sí
// mismo). Sin el parámetro estadosValidos con default ['pendiente'], la ruta
// de GESTOR POST /:id/confirmar (que llama a AsignacionesService.confirmar
// sin ese tercer argumento) también habría podido reconfirmar en nombre del
// trabajador una asignación que este nunca vio ni aceptó.
describe('AsignacionesService.confirmar (ruta de gestor) — no debe aceptar por_reconfirmar', () => {
  test('rechaza confirmar una asignación por_reconfirmar sin pasar estadosValidos', async () => {
    AsignacionesModel.obtenerPorId.mockResolvedValue({ id: 500, trabajador_id: 99, estado: 'por_reconfirmar' });
    TrabajadoresModel.obtenerUsuarioIdYRol.mockResolvedValue({ usuario_id: 42, rol: 'admin_empresa' });
    AsignacionesModel.confirmar.mockResolvedValue({ ok: false, motivo: 'estado' });

    await expect(AsignacionesService.confirmar(7, 500)).rejects.toMatchObject({
      statusCode: 409,
      message: 'La asignación no está pendiente de confirmación',
    });

    expect(AsignacionesModel.confirmar).toHaveBeenCalledWith(7, 500, ['pendiente']);
  });
});

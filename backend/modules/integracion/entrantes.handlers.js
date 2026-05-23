'use strict';

const OfertasModel = require('../turnos/ofertas/ofertas.model');
const TrabajadoresModel = require('../trabajadores/trabajadores.model');
const logger = require('../../utils/logger');

/**
 * Handlers de eventos entrantes de logiq360 → App Turnos (ver 05-INTEGRACION.md).
 * Cada handler recibe (empresaId, data), donde `data` es el bloque `data`
 * del webhook. Todos son idempotentes: se apoyan en `external_ref`.
 */

async function ordenCreada(empresaId, data) {
  const existente = await OfertasModel.obtenerPorExternalRef(empresaId, data.external_ref);
  if (existente) return; // ya creada

  await OfertasModel.crear(
    empresaId,
    {
      titulo: data.tipo ? `Orden: ${data.tipo}` : 'Orden de trabajo',
      descripcion: null,
      fecha: data.fecha_programada,
      hora_inicio: data.hora_inicio || '08:00:00',
      hora_fin_estimada: null,
      lugar: [data.direccion, data.ciudad].filter(Boolean).join(', ') || null,
      latitud: null,
      longitud: null,
      plazas_disponibles:
        Array.isArray(data.equipo) && data.equipo.length ? data.equipo.length : 1,
      // La tarifa no viene en el webhook; el jefe de turnos la define al revisar.
      tarifa_dia: 0,
      external_ref: data.external_ref,
    },
    null
  );
}

async function ordenCancelada(empresaId, data) {
  const oferta = await OfertasModel.obtenerPorExternalRef(empresaId, data.external_ref);
  if (oferta && oferta.estado !== 'cancelada' && oferta.estado !== 'completada') {
    await OfertasModel.cancelar(empresaId, oferta.id);
  }
}

async function ordenFechaCambiada(empresaId, data) {
  const oferta = await OfertasModel.obtenerPorExternalRef(empresaId, data.external_ref);
  if (!oferta) return;
  const cambios = {};
  if (data.fecha_programada) cambios.fecha = data.fecha_programada;
  if (data.hora_inicio) cambios.hora_inicio = data.hora_inicio;
  if (Object.keys(cambios).length) {
    await OfertasModel.actualizar(empresaId, oferta.id, cambios);
  }
}

async function ordenCompletada(empresaId, data) {
  const oferta = await OfertasModel.obtenerPorExternalRef(empresaId, data.external_ref);
  if (oferta && oferta.estado !== 'cancelada') {
    await OfertasModel.cambiarEstado(empresaId, oferta.id, 'completada');
  }
}

async function empleadoCreado(empresaId, data) {
  const campos = {
    nombre: data.nombre,
    apellido: data.apellido || '',
    cedula: data.cedula || null,
    telefono: data.telefono || null,
    email: data.email || null,
    cargo: data.cargo || null,
  };
  const existente = await TrabajadoresModel.obtenerPorExternalRef(empresaId, data.external_ref);
  if (existente) {
    await TrabajadoresModel.actualizar(empresaId, existente.id, campos);
  } else {
    await TrabajadoresModel.crear(empresaId, {
      ...campos,
      tipo: 'turnos',
      external_ref: data.external_ref,
    });
  }
}

async function empleadoDesactivado(empresaId, data) {
  const trabajador = await TrabajadoresModel.obtenerPorExternalRef(empresaId, data.external_ref);
  if (trabajador) {
    await TrabajadoresModel.desactivar(empresaId, trabajador.id);
  }
}

const HANDLERS = {
  'orden.creada': ordenCreada,
  'orden.cancelada': ordenCancelada,
  'orden.fecha_cambiada': ordenFechaCambiada,
  'orden.completada': ordenCompletada,
  'empleado.creado': empleadoCreado,
  'empleado.desactivado': empleadoDesactivado,
};

/**
 * Procesa un evento entrante según su tipo.
 * @returns {Promise<boolean>} true si existía un handler para el tipo.
 */
async function procesar(tipoEvento, empresaId, data) {
  const handler = HANDLERS[tipoEvento];
  if (!handler) {
    logger.warn(`[integracion] evento entrante sin handler: ${tipoEvento}`);
    return false;
  }
  await handler(empresaId, data || {});
  return true;
}

module.exports = { procesar };

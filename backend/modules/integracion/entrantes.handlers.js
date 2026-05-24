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
  if (existente) return; // ya creada — idempotente

  // Construir descripción combinando notas para el operario + resumen de productos.
  // El jefe de turnos puede enriquecerla desde la app antes de publicar.
  const partesDesc = [];
  if (data.notas_para_operario) partesDesc.push(data.notas_para_operario);
  if (Array.isArray(data.productos_resumen) && data.productos_resumen.length) {
    partesDesc.push(
      'Productos: ' + data.productos_resumen.map((p) => `${p.cantidad}× ${p.nombre}`).join(', ')
    );
  }

  await OfertasModel.crear(
    empresaId,
    {
      // El payload v1.0 (05-INTEGRACION.md) incluye 'titulo' directamente.
      // Fallback al campo 'tipo' del payload anterior por compatibilidad.
      titulo: data.titulo || (data.tipo ? `Orden: ${data.tipo}` : 'Orden de trabajo'),
      descripcion: partesDesc.join('\n\n') || null,
      // 'fecha' es el campo del payload v1.0; 'fecha_programada' era la versión anterior.
      fecha: data.fecha || data.fecha_programada || null,
      hora_inicio: data.hora_inicio || '08:00:00',
      hora_fin_estimada: data.hora_fin || null,
      // 'ubicacion' es el campo nuevo (string); fallback al par direccion+ciudad anterior.
      lugar: data.ubicacion || [data.direccion, data.ciudad].filter(Boolean).join(', ') || null,
      latitud: data.latitud || null,
      longitud: data.longitud || null,
      // cupos_sugeridos es una sugerencia; el jefe confirma antes de publicar.
      plazas_disponibles:
        data.cupos_sugeridos ||
        (Array.isArray(data.equipo) && data.equipo.length ? data.equipo.length : 1),
      // valor_dia_sugerido puede llegar como hint; el jefe lo confirma/ajusta.
      // Tarifa sugerida por logiq360 (puede ser 0 si no la informan); el jefe confirma.
      tarifa_dia: data.valor_dia_sugerido || 0,
      // Oferta comienza en 'borrador': el jefe de turnos la revisa y publica.
      estado: 'borrador',
      external_ref: data.external_ref,
      alquiler_ref: data.alquiler_ref || null,
      // Notas_para_operario guardadas en columna dedicada para no mezclar con descripción.
      externo_notas: data.notas_para_operario || null,
    },
    null
  );
}

/**
 * orden.publicada — logiq360 inicia la ejecución de la orden.
 * Si la oferta está en borrador, se publica automáticamente para notificar al pool.
 * Si ya está publicada/completada no hace nada (idempotente).
 */
async function ordenPublicada(empresaId, data) {
  const oferta = await OfertasModel.obtenerPorExternalRef(empresaId, data.external_ref);
  if (!oferta) {
    // Puede suceder si orden.creada llegó tarde; lo ignoramos con warning.
    logger.warn(
      `[integracion] orden.publicada: no existe oferta con external_ref=${data.external_ref}`
    );
    return;
  }
  if (oferta.estado === 'borrador') {
    await OfertasModel.cambiarEstado(empresaId, oferta.id, 'publicada');
  }
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

// También necesitamos manejar fecha_cambiada con el campo nuevo 'fecha' (vs 'fecha_programada')
async function ordenFechaCambiadaV2(empresaId, data) {
  const oferta = await OfertasModel.obtenerPorExternalRef(empresaId, data.external_ref);
  if (!oferta) return;
  const cambios = {};
  // Payload v1.0 usa 'fecha_nueva'; payload anterior usaba 'fecha_programada'
  if (data.fecha_nueva) cambios.fecha = data.fecha_nueva;
  else if (data.fecha_programada) cambios.fecha = data.fecha_programada;
  if (data.hora_inicio) cambios.hora_inicio = data.hora_inicio;
  if (Object.keys(cambios).length) {
    await OfertasModel.actualizar(empresaId, oferta.id, cambios);
  }
}

const HANDLERS = {
  'orden.creada': ordenCreada,
  'orden.publicada': ordenPublicada,   // ← nuevo en payload v1.0
  'orden.cancelada': ordenCancelada,
  'orden.fecha_cambiada': ordenFechaCambiadaV2,
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

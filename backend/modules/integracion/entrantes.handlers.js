'use strict';

const { pool } = require('../../config/database');
const OfertasModel = require('../turnos/ofertas/ofertas.model');
const TrabajadoresModel = require('../trabajadores/trabajadores.model');
const logger = require('../../utils/logger');

/**
 * Resuelve el id del cargo "auxiliar" del sistema (seed de migración 012).
 * Se cachea en memoria del proceso porque no cambia: el seed se inserta una
 * sola vez y no hay endpoint que modifique cargos del sistema.
 */
let _cargoAuxiliarId = null;
async function cargoAuxiliarId() {
  if (_cargoAuxiliarId) return _cargoAuxiliarId;
  const [[row]] = await pool.query(
    "SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo = 'auxiliar' LIMIT 1"
  );
  if (!row) {
    throw new Error("Cargo de sistema 'auxiliar' no encontrado (¿faltó migración 012?)");
  }
  _cargoAuxiliarId = row.id;
  return _cargoAuxiliarId;
}

/**
 * Handlers de eventos entrantes de logiq360 → App Turnos (ver 05-INTEGRACION.md).
 * Cada handler recibe (empresaId, data), donde `data` es el bloque `data`
 * del webhook. Todos son idempotentes: se apoyan en `external_ref`.
 */

async function ordenCreada(empresaId, data) {
  const existente = await OfertasModel.obtenerPorExternalRef(empresaId, data.external_ref);
  if (existente) return; // ya creada — idempotente

  // Descripción: productos que se van a montar/desmontar
  let descripcion = null;
  if (Array.isArray(data.productos_resumen) && data.productos_resumen.length) {
    const [[empresa]] = await pool.query(
      'SELECT nombre FROM empresas WHERE id = ? LIMIT 1', [empresaId]
    );
    const listaProductos = data.productos_resumen
      .map((p) => `${p.cantidad}× ${p.nombre}`)
      .join(', ');
    descripcion = `${listaProductos} (${empresa?.nombre ?? 'logiq360'})`;
  }

  // equipo_nomina: empleados de nómina de logiq360 ya asignados (backward-compat con campo 'equipo').
  // Estos NO son cupos gig — aparecen en las notas para que el jefe_turnos los vea.
  const equipoNomina = Array.isArray(data.equipo_nomina) ? data.equipo_nomina
    : (Array.isArray(data.equipo) ? data.equipo : []);

  // cupos_gig: plazas abiertas para trabajadores de turno adicionales.
  // Explícito del payload nuevo; fallback a cupos_sugeridos del payload viejo.
  // Si ninguno está definido → 0 (el jefe_turnos agrega puestos manualmente).
  const cuposGig = data.cupos_gig ?? data.cupos_sugeridos ?? 0;
  const tarifaSugerida = data.valor_dia_sugerido || 0;

  // externo_notas: notas para el operario + lista del equipo de nómina de logiq360
  const notasNomina = equipoNomina.length > 0
    ? `Equipo nómina logiq360 (${equipoNomina.length}): ${
        equipoNomina.map((e) => `${e.nombre}${e.rol ? ` — ${e.rol}` : ''}`).join(', ')
      }`
    : null;
  const externo_notas = [data.notas_para_operario, notasNomina].filter(Boolean).join('\n') || null;

  // Puestos: uno por tipo de cupo recibido. El jefe_turnos puede dividirlos por cargo.
  const puestos = [];
  if (cuposGig > 0) {
    puestos.push({
      cargo_id: await cargoAuxiliarId(),
      plazas: cuposGig,
      tarifa_dia: tarifaSugerida,
      notas: 'Plazas para trabajadores de turno (gig) — el jefe puede dividirlas por cargo',
    });
  }
  if ((data.cupos_custodio ?? 0) > 0) {
    puestos.push({
      cargo_id: await cargoAuxiliarId(), // ponytail: mismo cargo auxiliar — upgrade: cargo 'custodio' dedicado
      plazas: data.cupos_custodio,
      tarifa_dia: data.valor_dia_custodio || 0,
      notas: 'Custodio/logística del evento — aplica a trabajadores nómina y gig',
    });
  }

  await OfertasModel.crear(
    empresaId,
    {
      titulo: data.titulo || (data.tipo ? `Orden: ${data.tipo}` : 'Orden de trabajo'),
      descripcion,
      fecha: data.fecha || data.fecha_programada || null,
      hora_inicio: data.hora_inicio || '08:00:00',
      hora_fin_estimada: data.hora_fin || null,
      lugar: data.ubicacion || [data.direccion, data.ciudad].filter(Boolean).join(', ') || null,
      latitud: data.latitud || null,
      longitud: data.longitud || null,
      estado: 'borrador',
      external_ref: data.external_ref,
      alquiler_ref: data.alquiler_ref || null,
      externo_notas,
      puestos,
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

async function ordenCuposActualizados(empresaId, data) {
  const oferta = await OfertasModel.obtenerPorExternalRef(empresaId, data.external_ref);
  if (!oferta) {
    logger.warn(`[integracion] orden.cupos_actualizados: oferta externa no encontrada (${data.external_ref})`);
    return;
  }
  const cuposGig = data.cupos_gig ?? data.cupos_sugeridos;
  if (cuposGig == null) return;
  // Actualiza el primer puesto gig (cargo auxiliar) — ponytail: un puesto gig por oferta
  await pool.query(
    `UPDATE oferta_puestos SET plazas = ?
     WHERE oferta_id = ? AND cargo_id = (SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo = 'auxiliar' LIMIT 1)
     ORDER BY id LIMIT 1`,
    [cuposGig, oferta.id]
  );
  if (data.valor_dia_sugerido != null) {
    await pool.query(
      `UPDATE oferta_puestos SET tarifa_dia = ?
       WHERE oferta_id = ? AND cargo_id = (SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo = 'auxiliar' LIMIT 1)
       ORDER BY id LIMIT 1`,
      [data.valor_dia_sugerido, oferta.id]
    );
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
  'orden.creada':           ordenCreada,
  'orden.publicada':        ordenPublicada,
  'orden.cancelada':        ordenCancelada,
  'orden.fecha_cambiada':   ordenFechaCambiadaV2,
  'orden.completada':       ordenCompletada,
  'orden.cupos_actualizados': ordenCuposActualizados,
  'empleado.creado':        empleadoCreado,
  'empleado.desactivado':   empleadoDesactivado,
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

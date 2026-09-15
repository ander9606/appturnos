'use strict';

const AsignacionesModel = require('./asignaciones.model');
const ContratosModel    = require('../../contratos/contratos.model');
const ContratosService  = require('../../contratos/contratos.service');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const PuntosMarcajeModel = require('../../puntos-marcaje/puntos-marcaje.model');
const { pool } = require('../../../config/database');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const IntegracionService = require('../../integracion/integracion.service');
const CostoLaborService = require('../../integracion/costo-labor.service');
const AppError = require('../../../utils/AppError');
const logger = require('../../../utils/logger');
const { estaEnAlgunPunto } = require('../../../utils/geoUtils');
const { ahoraColombiaSQL } = require('../../../utils/fechaColombia');
const { buscarMatch, VENTANA_SEG: SOSPECHA_VENTANA_SEG } = require('../../../utils/marcajeSospechoso');
const { fmtFechaCorta } = require('./asignaciones.helpers');

/**
 * Flags this ingreso (and any match found) as sospechoso — best-effort, never throws.
 * Solo dispara si se cumplen las DOS condiciones a la vez: mismo device_id Y
 * proximidad GPS. Mismo criterio que revisarMarcajeSospechoso en nómina.
 */
async function revisarIngresoSospechoso(empresaId, asignacionId, trabajador, horaIngreso, latitud, longitud, deviceId) {
  if (latitud == null || longitud == null || deviceId == null) return;
  try {
    const cercanos = await AsignacionesModel.listarIngresosCercanos(
      empresaId, trabajador.id, horaIngreso, SOSPECHA_VENTANA_SEG
    );
    const match = buscarMatch(cercanos, { latitud, longitud, deviceId });
    if (!match) return;

    await AsignacionesModel.marcarSospechoso(empresaId, [asignacionId, match.registro_id]);

    const otro = await TrabajadoresModel.obtenerPorId(empresaId, match.trabajador_id);
    const [gestores] = await pool.query(
      `SELECT id FROM usuarios WHERE empresa_id = ? AND rol IN ('jefe_turnos','admin_empresa') AND activo = 1`,
      [empresaId]
    );
    if (gestores.length > 0) {
      await NotificacionesService.notificarVarios(gestores.map((g) => g.id), {
        empresaId,
        tipo: 'turno.sospechoso',
        titulo: 'Posible marcaje fraudulento',
        mensaje: `${trabajador.nombre} ${trabajador.apellido} y ${otro?.nombre ?? 'otro trabajador'} ${otro?.apellido ?? ''} marcaron ingreso desde el mismo dispositivo — revisa sus asignaciones.`,
        data: { asignacion_id: asignacionId, otra_asignacion_id: match.registro_id, trabajador_id: trabajador.id, otro_trabajador_id: match.trabajador_id },
      }).catch(() => {});
    }
  } catch {
    // best-effort: un fallo acá no debe impedir que el trabajador marque su ingreso.
  }
}

/**
 * Ingreso/egreso, geofence, marcaje sospechoso, corrección manual, cierre
 * masivo de jornada y bono. Ver asignaciones.service.js para el resto de
 * AsignacionesService.
 */
module.exports = {
  async marcarIngreso(empresaId, id, usuarioId, { latitud, longitud, device_id: deviceId }) {
    const asignacion = await AsignacionesModel.obtenerConDetalles(empresaId, id);
    if (!asignacion) throw new AppError('Asignación no encontrada', 404);

    // Valida la pertenencia usando usuario_id directamente de la asignación.
    // obtenerConDetalles ya trae usuario_id del trabajador vinculado.
    if (asignacion.usuario_id !== usuarioId) {
      throw new AppError('Esta asignación no te pertenece', 403);
    }
    if (asignacion.estado !== 'confirmado') {
      throw new AppError('Solo puedes marcar ingreso en un turno confirmado', 409);
    }

    // Validación de geofence según tipo_geofence del cargo
    const gf = asignacion.geofence_info;
    if (gf.tipo === 'fijo' && gf.latitud != null) {
      const { ok } = estaEnAlgunPunto(latitud, longitud, [{
        latitud: gf.latitud, longitud: gf.longitud, radio_metros: gf.radio_metros,
      }]);
      if (!ok) {
        throw new AppError(
          `Debes estar en "${gf.nombre}" para registrar el ingreso`,
          422
        );
      }
    } else if (gf.tipo === 'zonal') {
      const puntos = await PuntosMarcajeModel.listarZonales(empresaId);
      if (puntos.length > 0) {
        const { ok } = estaEnAlgunPunto(latitud, longitud, puntos);
        if (!ok) {
          throw new AppError(
            'Debes estar en uno de los puntos zonales autorizados para registrar el ingreso',
            422
          );
        }
      }
    } else if (gf.tipo === 'oferta' && gf.latitud != null) {
      const { ok } = estaEnAlgunPunto(latitud, longitud, [{
        latitud: gf.latitud, longitud: gf.longitud, radio_metros: gf.radio_metros,
      }]);
      if (!ok) {
        throw new AppError(
          'Estás fuera del área de trabajo del turno',
          422
        );
      }
    }
    // tipo 'libre' → sin validación

    // Use empresa_id from the DB row — JWT empresa_id is null for marketplace workers.
    const dbEmpresaId = asignacion.empresa_id;

    const horaIngreso = ahoraColombiaSQL();
    await AsignacionesModel.registrarIngreso(dbEmpresaId, id, horaIngreso, latitud, longitud, deviceId);
    const trabajador = { id: asignacion.trabajador_id, nombre: asignacion.trabajador_nombre, apellido: asignacion.trabajador_apellido };
    await revisarIngresoSospechoso(dbEmpresaId, id, trabajador, horaIngreso, latitud, longitud, deviceId);
    await IntegracionService.emitir(dbEmpresaId, 'trabajador.ingreso', {
      external_ref:  asignacion.oferta_external_ref || null,
      empleado_ref:  asignacion.trabajador_external_ref || null,
      asignacion_id: id,
      hora_ingreso:  new Date().toISOString(),
      latitud,
      longitud,
    });

    // Notifica a jefes de turno y admin que el trabajador marcó ingreso (best-effort).
    const [gestores] = await pool.query(
      `SELECT id FROM usuarios
       WHERE empresa_id = ? AND rol IN ('jefe_turnos', 'admin_empresa') AND activo = 1`,
      [dbEmpresaId]
    );
    if (gestores.length > 0) {
      await NotificacionesService.notificarVarios(
        gestores.map((g) => g.id),
        {
          empresaId: dbEmpresaId,
          tipo: 'turno.ingreso',
          titulo: 'Trabajador marcó ingreso',
          mensaje: `${trabajador.nombre} ${trabajador.apellido} registró su llegada al turno.`,
          data: { asignacion_id: id, oferta_id: asignacion.oferta_id },
        }
      );
    }

    return AsignacionesModel.obtenerPorId(dbEmpresaId, id);
  },

  async marcarEgreso(empresaId, id, usuarioId, { firma_b64 }) {
    // obtenerConDetalles handles null empresaId; obtenerPorId does not.
    const asignacion = await AsignacionesModel.obtenerConDetalles(empresaId, id);
    if (!asignacion) throw new AppError('Asignación no encontrada', 404);

    // Use empresa_id from the DB row — JWT empresa_id is null/stale for marketplace
    // workers with trabajador rows in more than one empresa.
    const dbEmpresaId = asignacion.empresa_id;

    // Valida la pertenencia usando usuario_id directamente de la asignación.
    // obtenerConDetalles ya trae usuario_id del trabajador vinculado.
    if (asignacion.usuario_id !== usuarioId) {
      throw new AppError('Esta asignación no te pertenece', 403);
    }
    if (asignacion.estado !== 'en_progreso') {
      throw new AppError('Debes marcar el ingreso antes de marcar la salida', 409);
    }

    const minutosTranscurridos = Math.floor((Date.now() - new Date(asignacion.hora_ingreso_real)) / 60_000);
    if (minutosTranscurridos < 1) {
      throw new AppError('Debes esperar al menos 1 minuto entre el ingreso y la salida', 422);
    }

    await AsignacionesModel.registrarEgreso(dbEmpresaId, id, firma_b64);

    // Notifica a jefes de turno y admin que el trabajador marcó salida (best-effort).
    const [gestoresEgreso] = await pool.query(
      `SELECT id FROM usuarios
       WHERE empresa_id = ? AND rol IN ('jefe_turnos', 'admin_empresa') AND activo = 1`,
      [dbEmpresaId]
    );
    if (gestoresEgreso.length > 0) {
      await NotificacionesService.notificarVarios(
        gestoresEgreso.map((g) => g.id),
        {
          empresaId: dbEmpresaId,
          tipo: 'turno.egreso',
          titulo: 'Trabajador marcó salida',
          mensaje: `${asignacion.trabajador_nombre} ${asignacion.trabajador_apellido} registró su salida del turno.`,
          data: { asignacion_id: id, oferta_id: asignacion.oferta_id },
        }
      );
    }

    // Genera el minicontrato diario si aún no existe y lo firma con la misma
    // firma del egreso (best-effort) — antes solo se firmaba si ya existía,
    // y solo existía si el trabajador había abierto antes el detalle del turno.
    // trabajador_nomina en turno eventual: es un bono sobre su salario ya
    // existente, no un contrato civil independiente — la firma_digital que
    // registrarEgreso ya guardó en la asignación es la confirmación del bono,
    // sin generar contrato ni pasar por la validación de salario mínimo diario.
    const contrato = asignacion.trabajador_tipo === 'nomina'
      ? null
      : await ContratosService.generarParaAsignacion(dbEmpresaId, id).catch(() => null);
    if (contrato && !contrato.firmado_trabajador && firma_b64) {
      await ContratosModel.firmar(dbEmpresaId, contrato.id, firma_b64).catch(() => null);
    }
    // Guarda la firma como atajo reutilizable para el próximo contrato (best-effort).
    await TrabajadoresModel.guardarFirma(asignacion.trabajador_id, firma_b64).catch(() => null);

    await IntegracionService.emitir(dbEmpresaId, 'trabajador.egreso', {
      external_ref:  asignacion.oferta_external_ref || null,
      empleado_ref:  asignacion.trabajador_external_ref || null,
      asignacion_id: id,
      hora_egreso:   new Date().toISOString(),
    });
    // Si este egreso completó la oferta entera, emite costo_labor.calculado
    // a logiq360 y marca la oferta como completada (best-effort).
    await CostoLaborService.verificarYEmitir(dbEmpresaId, asignacion.oferta_id);
    return AsignacionesModel.obtenerPorId(dbEmpresaId, id);
  },

  /**
   * Corrección manual de ingreso y/o egreso por jefe_turnos / admin_empresa.
   * No requiere GPS ni firma digital. Recalcula horas_trabajadas si ambos extremos están presentes.
   * Estados permitidos: confirmado, en_progreso, completado.
   */
  async corregir(empresaId, id, usuarioId, { hora_ingreso_real, hora_egreso_real }, nombreGestor) {
    const asig = await AsignacionesModel.obtenerPorId(empresaId, id);
    if (!asig) throw new AppError('Asignación no encontrada', 404);

    // Validación pre-corrección: verificar que datos relacionados aún existan
    // (oferta, puesto, cargo, trabajador pueden haber sido eliminados)
    const detalles = await AsignacionesModel.obtenerConDetalles(empresaId, id);
    if (!detalles) {
      throw new AppError('No se pueden corregir horas: oferta, puesto, cargo o trabajador fueron eliminados', 410);
    }
    if (!['confirmado', 'en_progreso', 'completado', 'finalizado', 'no_presentado', 'cancelado'].includes(asig.estado)) {
      throw new AppError('Solo se pueden corregir asignaciones confirmadas, en progreso, completadas, finalizadas, no presentadas o canceladas', 409);
    }

    const horaIngreso = hora_ingreso_real !== undefined ? hora_ingreso_real : asig.hora_ingreso_real;
    const horaEgreso  = hora_egreso_real  !== undefined ? hora_egreso_real  : asig.hora_egreso_real;

    // Validar que las horas sean fechas válidas (no NaN)
    if (horaIngreso) {
      const dateIng = new Date(horaIngreso);
      if (isNaN(dateIng.getTime())) {
        throw new AppError('hora_ingreso_real inválida: no se puede interpretar como fecha', 422);
      }
    }
    if (horaEgreso) {
      const dateEgr = new Date(horaEgreso);
      if (isNaN(dateEgr.getTime())) {
        throw new AppError('hora_egreso_real inválida: no se puede interpretar como fecha', 422);
      }
    }

    if (horaIngreso && horaEgreso && new Date(horaEgreso) <= new Date(horaIngreso)) {
      throw new AppError('La hora de egreso debe ser posterior al ingreso', 422);
    }

    let estadoNuevo;
    let horasTrabajadas;
    if (horaIngreso && horaEgreso) {
      estadoNuevo    = 'completado';
      horasTrabajadas = (new Date(horaEgreso) - new Date(horaIngreso)) / 3_600_000;
      if (!Number.isFinite(horasTrabajadas)) {
        throw new AppError('No se puede calcular horas_trabajadas: fechas inválidas', 422);
      }
    } else if (horaIngreso) {
      estadoNuevo    = 'en_progreso';
      horasTrabajadas = null;
    } else {
      estadoNuevo    = 'confirmado';
      horasTrabajadas = null;
    }

    await AsignacionesModel.corregir(empresaId, id, { horaIngreso, horaEgreso, horasTrabajadas, estado: estadoNuevo });

    const resultado = await AsignacionesModel.obtenerConDetalles(empresaId, id);
    if (!resultado) {
      throw new AppError('No se pudo recuperar la asignación después de corregir', 500);
    }

    // Log de auditoría: quién corrigió, qué cambió
    logger.info(`Corrección de turno: asignacion_id=${id}, usuario_id=${usuarioId}, estado_anterior=${asig.estado}, estado_nuevo=${estadoNuevo}, horas_trabajadas=${horasTrabajadas}`);

    if (resultado?.usuario_id) {
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: resultado.usuario_id,
        tipo: 'asignacion.correccion',
        titulo: 'Tu horario fue modificado',
        mensaje: `Tu horario fue modificado por ${nombreGestor || 'tu gestor'} en el turno "${resultado.oferta_titulo}" del ${fmtFechaCorta(resultado.oferta_fecha)}.`,
        data: { asignacion_id: id, oferta_id: asig.oferta_id },
      }).catch(() => {});
    }

    if (resultado?.oferta_external_ref) {
      await IntegracionService.emitir(empresaId, 'trabajador.correccion_horas', {
        external_ref:  resultado.oferta_external_ref,
        empleado_ref:  resultado.trabajador_external_ref || null,
        asignacion_id: id,
        hora_ingreso:  horaIngreso ?? null,
        hora_egreso:   horaEgreso  ?? null,
      });
    }

    // Esta corrección recién cerró el turno sin la firma del trabajador (el
    // gestor no la captura) — avísale para que firme y el turno cuente en su pago.
    // trabajador_nomina en turno eventual: es un bono, no un contrato civil —
    // no aplica la generación de contrato ni el aviso de "falta firmar".
    if (estadoNuevo === 'completado' && asig.estado !== 'completado' && detalles.trabajador_tipo !== 'nomina') {
      // El gestor cierra el turno sin pasar por la app del trabajador, así que
      // el contrato nunca se había generado — sin esto no aparecía en "sin firmar".
      await ContratosService.generarParaAsignacion(empresaId, id).catch(() => {});
      if (resultado?.usuario_id) {
        await NotificacionesService.notificar({
          empresaId,
          usuarioId: resultado.usuario_id,
          tipo: 'contrato.pendiente_firma',
          titulo: 'Falta firmar tu contrato',
          mensaje: 'El gestor corrigió tu turno y quedó completado. Firma el contrato para que el pago cuente en tu liquidación.',
          data: { asignacion_id: id, oferta_id: asig.oferta_id },
        }).catch(() => {});
      }
    }

    if (estadoNuevo === 'completado') {
      // pago_total es la tarifa del PUESTO (mismo criterio que registrarEgreso/
      // cerrarMasivo y que contratos_diarios.valor_dia) — corregir() es el único
      // camino a 'completado' que no la fijaba, dejando el turno en $0. Suma el
      // bono_monto ya asignado para no perderlo si el turno se corrige otra vez.
      await AsignacionesModel.actualizarPagoTotal(
        empresaId, id, Number(resultado.tarifa_dia) + Number(resultado.bono_monto || 0)
      );
      await CostoLaborService.verificarYEmitir(empresaId, asig.oferta_id);
    }

    return resultado;
  },

  /**
   * Agrega o edita el bono manual (ej. propina) de un turno puntual.
   * Bloqueado una vez el contrato del turno ya fue firmado — mismo criterio
   * de inmutabilidad que un período de nómina liquidado (ver descuentos.service.js).
   */
  async agregarBono(empresaId, id, usuario, { monto, motivo }) {
    const asignacion = await AsignacionesModel.obtenerConDetalles(empresaId, id);
    if (!asignacion) throw new AppError('Asignación no encontrada', 404);
    if (asignacion.contrato_firmado) {
      throw new AppError('No se puede modificar el bono: el contrato de este turno ya fue firmado', 409);
    }

    await AsignacionesModel.asignarBono(empresaId, id, {
      monto,
      motivo: motivo || null,
      creadoPor: usuario.sub,
    });

    if (asignacion.usuario_id) {
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: asignacion.usuario_id,
        tipo: 'turno.bono',
        titulo: monto > 0 ? 'Recibiste un bono extra' : 'Tu bono fue actualizado',
        mensaje: monto > 0
          ? `Te asignaron un bono de $${Number(monto).toLocaleString('es-CO')} en "${asignacion.oferta_titulo}"${motivo ? ` por: ${motivo}` : ''}.`
          : `Se quitó el bono asignado a tu turno "${asignacion.oferta_titulo}".`,
        data: { asignacion_id: id },
      }).catch(() => {});
    }

    return AsignacionesModel.obtenerConDetalles(empresaId, id);
  },

  /**
   * Cierre masivo de jornada: completa todos los turnos en_progreso de una oferta.
   * Los trabajador_id en `excepcionesIds` quedan en_progreso para cerrar solos (o en otro cierre).
   */
  async cerrarMasivo(empresaId, ofertaId, excepcionesIds = []) {
    // Verificar que la oferta pertenece a la empresa.
    const [[oferta]] = await pool.query(
      'SELECT id FROM ofertas_turno WHERE id = ? AND empresa_id = ? LIMIT 1',
      [ofertaId, empresaId]
    );
    if (!oferta) throw new AppError('Oferta no encontrada', 404);

    // Recopilar usuarios a notificar (antes de mutar) — dos grupos distintos.
    const excClause = excepcionesIds.length
      ? `AND a.trabajador_id NOT IN (${excepcionesIds.map(() => '?').join(',')})`
      : '';
    const [enProgreso] = await pool.query(
      `SELECT a.id, t.usuario_id, t.tipo AS trabajador_tipo FROM asignaciones_turno a
       JOIN trabajadores t ON t.id = a.trabajador_id
       WHERE a.oferta_id = ? AND a.empresa_id = ? AND a.estado = 'en_progreso'
         AND a.hora_ingreso_real IS NOT NULL ${excClause}`,
      [ofertaId, empresaId, ...excepcionesIds]
    );
    const [confirmados] = await pool.query(
      `SELECT t.usuario_id FROM asignaciones_turno a
       JOIN trabajadores t ON t.id = a.trabajador_id
       WHERE a.oferta_id = ? AND a.empresa_id = ? AND a.estado = 'confirmado'
         ${excClause}`,
      [ofertaId, empresaId, ...excepcionesIds]
    );

    const { cerradas, noPresentados } = await AsignacionesModel.cerrarMasivo(empresaId, ofertaId, excepcionesIds);

    // Genera el contrato diario de cada turno recién completado (best-effort)
    // — el cierre masivo lo completa sin que el trabajador abra la app antes,
    // así que sin esto nunca aparecían en "sin firmar". trabajador_nomina en
    // turno eventual: es un bono, no un contrato civil — no le aplica.
    const enProgresoConContrato = enProgreso.filter((r) => r.trabajador_tipo !== 'nomina');
    await Promise.all(
      enProgresoConContrato.map((r) => ContratosService.generarParaAsignacion(empresaId, r.id).catch(() => {}))
    );

    // Notificaciones best-effort — mensajes distintos por grupo.
    const idsCerrados = enProgresoConContrato.map((r) => r.usuario_id).filter(Boolean);
    if (idsCerrados.length > 0) {
      await NotificacionesService.notificarVarios(idsCerrados, {
        empresaId,
        tipo: 'turno.cerrado_gestor',
        titulo: 'Jornada finalizada — falta tu firma',
        mensaje: 'El gestor cerró tu jornada. Firma el contrato para que el pago cuente en tu liquidación.',
        data: { oferta_id: ofertaId },
      }).catch(() => {});
    }
    const idsAusentes = confirmados.map((r) => r.usuario_id).filter(Boolean);
    if (idsAusentes.length > 0) {
      await NotificacionesService.notificarVarios(idsAusentes, {
        empresaId,
        tipo: 'turno.no_presentado_gestor',
        titulo: 'Marcado como no presentado',
        mensaje: 'No registraste tu ingreso al turno. Fuiste marcado como no presentado.',
        data: { oferta_id: ofertaId },
      }).catch(() => {});
    }

    await CostoLaborService.verificarYEmitir(empresaId, ofertaId);

    return { cerradas, noPresentados, excluidos: excepcionesIds.length };
  },

  /** Descarta un flag de sospechoso tras revisión del gestor. */
  async descartarSospechoso(empresaId, id) {
    const affected = await AsignacionesModel.descartarSospechoso(empresaId, id);
    if (!affected) throw new AppError('Asignación no encontrada', 404);
  },
};

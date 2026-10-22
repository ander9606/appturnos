'use strict';

const OfertasModel = require('./ofertas.model');
const AsignacionesModel = require('../asignaciones/asignaciones.model');
const AsignacionesService = require('../asignaciones/asignaciones.service');
const CargosModel = require('../../cargos/cargos.model');
const TrabajadoresService = require('../../trabajadores/trabajadores.service');
const PuntosMarcajeModel = require('../../puntos-marcaje/puntos-marcaje.model');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const NotificacionesModel = require('../../notificaciones/notificaciones.model');
const CostoLaborService = require('../../integracion/costo-labor.service');
const PeriodosTurnosService = require('../periodos/periodos-turnos.service');
const GeocodingService = require('../../geocoding/geocoding.service');
const AppError = require('../../../utils/AppError');
const {
  ROLES, MAX_OFERTAS_ACTIVAS_POR_EMPRESA, DIAS_GRACIA_ASIGNACIONES_COLGADAS, HORAS_CORTE_EDICION_OFERTA,
} = require('../../../config/constants');
const { ahoraColombiaSQL } = require('../../../utils/fechaColombia');
const logger = require('../../../utils/logger');

/** Valida que cada puesto del array tiene un cargo válido para la empresa. */
async function validarPuestosParaEmpresa(empresaId, puestos) {
  if (!Array.isArray(puestos) || puestos.length === 0) return;
  const ids = [...new Set(puestos.map((p) => Number(p.cargo_id)))];
  for (const id of ids) {
    const cargo = await CargosModel.obtenerPorId(id);
    if (!cargo) throw new AppError(`Cargo ${id} no encontrado`, 404);
    if (!cargo.activo) throw new AppError(`Cargo "${cargo.nombre}" está desactivado`, 409);
    if (cargo.empresa_id !== null && cargo.empresa_id !== empresaId) {
      throw new AppError(`Cargo "${cargo.nombre}" no pertenece a tu empresa`, 403);
    }
  }
  // Detectar duplicados (la UNIQUE (oferta_id, cargo_id) los rechazaría también,
  // pero damos un mensaje claro antes de la transacción).
  if (ids.length !== puestos.length) {
    throw new AppError('No puede haber dos puestos con el mismo cargo en una oferta', 400);
  }
}

/**
 * Advierte (sin bloquear — el pool puede crecer o la oferta puede quedar
 * parcialmente cubierta) cuando un puesto pide más plazas que trabajadores
 * activos certificados para ese cargo hay en la empresa. Si falta personal,
 * suma la salida que corresponda: banco de talento si aún hay cupo en el
 * plan, o subir de plan si ya está en el tope (invitar a alguien más ahí
 * solo rebotaría con 402).
 */
async function advertenciasCapacidad(empresaId, puestos) {
  if (!Array.isArray(puestos) || puestos.length === 0) return { advertencias: [], cupoLleno: false };
  const advertencias = [];
  let cupo = null;
  for (const p of puestos) {
    const cargoId = Number(p.cargo_id);
    const plazas = Number(p.plazas);
    if (!plazas) continue;
    const disponibles = await CargosModel.contarActivosPorEmpresa(cargoId, empresaId);
    if (plazas > disponibles) {
      if (cupo === null) cupo = await TrabajadoresService.obtenerCupoPlan(empresaId);
      const cargo = await CargosModel.obtenerPorId(cargoId);
      const sugerencia = cupo.alTope
        ? `Ya estás en el tope de trabajadores de tu plan (${cupo.limite}) — amplíalo en Mi plan para poder vincular más gente.`
        : 'Puedes invitar más gente desde el Banco de talento.';
      advertencias.push(
        `"${cargo?.nombre ?? 'Cargo ' + cargoId}" pide ${plazas} plaza(s), pero tu empresa solo tiene ` +
        `${disponibles} trabajador(es) activo(s) certificado(s) para ese cargo. ${sugerencia}`
      );
    }
  }
  return { advertencias, cupoLleno: cupo?.alTope ?? false };
}

/**
 * Advierte (sin bloquear) qué invitados de un turno dirigido no tienen ninguno de
 * los cargos de sus puestos: al abrir el turno no verán puestos a los que postularse
 * (ver soloCargosCertificados), así que la invitación no les sirve.
 */
async function advertenciasDestinatarios(empresaId, visibilidad, trabajadorIds, puestos) {
  const ids = [...new Set((trabajadorIds || []).map(Number))];
  const cargoIds = [...new Set((puestos || []).map((p) => Number(p.cargo_id)))];
  if (visibilidad !== 'dirigida' || ids.length === 0 || cargoIds.length === 0) return [];
  const filas = await OfertasModel.nombresSinNingunCargo(empresaId, ids, cargoIds);
  if (filas.length === 0) return [];
  const nombres = filas.map((f) => `${f.nombre} ${f.apellido}`).join(', ');
  return [
    `${filas.length === 1 ? 'Esta persona no tiene' : 'Estas personas no tienen'} ningún cargo de los puestos del turno ` +
    `y no podrán postularse: ${nombres}. Certifícales el cargo o invita a otras personas.`,
  ];
}

/** El desglose de Nominatim trae ciudad bajo distintas llaves según qué tan urbana es la zona. */
function extraerCiudad(address) {
  if (!address) return null;
  return address.city || address.town || address.municipality || address.village || null;
}

/**
 * Resuelve y guarda la ciudad real de la oferta a partir de sus coordenadas
 * (best-effort, no bloquea la creación — mismo patrón que nombrarUbicacion en
 * liquidacion.service.js). Alimenta el filtro por ciudad del directorio de
 * empresas: una empresa con sede en una ciudad puede publicar turnos en otra,
 * y empresas.ciudad (un solo valor autoreportado) no lo refleja.
 */
async function geocodificarCiudadOferta(ofertaId, lat, lng) {
  try {
    const data = await GeocodingService.reverse(lat, lng);
    const ciudad = extraerCiudad(data?.address);
    if (ciudad) await OfertasModel.actualizarCiudad(ofertaId, ciudad);
  } catch (err) {
    logger.warn(`[ofertas] no se pudo geocodificar la ciudad de la oferta ${ofertaId}: ${err.message}`);
  }
}

/**
 * Valida los destinatarios elegidos a mano para un turno dirigido: debe haber
 * al menos uno y todos deben tener vínculo activo con la empresa. El cargo no
 * bloquea la creación, pero sí se avisa (advertenciasDestinatarios) y se exige
 * al postular.
 */
async function validarDestinatarios(empresaId, visibilidad, trabajadorIds) {
  if (visibilidad !== 'dirigida') return;
  const ids = [...new Set((trabajadorIds || []).map(Number))];
  if (ids.length === 0) {
    throw new AppError('Elige al menos una persona para un turno dirigido', 400);
  }
  const activos = await OfertasModel.contarTrabajadoresActivosDeEmpresa(empresaId, ids);
  if (activos !== ids.length) {
    throw new AppError('Alguno de los trabajadores seleccionados no pertenece a esta empresa', 400);
  }
}

/**
 * Valida que los puntos de marcaje elegidos para acotar el geofence zonal de
 * este turno pertenezcan a la empresa — sin esto un cliente podría vincular
 * el punto de otra empresa a su oferta (ver listarZonalesEfectivos).
 */
async function validarPuntosMarcaje(empresaId, puntoMarcajeIds) {
  if (!Array.isArray(puntoMarcajeIds) || puntoMarcajeIds.length === 0) return;
  const ids = [...new Set(puntoMarcajeIds.map(Number))];
  for (const id of ids) {
    const punto = await PuntosMarcajeModel.obtenerPorId(empresaId, id);
    if (!punto) throw new AppError(`Punto de marcaje ${id} no encontrado`, 404);
  }
}

/**
 * Roles que deben recibir el aviso de una oferta según a quién va dirigida —
 * mismo criterio que OfertasService.listar() usa para filtrar qué puede ver
 * cada rol, para no avisarle a alguien de algo que después no puede abrir.
 */
function rolesParaAviso(paraQuien) {
  if (paraQuien === 'nomina') return [ROLES.TRABAJADOR_NOMINA];
  if (paraQuien === 'turnos') return [ROLES.TRABAJADOR_TURNOS];
  return [ROLES.TRABAJADOR_NOMINA, ROLES.TRABAJADOR_TURNOS]; // 'ambos'
}

/**
 * Candidatos a notificar sobre un puesto de una oferta abierta: certificados
 * para el cargo, con vínculo activo, que YA cumplieron su delay de
 * visibilidad por ranking (mismo CASE que OfertasModel.listarMultiEmpresa /
 * delayPorRanking en rankingUtils.js — un trabajador de ranking bajo no debe
 * enterarse de la oferta antes de poder postularse a ella) y que todavía no
 * recibieron este aviso. El filtro NOT EXISTS es lo que permite llamar esta
 * misma función dos veces para la misma oferta sin duplicar notificaciones:
 * una vez al crear/publicar (solo alcanza a ranking ≥4.5, delay 0) y otra vez
 * en el barrido periódico de turnos.worker.js (alcanza al resto cuando a
 * cada quien le toca).
 */
async function listarPendientesDeNotificar(empresaId, oferta, puesto, roles) {
  return OfertasModel.listarCandidatosPendientesDeAviso(empresaId, oferta, puesto, roles);
}

/**
 * Notifica a trabajadores con los cargos solicitados por la oferta
 * (best-effort) — solo a quienes ya les toca verla según su ranking. Se
 * reusa tal cual desde turnos.worker.js para alcanzar después a quienes
 * todavía no cumplían su delay en este primer llamado.
 */
async function notificarPoolPorPuestos(empresaId, oferta) {
  if (oferta.visibilidad === 'dirigida') {
    return notificarDestinatariosDirectos(empresaId, oferta);
  }
  const roles = rolesParaAviso(oferta.para_quien);
  for (const puesto of oferta.puestos || []) {
    // Si este puesto en concreto ya se llenó, no tiene caso avisarle a nadie
    // más sobre él — en el llamado inmediato (recién creado) nunca pasa, pero
    // en el barrido periódico (turnos.worker.js) una oferta con varios puestos
    // puede tener uno lleno y otro no; sin este chequeo se seguía avisando
    // del puesto lleno a quien recién le tocaba por ranking.
    if (puesto.plazas_cubiertas >= puesto.plazas) continue;
    const destinatarios = await listarPendientesDeNotificar(empresaId, oferta, puesto, roles);
    if (destinatarios.length > 0) {
      await NotificacionesService.notificarVarios(
        destinatarios.map((d) => d.usuario_id),
        {
          empresaId,
          tipo: 'oferta.nueva',
          titulo: `Nueva oferta: ${puesto.cargo_nombre}`,
          mensaje: `${oferta.titulo} — ${oferta.fecha} — $${Number(puesto.tarifa_dia).toLocaleString('es-CO')}`,
          data: { oferta_id: oferta.id, puesto_id: puesto.id },
        }
      );
    }
  }
}

/**
 * Avisa a los demás jefe_turnos/admin_empresa de la empresa cuando alguien
 * crea un turno, para que no lo dupliquen sin saberlo — mismo query de
 * co-gestores que asignaciones.marcaje.service.js usa para "sospechoso".
 */
async function notificarCoGestores(empresaId, oferta, creadoPor) {
  const gestoresIds = await NotificacionesModel.idsCoGestoresTurnos(empresaId, creadoPor);
  if (gestoresIds.length === 0) return;
  await NotificacionesService.notificarVarios(gestoresIds, {
    empresaId,
    tipo: 'oferta.creada',
    titulo: 'Nuevo turno creado',
    mensaje: `Se creó el turno "${oferta.titulo}" — ${oferta.fecha}. Revisa antes de crear uno duplicado.`,
    data: { oferta_id: oferta.id },
  });
}

/** Notifica solo a los destinatarios elegidos a mano de un turno dirigido (best-effort). */
async function notificarDestinatariosDirectos(empresaId, oferta) {
  const destinatarios = oferta.destinatarios || [];
  const trabajadorIds = destinatarios.map((d) => d.trabajador_id).filter(Boolean);

  // Un trabajador_nomina sin acepta_extras no puede abrir la oferta (ver
  // validarAceptaExtras) aunque lo hayan elegido a mano — avisarle igual solo
  // lo lleva a un 403 sin explicación.
  let sinExtras = new Set();
  if (trabajadorIds.length > 0) {
    sinExtras = new Set(await OfertasModel.trabajadorIdsNominaSinExtras(trabajadorIds));
  }

  const usuarioIds = destinatarios
    .filter((d) => !sinExtras.has(d.trabajador_id))
    .map((d) => d.usuario_id)
    .filter(Boolean);
  if (usuarioIds.length === 0) return;
  await NotificacionesService.notificarVarios(usuarioIds, {
    empresaId,
    tipo: 'oferta.nueva',
    titulo: `Te invitaron a un turno: ${oferta.titulo}`,
    mensaje: `${oferta.titulo} — ${oferta.fecha}. Te eligieron directamente para este turno.`,
    data: { oferta_id: oferta.id },
  });
}

/**
 * Fecha no pasada + hora_fin_estimada posterior a hora_inicio — mismo criterio
 * que validateStep1() en el mobile (apps/mobile/features/turnos/crear/utils.ts),
 * ahora también exigido en el backend para cerrar el hueco en web/API directa.
 */
function validarFechaHoraOferta({ fecha, hora_inicio, hora_fin_estimada }) {
  if (fecha && fecha < ahoraColombiaSQL().slice(0, 10)) {
    throw new AppError('La fecha del turno no puede ser en el pasado', 422);
  }
  if (hora_inicio && hora_fin_estimada && hora_fin_estimada <= hora_inicio) {
    throw new AppError('La hora de fin debe ser posterior a la hora de inicio', 422);
  }
}

/**
 * Ciclo de vida de la oferta (crear/editar/publicar/cancelar/completar/
 * eliminar/duplicar), gestionado por jefe_turnos/admin_empresa. Ver
 * ofertas.service.js para el resto de OfertasService.
 */
module.exports = {
  /**
   * Crea oferta + puestos en una sola transacción. El body recibe
   * `puestos: [{ cargo_id, plazas, tarifa_dia, notas? }]`. Si la oferta
   * viene de un canal externo (logiq360) puede llegar sin puestos —
   * el jefe los agrega antes de publicar.
   */
  async crear(empresaId, datos, creadoPor) {
    const activas = await OfertasModel.contarActivasPorEmpresa(empresaId);
    if (activas >= MAX_OFERTAS_ACTIVAS_POR_EMPRESA) {
      throw new AppError(
        `Llegaste al máximo de ${MAX_OFERTAS_ACTIVAS_POR_EMPRESA} ofertas activas. Cierra o cancela ofertas antiguas antes de crear nuevas.`,
        409
      );
    }
    await validarPuestosParaEmpresa(empresaId, datos.puestos);
    await validarDestinatarios(empresaId, datos.visibilidad, datos.trabajador_ids);
    await validarPuntosMarcaje(empresaId, datos.punto_marcaje_ids);
    const id = await OfertasModel.crear(empresaId, datos, creadoPor);
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);

    await notificarPoolPorPuestos(empresaId, oferta);
    await notificarCoGestores(empresaId, oferta, creadoPor);

    // Fire-and-forget: la respuesta no espera a Nominatim (cola a ~1 req/s).
    // ubicacion_libre no tiene coordenadas fijas que geocodificar.
    if (!oferta.ubicacion_libre && oferta.latitud != null && oferta.longitud != null) {
      geocodificarCiudadOferta(oferta.id, Number(oferta.latitud), Number(oferta.longitud));
    }

    // No bloquea la creación — solo avisa al gestor si el catálogo de
    // trabajadores de la empresa no alcanza para cubrir lo pedido.
    const { advertencias, cupoLleno } = await advertenciasCapacidad(empresaId, datos.puestos);
    oferta.advertencias = [
      ...advertencias,
      ...await advertenciasDestinatarios(empresaId, datos.visibilidad, datos.trabajador_ids, datos.puestos),
    ];
    oferta.cupo_lleno = cupoLleno;

    return oferta;
  },

  /**
   * Editar fecha/hora_inicio/hora_fin_estimada/lugar (`camposCriticos`) con
   * trabajadores ya 'confirmado' los pasa a 'por_reconfirmar' — dejan de
   * contar en plazas_cubiertas hasta que el propio trabajador reconfirme o
   * decline (ver AsignacionesService.reconfirmar). Por eso esos campos no se
   * pueden tocar si ya hay alguien en_progreso/completado (el turno ya está
   * pasando de verdad) ni a menos de HORAS_CORTE_EDICION_OFERTA de que
   * empiece — no le queda tiempo real al trabajador para reaccionar.
   */
  async actualizar(empresaId, id, datos) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado !== 'abierta' && oferta.estado !== 'borrador') {
      throw new AppError('Solo se puede editar una oferta en borrador o abierta', 409);
    }
    validarFechaHoraOferta({
      fecha: datos.fecha ?? oferta.fecha,
      hora_inicio: datos.hora_inicio ?? oferta.hora_inicio,
      hora_fin_estimada: datos.hora_fin_estimada !== undefined ? datos.hora_fin_estimada : oferta.hora_fin_estimada,
    });

    const camposCriticos = ['fecha', 'hora_inicio', 'hora_fin_estimada', 'lugar'];
    const hayCambioRelevante = camposCriticos.some(
      (k) => datos[k] !== undefined && String(datos[k] ?? '') !== String(oferta[k] ?? '')
    );

    let confirmados = [];
    if (hayCambioRelevante) {
      const asignaciones = await AsignacionesModel.listarPorOferta(empresaId, id);

      const yaIniciado = asignaciones.some((a) => ['en_progreso', 'completado'].includes(a.estado));
      if (yaIniciado) {
        throw new AppError(
          'No puedes cambiar fecha, hora o lugar: ya hay alguien que marcó ingreso en este turno.',
          409
        );
      }

      // El nuevo inicio (fecha/hora_inicio que va a quedar guardado, no el
      // viejo) es lo que le importa al trabajador para reaccionar a tiempo —
      // comparar contra el horario original dejaría pasar sin bloqueo mover un
      // turno de "en 5 días" a "en 20 minutos".
      const fechaNueva = datos.fecha ?? oferta.fecha;
      const horaInicioNueva = datos.hora_inicio ?? oferta.hora_inicio;
      const inicioNuevo = `${fechaNueva} ${horaInicioNueva}`;
      const limiteEdicion = ahoraColombiaSQL(HORAS_CORTE_EDICION_OFERTA * 3_600_000);
      if (inicioNuevo <= limiteEdicion) {
        throw new AppError(
          `No puedes cambiar fecha, hora o lugar a menos de ${HORAS_CORTE_EDICION_OFERTA}h de que empiece el turno.`,
          409
        );
      }

      confirmados = asignaciones.filter((a) => a.estado === 'confirmado');
    }

    await validarPuntosMarcaje(empresaId, datos.punto_marcaje_ids);
    await OfertasModel.actualizar(empresaId, id, datos);

    if (hayCambioRelevante) {
      for (const a of confirmados) {
        // motivo === 'estado' es esperable en una carrera puntual (el trabajador
        // marcó ingreso justo entre el listarPorOferta de arriba y este await) —
        // marcarPorReconfirmar ya protege no tocar a alguien en_progreso. Se
        // registra para no perder de vista un cupo que quedó desincronizado.
        const res = await AsignacionesModel.marcarPorReconfirmar(empresaId, a.id);
        if (!res.ok) {
          logger.warn(`[ofertas] no se pudo pasar a por_reconfirmar la asignación ${a.id} al editar la oferta ${id}: ${res.motivo}`);
        }
      }

      const destinatarios = await AsignacionesModel.listarUsuariosAsignados(empresaId, id);
      await NotificacionesService.notificarVarios(destinatarios, {
        empresaId,
        tipo: 'oferta.modificada',
        titulo: 'Turno modificado — reconfirma tu participación',
        mensaje: `"${oferta.titulo}" cambió de fecha, hora o lugar. Si ya estabas confirmado, debes reconfirmar o tu cupo quedará libre.`,
        data: { oferta_id: id },
      });
    }

    return OfertasModel.obtenerPorId(empresaId, id);
  },

  /**
   * Publica manualmente una oferta en 'borrador' (típicamente creada por
   * logiq360 vía orden.creada) para que sea visible al pool de trabajadores.
   * Normalmente esto lo dispara el evento orden.publicada de logiq360, pero
   * el jefe_turnos puede hacerlo a mano si logiq360 nunca lo envía o si
   * completó los puestos y quiere publicar antes.
   */
  async publicar(empresaId, id) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado !== 'borrador') {
      throw new AppError('Solo se puede publicar una oferta en borrador', 409);
    }
    if (!oferta.puestos || oferta.puestos.length === 0) {
      throw new AppError('Agrega al menos un puesto antes de publicar', 409);
    }

    await OfertasModel.cambiarEstado(empresaId, id, 'publicada');

    // Mismo criterio de notificación que crear() — necesario porque los puestos
    // de una oferta externa se agregan después de crearla y nunca dispararon esto.
    await notificarPoolPorPuestos(empresaId, oferta);

    return OfertasModel.obtenerPorId(empresaId, id);
  },

  async cancelar(empresaId, id) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado === 'cancelada') return;
    if (oferta.estado === 'completada') {
      throw new AppError('No se puede cancelar una oferta completada', 409);
    }

    const destinatarios = await AsignacionesModel.listarUsuariosAsignados(empresaId, id);
    await OfertasModel.cancelar(empresaId, id);

    await NotificacionesService.notificarVarios(destinatarios, {
      empresaId,
      tipo: 'oferta.cancelada',
      titulo: 'Turno cancelado',
      mensaje: `El turno "${oferta.titulo}" del ${oferta.fecha} fue cancelado.`,
      data: { oferta_id: id },
    });
  },

  /**
   * Cancelación por fuerza mayor: quien ya marcó ingreso ('en_progreso')
   * recibe una compensación (pago_total) en vez de perder el turno sin
   * nada — por default la tarifa_dia completa de su puesto, o el monto que
   * el gestor digite en `compensaciones` para esa asignación puntual. El
   * resto de asignaciones no terminales se cancela como siempre, sin pago.
   * @param compensaciones — override opcional `[{ asignacion_id, monto }]`.
   */
  async marcarFallida(empresaId, usuarioId, id, { motivo, compensaciones } = {}) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado === 'cancelada') return;
    if (oferta.estado === 'completada') {
      throw new AppError('No se puede marcar como fallida una oferta completada', 409);
    }

    const activas = await AsignacionesModel.listarActivasConTarifa(empresaId, id);
    const enProgreso = activas.filter((a) => a.estado === 'en_progreso');
    const motivoFinal = (motivo || '').trim() || 'Fuerza mayor';

    const overrides = new Map((compensaciones || []).map((c) => [Number(c.asignacion_id), Number(c.monto)]));
    const montos = enProgreso.map((a) => ({
      asignacionId: a.id,
      monto: overrides.has(a.id) ? overrides.get(a.id) : Number(a.tarifa_dia),
    }));

    const actualizados = await OfertasModel.marcarFallida(empresaId, id, montos, motivoFinal, usuarioId);
    const idsActualizados = new Set(actualizados);

    // Mismo detalle que verá luego en el turno: la frase pedida se mantiene
    // intacta cuando el motivo es el default; si el gestor escribió uno
    // puntual, se lo decimos también en la notificación (no solo en el detalle).
    const detalleMotivo = motivoFinal.toLowerCase() === 'fuerza mayor'
      ? 'fuerza mayor'
      : `fuerza mayor: ${motivoFinal}`;

    const montoPorAsignacion = new Map(montos.map((m) => [m.asignacionId, m.monto]));
    // Solo se notifica a quien de verdad quedó 'fallido' — si alguien marcó
    // egreso justo antes del UPDATE (carrera con marcarFallida), su fila ya
    // no estaba 'en_progreso' y no se le debe prometer una compensación que
    // nunca se aplicó (ver OfertasModel.marcarFallida).
    await Promise.all(enProgreso.filter((a) => idsActualizados.has(a.id)).map((a) => {
      if (!a.usuario_id) return null;
      const monto = montoPorAsignacion.get(a.id);
      return NotificacionesService.notificar({
        empresaId,
        usuarioId: a.usuario_id,
        tipo: 'asignacion.fallido',
        titulo: 'Turno fallido',
        mensaje: `Este turno fue fallido por ${detalleMotivo}, por lo tanto no se podrá realizar. Recibirás una compensación por tu tiempo de $${monto.toLocaleString('es-CO')}.`,
        data: { oferta_id: id, asignacion_id: a.id },
      });
    }));

    const otros = activas.filter((a) => a.estado !== 'en_progreso');
    const destinatariosOtros = otros.map((a) => a.usuario_id).filter(Boolean);
    if (destinatariosOtros.length) {
      await NotificacionesService.notificarVarios(destinatariosOtros, {
        empresaId,
        tipo: 'oferta.cancelada',
        titulo: 'Turno cancelado',
        mensaje: `El turno "${oferta.titulo}" del ${oferta.fecha} fue cancelado.`,
        data: { oferta_id: id },
      });
    }

    // Igual que al cerrar un turno normal: la compensación es un costo de
    // mano de obra (logiq360) y debe caer dentro de un período de turnos.
    await CostoLaborService.verificarYEmitir(empresaId, id).catch(() => {});
    await PeriodosTurnosService.autoCrear(empresaId).catch(() => {});
  },

  /**
   * Marca una oferta como completada a mano. El jefe/admin puede hacerlo en
   * cualquier momento del turno (no depende de que la fecha haya pasado) —
   * es una decisión humana, no un cálculo automático. Sí valida el estado de
   * las asignaciones para no perder datos de nómina:
   *   - 'en_progreso' (marcó ingreso, nunca marcó salida) bloquea mientras el
   *     turno esté "fresco" (menos de DIAS_GRACIA_ASIGNACIONES_COLGADAS desde
   *     su fecha): cerrar acá tocaría horas_trabajadas/pago sin un dato real
   *     de egreso, así que primero se le da tiempo al jefe de resolverlo a
   *     mano (corregir egreso o "No vino"). Pasado ese margen sin que nadie lo
   *     resuelva, se asume abandonado y se fuerza el cierre con el mismo
   *     cerrarMasivo que ya usa turnos.worker.js para ofertas vencidas.
   *     `capearHoras` (default true) decide cómo: capeadas en hora_fin_estimada
   *     (recomendado — no paga de más por los días que quedó colgado) o con la
   *     hora real del cierre si el jefe elige "cerrar ahora" a propósito.
   *   - 'confirmado' sin ingreso (nunca llegó) nunca bloquea: se resuelve solo
   *     como no_presentado de inmediato.
   *   - 'por_reconfirmar' (nadie respondió al cambio de fecha/hora/lugar antes
   *     de completar) tampoco bloquea: se declina solo, sin penalizar ranking
   *     — no es su culpa, nunca llegó a decidir. Sin esto quedaría huérfana
   *     para siempre (la oferta ya no admite POST /confirmar una vez completada).
   *
   * Si la oferta viene de logiq360 (external_ref) el cierre normal vía
   * CostoLaborService emite costo_labor.calculado cuando las condiciones ya
   * se cumplen; si no (turno cerrado antes de que todos terminen), igual se
   * fuerza el estado — el jefe puede estar completando a propósito antes de tiempo.
   */
  async completar(empresaId, id, { capearHoras = true } = {}) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado === 'cancelada') {
      throw new AppError('No se puede completar una oferta cancelada', 409);
    }
    if (oferta.estado === 'completada') return oferta;

    const asignaciones = await AsignacionesModel.listarPorOferta(empresaId, id);
    const enProgreso = asignaciones.filter((a) => a.estado === 'en_progreso');
    const porReconfirmar = asignaciones.filter((a) => a.estado === 'por_reconfirmar');

    const hoy = ahoraColombiaSQL().slice(0, 10);
    const diasDesdeElTurno = Math.floor((Date.parse(hoy) - Date.parse(oferta.fecha)) / 86_400_000);
    const puedeForzar = diasDesdeElTurno >= DIAS_GRACIA_ASIGNACIONES_COLGADAS;

    let noPresentados = 0;
    let forzados = 0;
    if (enProgreso.length > 0 && !puedeForzar) {
      const nombres = enProgreso.map((a) => `${a.trabajador_nombre} ${a.trabajador_apellido}`).join(', ');
      throw new AppError(
        `Antes de completar, resuelve la salida de: ${nombres}. Corrige su marcaje o márcalo como no presentado ` +
        `(si nadie lo resuelve, podrás forzar el cierre pasados ${DIAS_GRACIA_ASIGNACIONES_COLGADAS} días).`,
        409
      );
    } else if (enProgreso.length > 0) {
      const resultado = await AsignacionesService.cerrarMasivo(empresaId, id, [], { capearHoras });
      forzados = resultado.cerradas;
      noPresentados = resultado.noPresentados;
    } else {
      const sinIngreso = asignaciones.filter((a) => a.estado === 'confirmado');
      for (const a of sinIngreso) {
        await AsignacionesModel.marcarNoPresentado(empresaId, a.id);
      }
      noPresentados = sinIngreso.length;
    }

    let autoDeclinados = 0;
    for (const a of porReconfirmar) {
      const res = await AsignacionesModel.declinarReconfirmacion(empresaId, a.id);
      if (res.ok) autoDeclinados++;
    }

    await CostoLaborService.verificarYEmitir(empresaId, id);
    const actualizada = await OfertasModel.obtenerPorId(empresaId, id);
    if (actualizada.estado !== 'completada') {
      await OfertasModel.cambiarEstado(empresaId, id, 'completada');
    }
    const final = await OfertasModel.obtenerPorId(empresaId, id);
    final.no_presentados_al_completar = noPresentados;
    final.forzados_al_completar = forzados;
    final.forzados_con_hora_actual = forzados > 0 && !capearHoras;
    final.auto_declinados_al_completar = autoDeclinados;
    return final;
  },

  /** Borra definitivamente una oferta cancelada que nunca tuvo postulantes (ej: se creó por error). */
  async eliminarDefinitivo(empresaId, id) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado !== 'cancelada') {
      throw new AppError('Solo se pueden eliminar ofertas canceladas.', 409);
    }
    const totalAsignaciones = await AsignacionesModel.contarPorOferta(empresaId, id);
    if (totalAsignaciones > 0) {
      throw new AppError('No se puede eliminar: esta oferta tuvo postulantes.', 409);
    }
    await OfertasModel.eliminarDefinitivo(empresaId, id);
  },

  async duplicar(empresaId, id, nuevaFecha, creadoPor, nuevaHoraInicio) {
    const original = await OfertasModel.obtenerPorId(empresaId, id);
    if (!original) throw new AppError('Oferta no encontrada', 404);
    const activas = await OfertasModel.contarActivasPorEmpresa(empresaId);
    if (activas >= MAX_OFERTAS_ACTIVAS_POR_EMPRESA) {
      throw new AppError(
        `Llegaste al máximo de ${MAX_OFERTAS_ACTIVAS_POR_EMPRESA} ofertas activas. Cierra o cancela ofertas antiguas antes de crear nuevas.`,
        409
      );
    }
    const nuevaId = await OfertasModel.duplicar(empresaId, id, nuevaFecha, creadoPor, nuevaHoraInicio);
    const oferta = await OfertasModel.obtenerPorId(empresaId, nuevaId);
    await notificarCoGestores(empresaId, oferta, creadoPor);
    return oferta;
  },

  /**
   * Reintenta el aviso de "nueva oferta" al pool — pensado para el barrido
   * periódico de turnos.worker.js, que llama esto para cada oferta abierta
   * reciente. notificarPoolPorPuestos ya filtra por delay de ranking cumplido
   * y por quién no fue notificado todavía, así que es seguro llamarlo muchas
   * veces para la misma oferta: cada corrida solo alcanza a quien a quien
   * justo le tocó verla desde el último intento.
   */
  async notificarPoolPendiente(empresaId, oferta) {
    await notificarPoolPorPuestos(empresaId, oferta);
  },
};

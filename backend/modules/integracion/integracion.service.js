'use strict';

const crypto = require('crypto');

const IntegracionModel = require('./integracion.model');
const entrantesHandlers = require('./entrantes.handlers');
const { firmar } = require('../../utils/hmac');
const logger = require('../../utils/logger');
const AppError = require('../../utils/AppError');

/**
 * Servicio de integración con logiq360.
 * Cubre: configuración, recepción de eventos entrantes (con deduplicación)
 * y cola de eventos salientes con reintentos exponenciales.
 */

// Backoff entre reintentos, en segundos (05-INTEGRACION.md): 0 → 30s → 2m → 10m → 1h
const INTERVALOS = [0, 30, 120, 600, 3600];
const MAX_INTENTOS = INTERVALOS.length;

const IntegracionService = {
  // ─── Configuración ──────────────────────────────────────────
  /** Config sin exponer los secretos en claro. */
  async obtenerConfig(empresaId) {
    const cfg = await IntegracionModel.obtenerConfig(empresaId);
    if (!cfg) {
      return { empresa_id: empresaId, activo: 0, webhook_url: null, configurado: false };
    }
    return {
      empresa_id: cfg.empresa_id,
      activo: cfg.activo,
      webhook_url: cfg.webhook_url,
      tiene_webhook_secret: Boolean(cfg.webhook_secret),
      tiene_api_key: Boolean(cfg.api_key),
      tiene_incoming_secret: Boolean(cfg.incoming_secret),
      configurado: true,
    };
  },

  /** Actualiza la config; los campos no enviados conservan su valor. */
  async actualizarConfig(empresaId, datos) {
    const actual = await IntegracionModel.obtenerConfig(empresaId);
    const tomar = (campo) =>
      datos[campo] !== undefined ? datos[campo] : actual ? actual[campo] : null;

    await IntegracionModel.guardarConfig(empresaId, {
      activo: datos.activo !== undefined ? datos.activo : actual?.activo ?? 0,
      webhook_url: tomar('webhook_url'),
      webhook_secret: tomar('webhook_secret'),
      api_key: tomar('api_key'),
      incoming_secret: tomar('incoming_secret'),
      // Preservar el mapeo establecido por el emparejamiento.
      logiq360_tenant_id: tomar('logiq360_tenant_id'),
      logiq360_base_url: tomar('logiq360_base_url'),
    });
    return IntegracionService.obtenerConfig(empresaId);
  },

  /**
   * Empareja con logiq360 a partir de un código generado allá.
   * Decodifica { url, nonce }, confirma contra logiq360, y persiste el bundle de
   * secretos + el mapeo tenant_id↔empresa_id. El humano no ve ningún secreto.
   */
  async emparejar(empresaId, codigo) {
    let url, nonce, webhookUrl;
    try {
      ({ url, nonce, webhook_url: webhookUrl } = JSON.parse(Buffer.from(codigo, 'base64url').toString('utf8')));
    } catch {
      throw new AppError('Código de emparejamiento inválido', 400);
    }
    if (!url || !nonce) throw new AppError('Código de emparejamiento inválido', 400);

    // Auto-detect own base URL from env; fallback to controller-injected PUBLIC_API_URL
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    const appTurnosApiKey = 'at_' + crypto.randomBytes(32).toString('hex');

    const resp = await fetch(`${url.replace(/\/$/, '')}/api/integracion/emparejar/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nonce,
        app_turnos_webhook_url: `${base}/api/integracion/eventos`,
        app_turnos_base_url: base || undefined,
        app_turnos_api_key: appTurnosApiKey,
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new AppError(json.message || `logiq360 rechazó el emparejamiento (HTTP ${resp.status})`, 400);
    }

    const b = json.data || {};
    await IntegracionModel.guardarConfig(empresaId, {
      activo: 1,
      webhook_url: webhookUrl || b.webhook_url,
      webhook_secret: b.webhook_secret,
      api_key: b.api_key,
      incoming_secret: appTurnosApiKey, // key App Turnos generated — logiq360 must use it as X-API-Key
      logiq360_tenant_id: b.tenant_id,
      logiq360_base_url: b.logiq360_base_url,
    });
    return { conectado: true, logiq360_tenant_id: b.tenant_id };
  },

  // ─── Conciliación de personal ───────────────────────────────
  /**
   * Lista los empleados tipo turnos de logiq360 vía su API pull.
   * Usa logiq360_base_url + api_key (K) persistidos por el emparejamiento.
   */
  async _candidatosLogiq360(cfg) {
    if (!cfg?.logiq360_base_url || !cfg?.api_key) return [];
    const base = String(cfg.logiq360_base_url).replace(/\/$/, '');
    const resp = await fetch(`${base}/api/integracion/public/empleados?solo_turnos=true`, {
      headers: { 'X-API-Key': cfg.api_key },
    });
    if (!resp.ok) {
      throw new AppError(`logiq360 rechazó la consulta de empleados (HTTP ${resp.status})`, 502);
    }
    const json = await resp.json().catch(() => ({}));
    return Array.isArray(json.data) ? json.data : [];
  },

  /**
   * Devuelve los trabajadores de App Turnos sin vincular, los candidatos de
   * logiq360, y una sugerencia de match por nombre normalizado.
   */
  async conciliacion(empresaId) {
    const TrabajadoresModel = require('../trabajadores/trabajadores.model');
    const cfg = await IntegracionModel.obtenerConfig(empresaId);
    const [pendientes, candidatos] = await Promise.all([
      TrabajadoresModel.listarSinVincularLogiq360(empresaId),
      IntegracionService._candidatosLogiq360(cfg),
    ]);

    // ponytail: match por nombre normalizado — upgrade path: por cédula/email si logiq360 los expone
    const norm = (s) => String(s || '')
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .toLowerCase().trim().replace(/\s+/g, ' ');
    const porNombre = new Map(
      candidatos.map((c) => [norm(`${c.nombre} ${c.apellido}`), c])
    );

    const pendientesConSugerencia = pendientes.map((t) => {
      const sugerido = porNombre.get(norm(`${t.nombre} ${t.apellido}`)) || null;
      return { ...t, sugerencia: sugerido ? { id: sugerido.id, nombre: `${sugerido.nombre} ${sugerido.apellido}` } : null };
    });

    return { pendientes: pendientesConSugerencia, candidatos };
  },

  /** Vincula un trabajador de App Turnos a un empleado de logiq360. */
  async vincularEmpleado(empresaId, trabajadorId, empleadoId) {
    const TrabajadoresModel = require('../trabajadores/trabajadores.model');
    const afectados = await TrabajadoresModel.vincularExternalRef(
      empresaId, trabajadorId, `logiq360:empleado:${empleadoId}`
    );
    if (!afectados) throw new AppError('Trabajador no encontrado', 404);
    return { vinculado: true };
  },

  async estado(empresaId) {
    const cfg = await IntegracionModel.obtenerConfig(empresaId);
    const eventos = await IntegracionModel.estadisticas(empresaId);
    return {
      activo: Boolean(cfg?.activo),
      webhook_configurado: Boolean(cfg?.webhook_url),
      eventos,
    };
  },

  // ─── Eventos entrantes ──────────────────────────────────────
  /**
   * Recibe un evento de logiq360: lo registra (deduplicando por event_id)
   * y lo procesa con el handler correspondiente.
   */
  async recibirEvento({ empresaId, eventId, tipoEvento, payload }) {
    const cfg = await IntegracionModel.obtenerConfig(empresaId);
    if (!cfg || !cfg.activo) {
      throw new AppError('Integración no activa para este tenant', 403);
    }

    let registroId;
    try {
      registroId = await IntegracionModel.registrarEntrante({
        empresaId,
        eventId,
        tipoEvento,
        payload,
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return { duplicado: true }; // ya recibido: idempotente
      }
      throw err;
    }

    try {
      await entrantesHandlers.procesar(tipoEvento, empresaId, payload?.data);
      await IntegracionModel.marcarEntranteProcesado(registroId);
      return { duplicado: false, procesado: true };
    } catch (err) {
      await IntegracionModel.marcarEntranteError(registroId, err.message);
      logger.error(`[integracion] error procesando ${tipoEvento}:`, err.message);
      return { duplicado: false, procesado: false };
    }
  },

  // ─── Eventos salientes ──────────────────────────────────────
  /** Encola un evento hacia logiq360. Best-effort: nunca lanza. */
  async emitir(empresaId, tipoEvento, payload) {
    try {
      const cfg = await IntegracionModel.obtenerConfig(empresaId);
      if (!cfg || !cfg.activo) return; // integración inactiva
      await IntegracionModel.encolarSaliente({
        empresaId,
        eventId: crypto.randomUUID(),
        tipoEvento,
        payload,
      });
    } catch (err) {
      logger.error('[integracion] no se pudo encolar el evento:', err.message);
    }
  },

  /** Procesa la cola de eventos salientes pendientes. */
  async procesarCola() {
    const eventos = await IntegracionModel.listarPendientes(50);
    for (const evento of eventos) {
      await IntegracionService._enviar(evento);
    }
    return eventos.length;
  },

  async _enviar(evento) {
    const intentos = evento.intentos + 1;

    if (!evento.webhook_url) {
      await IntegracionModel.marcarSalienteFallido(evento.id, intentos, 'webhook_url no configurado');
      return;
    }

    const cuerpo = JSON.stringify({
      event_id: evento.event_id,
      tipo_evento: evento.tipo_evento,
      timestamp: new Date().toISOString(),
      data: evento.payload,
    });

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (evento.webhook_secret) {
        headers['X-Turnos-Signature'] = firmar(cuerpo, evento.webhook_secret);
      }
      // logiq360 autentica nuestros webhooks por X-API-Key además de la firma.
      if (evento.api_key) {
        headers['X-API-Key'] = evento.api_key;
      }
      const resp = await fetch(evento.webhook_url, { method: 'POST', headers, body: cuerpo, signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await IntegracionModel.marcarSalienteEnviado(evento.id, intentos);
    } catch (err) {
      if (intentos >= MAX_INTENTOS) {
        await IntegracionModel.marcarSalienteFallido(evento.id, intentos, err.message);
        logger.error(
          `[integracion] evento ${evento.event_id} descartado tras ${intentos} intentos`
        );
      } else {
        await IntegracionModel.reprogramarSaliente(
          evento.id,
          intentos,
          INTERVALOS[intentos],
          err.message
        );
      }
    }
  },

  // ─── Endpoints públicos pull (logiq360 → App Turnos) ──────────────────────
  /**
   * Estado de una oferta y sus contratos a partir del external_ref.
   * GET /api/integracion/public/estado/:external_ref
   * Ref: docs/INTEGRACION-LOGIQ360-APP-TURNOS.md
   */
  async publicEstado(empresaId, externalRef) {
    const OfertasModel = require('../turnos/ofertas/ofertas.model');
    const AsignacionesModel = require('../turnos/asignaciones/asignaciones.model');

    const oferta = await OfertasModel.obtenerPorExternalRef(empresaId, externalRef);
    if (!oferta) {
      return { encontrado: false, external_ref: externalRef };
    }

    const asignaciones = await AsignacionesModel.listarPorOferta(empresaId, oferta.id);

    // Desde migración 013, las plazas viven en los puestos: sumar todos.
    const puestos = Array.isArray(oferta.puestos) ? oferta.puestos : [];
    const cuposRequeridos = puestos.reduce((acc, p) => acc + Number(p.plazas || 0), 0);
    const cuposCubiertos = puestos.reduce((acc, p) => acc + Number(p.plazas_cubiertas || 0), 0);

    return {
      encontrado: true,
      external_ref: externalRef,
      oferta_id: oferta.id,
      estado: oferta.estado,
      cupos_requeridos: cuposRequeridos,
      cupos_cubiertos: cuposCubiertos,
      puestos: puestos.map((p) => ({
        cargo: p.cargo_codigo,
        plazas: p.plazas,
        plazas_cubiertas: p.plazas_cubiertas,
        tarifa_dia: p.tarifa_dia,
      })),
      contratos: asignaciones.map((a) => ({
        trabajador_ref: a.external_ref || null,
        trabajador_nombre: `${a.trabajador_nombre} ${a.trabajador_apellido || ''}`.trim(),
        estado: a.estado,
        hora_ingreso: a.hora_ingreso || null,
        hora_egreso: a.hora_egreso || null,
      })),
    };
  },

  /**
   * Quién está actualmente en campo (ingreso marcado, sin egreso).
   * GET /api/integracion/public/en-sitio/:external_ref
   */
  async publicEnSitio(empresaId, externalRef) {
    const OfertasModel = require('../turnos/ofertas/ofertas.model');
    const AsignacionesModel = require('../turnos/asignaciones/asignaciones.model');

    const oferta = await OfertasModel.obtenerPorExternalRef(empresaId, externalRef);
    if (!oferta) {
      return { encontrado: false, external_ref: externalRef, en_sitio: [], total: 0 };
    }

    const asignaciones = await AsignacionesModel.listarPorOferta(empresaId, oferta.id);
    const enSitio = asignaciones.filter((a) => a.hora_ingreso && !a.hora_egreso);

    return {
      encontrado: true,
      external_ref: externalRef,
      en_sitio: enSitio.map((a) => ({
        trabajador_nombre: `${a.trabajador_nombre} ${a.trabajador_apellido || ''}`.trim(),
        hora_ingreso: a.hora_ingreso,
        dentro_zona: a.ingreso_dentro_zona ?? null,
      })),
      total: enSitio.length,
    };
  },
};

module.exports = IntegracionService;

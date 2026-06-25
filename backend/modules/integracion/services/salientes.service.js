'use strict';

const crypto = require('crypto');
const IntegracionModel = require('../integracion.model');
const { firmar } = require('../../../utils/hmac');
const logger = require('../../../utils/logger');

// Backoff entre reintentos (05-INTEGRACION.md): 0 → 30s → 2m → 10m → 1h
const INTERVALOS = [0, 30, 120, 600, 3600];
const MAX_INTENTOS = INTERVALOS.length;

const SalientesService = {
  async estado(empresaId) {
    const cfg = await IntegracionModel.obtenerConfig(empresaId);
    const eventos = await IntegracionModel.estadisticas(empresaId);
    return {
      activo: Boolean(cfg?.activo),
      webhook_configurado: Boolean(cfg?.webhook_url),
      eventos,
    };
  },

  /** Encola un evento hacia logiq360. Best-effort: nunca lanza. */
  async emitir(empresaId, tipoEvento, payload) {
    try {
      const cfg = await IntegracionModel.obtenerConfig(empresaId);
      if (!cfg || !cfg.activo) return;
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
      await SalientesService._enviar(evento);
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
      if (evento.api_key) {
        headers['X-API-Key'] = evento.api_key;
      }
      const resp = await fetch(evento.webhook_url, { method: 'POST', headers, body: cuerpo, signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await IntegracionModel.marcarSalienteEnviado(evento.id, intentos);
    } catch (err) {
      if (intentos >= MAX_INTENTOS) {
        await IntegracionModel.marcarSalienteFallido(evento.id, intentos, err.message);
        logger.error(`[integracion] evento ${evento.event_id} descartado tras ${intentos} intentos`);
      } else {
        await IntegracionModel.reprogramarSaliente(evento.id, intentos, INTERVALOS[intentos], err.message);
      }
    }
  },

  // ─── Endpoints pull públicos (logiq360 consulta Zaturno) ─────────────────

  async publicEstado(empresaId, externalRef) {
    const OfertasModel = require('../../turnos/ofertas/ofertas.model');
    const AsignacionesModel = require('../../turnos/asignaciones/asignaciones.model');

    const oferta = await OfertasModel.obtenerPorExternalRef(empresaId, externalRef);
    if (!oferta) return { encontrado: false, external_ref: externalRef };

    const asignaciones = await AsignacionesModel.listarPorOferta(empresaId, oferta.id);
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

  async publicEnSitio(empresaId, externalRef) {
    const OfertasModel = require('../../turnos/ofertas/ofertas.model');
    const AsignacionesModel = require('../../turnos/asignaciones/asignaciones.model');

    const oferta = await OfertasModel.obtenerPorExternalRef(empresaId, externalRef);
    if (!oferta) return { encontrado: false, external_ref: externalRef, en_sitio: [], total: 0 };

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

module.exports = SalientesService;

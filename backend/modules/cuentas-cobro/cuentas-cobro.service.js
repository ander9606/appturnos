'use strict';

const CuentasCobroModel = require('./cuentas-cobro.model');
const PeriodosModel = require('../nomina/periodos/periodos.model');
const AsignacionesModel = require('../turnos/asignaciones/asignaciones.model');
const TrabajadoresModel = require('../trabajadores/trabajadores.model');
const NotificacionesService = require('../notificaciones/notificaciones.service');
const AppError = require('../../utils/AppError');
const { ROLES } = require('../../config/constants');

function verificarAcceso(cuenta, usuario) {
  if (
    usuario.rol === ROLES.TRABAJADOR_TURNOS &&
    cuenta.trabajador_usuario_id !== usuario.sub
  ) {
    throw new AppError('No tienes acceso a esta cuenta de cobro', 403);
  }
}

const redondear = (n) => Math.round(Number(n) * 100) / 100;

const fechaCorta = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

/** Línea completa de un turno que aún no estaba en ninguna cuenta firmada. */
function itemCompleto(t) {
  return {
    asignacion_id: t.asignacion_id,
    fecha: t.oferta_fecha,
    descripcion: t.oferta_titulo,
    cargo: t.cargo_nombre,
    lugar: t.lugar,
    hora_inicio: t.hora_inicio,
    hora_fin: t.hora_fin_estimada,
    horas: t.horas_trabajadas,
    // pago_total ya viene neto de descuentos aceptados (ver liquidación de turnos).
    valor_base: t.pago_total + (t.descuento_monto ?? 0) - (t.pago_extra ?? 0) - (t.bono_monto ?? 0),
    pago_extra: t.pago_extra ?? 0,
    bono_monto: t.bono_monto ?? 0,
    bono_motivo: t.bono_motivo ?? null,
    descuento_monto: t.descuento_monto ?? 0,
    descuento_motivo: t.descuento_motivo ?? null,
    valor: t.pago_total,
  };
}

/** Solo la diferencia de un turno ya cobrado: sin horas ni desglose para no contarlos dos veces. */
function itemDiferencia(t, diferencia) {
  return {
    asignacion_id: t.asignacion_id,
    fecha: t.oferta_fecha,
    descripcion: `${t.oferta_titulo} (ajuste por diferencia)`,
    cargo: t.cargo_nombre,
    lugar: t.lugar,
    hora_inicio: t.hora_inicio,
    hora_fin: t.hora_fin_estimada,
    horas: 0,
    valor_base: diferencia,
    pago_extra: 0,
    bono_monto: 0,
    bono_motivo: null,
    descuento_monto: 0,
    descuento_motivo: null,
    valor: diferencia,
  };
}

const CuentasCobroService = {
  /**
   * Genera (o refresca) las cuentas de cobro de los trabajadores con turnos
   * completados en el rango del período. El sistema de turnos ya es inherentemente
   * prestación de servicios por diseño (mismo criterio que contratoPdf.js) — no
   * depende de empresas.tipo_contrato. Idempotente: se puede volver a llamar.
   *
   * Reglas por trabajador:
   *  - Cuenta original (secuencia 1): solo se genera cuando TODOS sus turnos del
   *    período tienen el contrato firmado. Si falta alguno no se genera y se avisa
   *    (al trabajador y a los gestores) — así una cuenta nunca cobra "a medias".
   *  - Una cuenta firmada es lo ya cobrado y no se reescribe. Si después un turno
   *    cambia (p. ej. un bono y el trabajador vuelve a firmar el contrato) o aparece
   *    un turno firmado tarde, se genera otra cuenta COMPLEMENTARIA (secuencia 2, 3…)
   *    solo por la diferencia. Diferencias negativas o cero no generan nada.
   *  - Mientras la última cuenta siga sin firmar se refresca en el lugar.
   *
   * trabajadorId: limita a ese trabajador (p. ej. al aceptar un descuento).
   * notificar=false: no avisa de cuentas nuevas ni de bloqueos.
   * avisarBloqueo: por defecto igual a notificar; false avisa solo de cuentas nuevas.
   */
  async generarParaPeriodo(empresaId, periodoId, { trabajadorId = null, notificar = true, avisarBloqueo = notificar } = {}) {
    const periodo = await PeriodosModel.obtenerPorId(empresaId, periodoId);
    if (!periodo) throw new AppError('Período no encontrado', 404);

    const trabajadores = await AsignacionesModel.liquidacion(empresaId, {
      fechaInicio: periodo.fecha_inicio,
      fechaFin: periodo.fecha_fin,
    });

    const rango = `${fechaCorta(periodo.fecha_inicio)} – ${fechaCorta(periodo.fecha_fin)}`;
    let generadas = 0;
    const bloqueados = [];
    for (const w of trabajadores) {
      if (trabajadorId != null && w.trabajador_id !== trabajadorId) continue;

      const cuentas = await CuentasCobroModel.listarPorPeriodoYTrabajador(empresaId, periodoId, w.trabajador_id);
      const firmadas = cuentas.filter((c) => c.firmado_trabajador);
      const abierta = cuentas.find((c) => !c.firmado_trabajador) ?? null;

      const sinFirmar = w.turnos.filter((t) => !t.firmado_trabajador).length;
      if (cuentas.length === 0 && sinFirmar > 0) {
        bloqueados.push({ w, sinFirmar });
        continue;
      }

      // Lo ya cobrado por turno en cuentas firmadas; el resto es nuevo o diferencia.
      const cobrado = new Map();
      for (const c of firmadas) {
        for (const it of c.items) {
          cobrado.set(it.asignacion_id, (cobrado.get(it.asignacion_id) ?? 0) + Number(it.valor));
        }
      }
      const items = [];
      for (const t of w.turnos) {
        if (!t.firmado_trabajador) continue;
        const previo = cobrado.get(t.asignacion_id);
        if (previo === undefined) {
          items.push(itemCompleto(t));
        } else {
          const diferencia = redondear(t.pago_total - previo);
          if (diferencia > 0) items.push(itemDiferencia(t, diferencia));
        }
      }
      if (items.length === 0) continue;

      const secuencia = abierta
        ? abierta.secuencia
        : (firmadas.length ? Math.max(...firmadas.map((c) => c.secuencia)) + 1 : 1);
      const valorTotal = redondear(items.reduce((s, i) => s + i.valor, 0));

      const id = await CuentasCobroModel.crear(empresaId, {
        periodoId,
        trabajadorId: w.trabajador_id,
        secuencia,
        numeroCuenta: secuencia === 1
          ? `CC-${periodoId}-${w.trabajador_id}`
          : `CC-${periodoId}-${w.trabajador_id}-${secuencia}`,
        fechaInicio: periodo.fecha_inicio,
        fechaFin: periodo.fecha_fin,
        totalTurnos: items.length,
        totalHoras: items.reduce((s, i) => s + i.horas, 0),
        valorTotal,
        items,
      });
      generadas++;

      // Solo se avisa de una cuenta nueva, no de refrescar una que ya estaba sin firmar.
      if (notificar && w.usuario_id && !abierta) {
        await NotificacionesService.notificar({
          empresaId,
          usuarioId: w.usuario_id,
          tipo: 'cuenta_cobro.pendiente_firma',
          titulo: secuencia === 1 ? 'Tu cuenta de cobro está lista' : 'Tienes una cuenta de cobro complementaria',
          mensaje: secuencia === 1
            ? `Firma tu cuenta de cobro del período ${rango} para completar tu pago.`
            : `Se generó una cuenta de cobro por la diferencia de $${valorTotal.toLocaleString('es-CO')} en tus turnos del período ${rango}. Fírmala para completar tu pago.`,
          data: { cuenta_cobro_id: id, periodo_id: periodoId },
        }).catch(() => {});
      }
    }

    if (avisarBloqueo && bloqueados.length > 0) {
      await this._avisarBloqueados(empresaId, periodoId, rango, bloqueados);
    }
    return { generadas, bloqueados: bloqueados.length };
  },

  /** Avisa al trabajador qué le falta y, una sola vez, a los gestores quiénes quedaron sin cuenta. */
  async _avisarBloqueados(empresaId, periodoId, rango, bloqueados) {
    for (const { w, sinFirmar } of bloqueados) {
      if (!w.usuario_id) continue;
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: w.usuario_id,
        tipo: 'cuenta_cobro.bloqueada_sin_firma',
        titulo: 'Aún no podemos generar tu cuenta de cobro',
        mensaje: `Tienes ${sinFirmar} turno${sinFirmar !== 1 ? 's' : ''} del período ${rango} sin firmar. `
          + 'Fírmalos todos para que se genere tu cuenta de cobro.',
        data: { periodo_id: periodoId, turnos_sin_firmar: sinFirmar },
      }).catch(() => {});
    }

    const nombres = bloqueados.map(({ w }) => `${w.nombre} ${w.apellido}`);
    const lista = nombres.length > 5 ? `${nombres.slice(0, 5).join(', ')} y ${nombres.length - 5} más` : nombres.join(', ');
    const gestores = await CuentasCobroModel.listarGestoresUsuarioIds(empresaId);
    await NotificacionesService.notificarVarios(gestores, {
      empresaId,
      tipo: 'cuenta_cobro.trabajadores_sin_firma',
      titulo: 'Cuentas de cobro sin generar',
      mensaje: `No se pudo generar la cuenta de cobro del período ${rango} para ${nombres.length} trabajador`
        + `${nombres.length !== 1 ? 'es' : ''} porque no han firmado todos sus turnos: ${lista}.`,
      data: { periodo_id: periodoId },
    });
  },

  /**
   * El trabajador firmó el contrato de un turno cuyo período ya cerró: genera su cuenta de
   * cobro si ya cumple (todos firmados) o una complementaria por la diferencia si el turno
   * cambió o llegó tarde (ver generarParaPeriodo). Avisa de la cuenta nueva, no de lo que
   * aún le falta firmar. Con el período aún abierto no hace nada: el cierre la generará.
   */
  async actualizarPorTurnoFirmado(empresaId, asignacionId, trabajadorId) {
    const periodoId = await CuentasCobroModel.periodoCerradoDeAsignacion(empresaId, asignacionId);
    if (!periodoId) return null;
    return this.generarParaPeriodo(empresaId, periodoId, { trabajadorId, notificar: true, avisarBloqueo: false });
  },

  async listarMisCuentas(usuario) {
    return CuentasCobroModel.listarPorUsuario(usuario.sub);
  },

  async listarSinFirmar(usuario) {
    return CuentasCobroModel.listarSinFirmarPorUsuario(usuario.sub);
  },

  async obtener(empresaId, id, usuario) {
    const cuenta = await CuentasCobroModel.obtenerPorId(empresaId, id);
    if (!cuenta) throw new AppError('Cuenta de cobro no encontrada', 404);
    verificarAcceso(cuenta, usuario);
    return cuenta;
  },

  async firmar(empresaId, id, usuario, firmaB64) {
    const cuenta = await CuentasCobroModel.obtenerPorId(empresaId, id);
    if (!cuenta) throw new AppError('Cuenta de cobro no encontrada', 404);
    if (cuenta.trabajador_usuario_id !== usuario.sub) {
      throw new AppError('Solo el trabajador puede firmar esta cuenta de cobro', 403);
    }
    if (cuenta.firmado_trabajador) {
      throw new AppError('La cuenta de cobro ya está firmada', 409);
    }
    const realEmpresaId = cuenta.empresa_id;
    await CuentasCobroModel.firmar(realEmpresaId, id, firmaB64);
    await TrabajadoresModel.guardarFirma(cuenta.trabajador_id, firmaB64).catch(() => null);
    return CuentasCobroModel.obtenerPorId(realEmpresaId, id);
  },
};

module.exports = CuentasCobroService;

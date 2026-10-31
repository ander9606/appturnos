'use strict';

const EmpresasModel   = require('../empresas/empresas.model');
const { enviarEmail } = require('../../utils/mailer');
const { plantillaCorreo, esc } = require('../../utils/plantillaCorreo');
const WompiService    = require('../webhooks/wompi.service');
const NotificacionesService = require('../notificaciones/notificaciones.service');
const NotificacionesModel   = require('../notificaciones/notificaciones.model');
const logger          = require('../../utils/logger');
const { DIAS_GRACIA_SUSCRIPCION } = require('../../config/constants');

const INTERVALO_MS = 24 * 60 * 60 * 1000; // cada 24h

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const cop = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

/**
 * Qué decirle a la empresa según el día respecto al vencimiento (dias > 0: faltan; 0: hoy; < 0: ya venció).
 * `consecuencia` dice qué pasa y qué NO pasa: el marcaje de los trabajadores nunca se bloquea.
 */
function mensajeEtapa(dias) {
  const gracia = DIAS_GRACIA_SUSCRIPCION;
  const limites = 'no podrás crear ni editar turnos, trabajadores ni nómina';
  const siguesPudiendo = 'Tu información está a salvo y tus empleados seguirán pudiendo marcar ingreso y egreso.';
  if (dias > 0) {
    return {
      asunto: `Tu suscripción de Zaturno vence en ${plural(dias, 'día', 'días')}`,
      titulo: 'Tu suscripción está por vencer',
      intro: `vence en <strong>${plural(dias, 'día', 'días')}</strong>`,
      consecuencia: `Si no renuevas, tendrás ${plural(gracia, 'día', 'días')} de gracia; después ${limites}. ${siguesPudiendo}`,
      inApp: `La suscripción vence en ${plural(dias, 'día', 'días')}.`,
    };
  }
  if (dias === 0) {
    return {
      asunto: '⚠️ Tu suscripción de Zaturno vence hoy',
      titulo: 'Tu suscripción vence hoy',
      intro: 'vence <strong>hoy</strong>',
      consecuencia: `Si no renuevas, tendrás ${plural(gracia, 'día', 'días')} de gracia; después ${limites}. ${siguesPudiendo}`,
      inApp: 'La suscripción vence hoy.',
    };
  }
  if (-dias < gracia) {
    const quedan = gracia + dias;
    return {
      asunto: `Tu suscripción de Zaturno venció: te ${quedan === 1 ? 'queda 1 día' : `quedan ${quedan} días`} de gracia`,
      titulo: 'Tu suscripción venció',
      intro: `venció hace <strong>${plural(-dias, 'día', 'días')}</strong>`,
      consecuencia: `Te ${quedan === 1 ? 'queda 1 día' : `quedan ${quedan} días`} de gracia; después ${limites}. ${siguesPudiendo}`,
      inApp: `La suscripción venció hace ${plural(-dias, 'día', 'días')}. Renueva antes de que termine la gracia.`,
    };
  }
  return {
    asunto: 'Tu cuenta de Zaturno quedó en modo consulta',
    titulo: 'Renueva para volver a gestionar',
    intro: `venció hace <strong>${plural(-dias, 'día', 'días')}</strong> y terminó el plazo de gracia`,
    consecuencia: `Mientras no renueves, ${limites}. ${siguesPudiendo}`,
    inApp: `La suscripción venció hace ${plural(-dias, 'día', 'días')}: la gestión está bloqueada hasta que se renueve.`,
  };
}

/**
 * Busca empresas cuyo vencimiento cae en un día de aviso (ver DIAS_AVISO_SUSCRIPCION: antes, el día,
 * durante la gracia y al terminar), avisa al admin por correo con dos links de pago (un mes o el año),
 * a los gestores dentro de la app y al super_admin. logiq360 está excluido (suscripcion_origen = 'logiq360').
 */
async function procesarRenovaciones() {
  const empresas = await EmpresasModel.listarConRenovacionPendiente();

  if (empresas.length === 0) return;

  logger.info(`[suscripcion-worker] ${empresas.length} empresa(s) con renovación pendiente`);

  for (const emp of empresas) {
    const dias = emp.dias_restantes;
    const etapa = mensajeEtapa(dias);

    try {
      const base = { empresaId: emp.id, nombreEmpresa: emp.nombre };
      const mensual = await WompiService.generarLinkPago({ ...base, meses: 1 });
      const anual = await WompiService.generarLinkPago({ ...base, meses: 12 });

      await enviarEmail({
        to:      emp.email,
        subject: etapa.asunto,
        html:    emailHtml({ empresa: emp.nombre, admin: emp.admin_nombre, etapa, mensual, anual }),
      });

      logger.info(`[suscripcion-worker] email enviado a ${emp.email} (empresa ${emp.id}, ${dias}d restantes)`);
    } catch (err) {
      logger.error(`[suscripcion-worker] error empresa ${emp.id}: ${err.message}`);
    }

    const mensaje = dias >= 0
      ? `${emp.nombre}: suscripción vence en ${dias} día${dias !== 1 ? 's' : ''}.`
      : -dias < DIAS_GRACIA_SUSCRIPCION
        ? `${emp.nombre}: suscripción vencida hace ${plural(-dias, 'día', 'días')} (dentro de la gracia).`
        : `${emp.nombre}: suscripción vencida hace ${-dias} días (ya pasó el período de gracia).`;
    await NotificacionesService.notificarSuperAdmins({
      empresaId: emp.id,
      tipo: 'admin.suscripcion_vencimiento',
      titulo: dias >= 0 ? 'Suscripción por vencer' : 'Suscripción vencida',
      mensaje,
      data: { empresa_id: emp.id },
    }).catch((err) => logger.error(`[suscripcion-worker] no se pudo notificar a super_admin (empresa ${emp.id}):`, err.message));

    // Aviso in-app a TODOS los gestores de la empresa (no solo admin_empresa,
    // que es el único que recibe el email) para que todos se enteren a tiempo.
    try {
      const gestoresIds = await NotificacionesModel.idsGestores(emp.id);
      await NotificacionesService.notificarVarios(gestoresIds, {
        empresaId: emp.id,
        tipo: 'suscripcion.vencimiento',
        titulo: dias >= 0 ? 'Suscripción por vencer' : 'Suscripción vencida',
        mensaje: etapa.inApp,
      });
    } catch (err) {
      logger.error(`[suscripcion-worker] no se pudo notificar a gestores (empresa ${emp.id}):`, err.message);
    }
  }
}

function emailHtml({ empresa, admin, etapa, mensual, anual }) {
  const ahorro = mensual.monto_cop * 12 - anual.monto_cop;
  return plantillaCorreo({
    titulo: etapa.titulo,
    cuerpo:
      `<p style="margin:0 0 12px">Hola <strong>${esc(admin)}</strong>,</p>` +
      `<p style="margin:0 0 12px">La suscripción de <strong>${esc(empresa)}</strong> ${etapa.intro}.</p>` +
      `<p style="margin:0 0 12px">${esc(etapa.consecuencia)}</p>` +
      `<p style="margin:0">Elige cómo renovar tu plan:</p>`,
    boton: { texto: `Renovar un mes — ${cop(mensual.monto_cop)}`, url: mensual.url },
    botonSecundario: {
      texto: `Pagar el año — ${cop(anual.monto_cop)}${ahorro > 0 ? ` (ahorras ${cop(ahorro)})` : ''}`,
      url: anual.url,
    },
    nota: 'Los links son de un solo uso y expiran en 7 días. Si ya realizaste el pago, ignora este mensaje.',
  });
}

function iniciarWorker() {
  // Ejecutar al arrancar (con 1 min de delay para que el pool esté listo)
  // y luego cada 24h.
  setTimeout(() => {
    procesarRenovaciones().catch((err) =>
      logger.error('[suscripcion-worker] error inicial:', err.message)
    );
  }, 60_000);

  const timer = setInterval(() => {
    procesarRenovaciones().catch((err) =>
      logger.error('[suscripcion-worker]', err.message)
    );
  }, INTERVALO_MS);

  timer.unref();
  logger.info('[suscripcion-worker] iniciado (cada 24h)');
  return timer;
}

module.exports = { iniciarWorker };
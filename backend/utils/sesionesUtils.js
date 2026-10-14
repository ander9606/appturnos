'use strict';

/**
 * Corrección por sesión de un día con reingreso (registros_diarios.sesiones > 1).
 *
 * Un registro guarda las sesiones ya cerradas en `sesiones_detalle` y la vigente en
 * hora_entrada/hora_salida; los horas_* del registro son la SUMA de todas. Para corregir
 * una sola sesión no se puede recalcular solo "la vigente" (se perderían las demás), así
 * que se recibe la lista completa y se recalcula el día entero, sesión por sesión, igual
 * que lo hace marcarSalida(): las ordinarias semanales que consume una sesión ya no
 * quedan disponibles para la siguiente.
 */

const { calcularHoras, horaAMinutos } = require('./laboralUtils');
const AppError = require('./AppError');

const MIN_POR_DIA = 24 * 60;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const aHHMMSS = (hora) => (hora.length === 5 ? `${hora}:00` : hora);

/**
 * Valida la lista COMPLETA de sesiones de un día y la devuelve normalizada ('HH:MM:SS').
 *
 * - Tiene que traer exactamente `cantidad` sesiones: aquí solo se corrigen horas, no se
 *   agregan ni se quitan sesiones.
 * - Cada sesión: hora válida y salida distinta de la entrada (puede cruzar la medianoche).
 * - En orden y sin solaparse: la entrada de una sesión no puede ser antes de la salida de
 *   la anterior. Una entrada "menor" se lee como después de medianoche, y por eso todo el
 *   día debe caber en 24 h: así un error de tipeo (07:00 en vez de 17:00) no se acepta
 *   como si fuera el día siguiente.
 * - Solo la última sesión puede estar abierta (sin salida), y únicamente si ya lo estaba.
 */
function validarSesiones(sesiones, { cantidad, ultimaAbierta = false }) {
  if (!Array.isArray(sesiones) || sesiones.length !== cantidad) {
    throw new AppError(
      `Este día tiene ${cantidad} sesiones: envía las ${cantidad} (aquí no se agregan ni se quitan sesiones).`,
      422
    );
  }

  let finAnterior = null;
  let inicioDia = null;
  const normalizadas = sesiones.map((s, i) => {
    const n = i + 1;
    const esUltima = i === sesiones.length - 1;
    const abierta = esUltima && ultimaAbierta;

    if (typeof s?.hora_entrada !== 'string' || !RE_HORA.test(s.hora_entrada)) {
      throw new AppError(`Sesión ${n}: hora de entrada inválida`, 422);
    }
    if (abierta) {
      if (s.hora_salida) throw new AppError(`Sesión ${n}: sigue abierta, no puede tener salida`, 422);
    } else if (typeof s.hora_salida !== 'string' || !RE_HORA.test(s.hora_salida)) {
      throw new AppError(`Sesión ${n}: hora de salida inválida`, 422);
    }

    let inicio = horaAMinutos(s.hora_entrada);
    while (finAnterior !== null && inicio < finAnterior) inicio += MIN_POR_DIA;
    if (inicioDia === null) inicioDia = inicio;

    let fin = inicio;
    if (!abierta) {
      fin = horaAMinutos(s.hora_salida);
      if (fin === inicio % MIN_POR_DIA) {
        throw new AppError(`Sesión ${n}: la salida no puede ser igual a la entrada`, 422);
      }
      while (fin < inicio) fin += MIN_POR_DIA;
    }
    if (fin - inicioDia > MIN_POR_DIA) {
      throw new AppError(
        `Sesión ${n}: las sesiones deben estar en orden y caber en 24 h desde la primera entrada`,
        422
      );
    }
    finAnterior = fin;

    return {
      hora_entrada: aHHMMSS(s.hora_entrada),
      hora_salida: abierta ? null : aHHMMSS(s.hora_salida),
    };
  });

  return normalizadas;
}

/**
 * Totales del día = suma de las horas de cada sesión CERRADA, recalculadas en orden.
 * `ordinariasAcum` son las ordinarias de la semana hasta ayer (sumarOrdinariasEnSemana).
 * Una sesión abierta no suma: sus horas las calcula en vivo la lectura, y al cerrarla
 * marcarSalida() las agrega a estos totales.
 */
function calcularHorasSesiones({
  sesiones, fecha, ordinariasAcum = 0, jornadaContinua = false,
  recargoFestivo = true, sumarNocturnasFestivo = true,
}) {
  const totales = {
    horas_ordinarias: 0,
    horas_extra_diurnas: 0,
    horas_extra_nocturnas: 0,
    horas_nocturnas: 0,
    horas_festivo: 0,
    es_festivo: 0,
  };
  let acumulado = ordinariasAcum;

  for (const s of sesiones) {
    if (!s.hora_salida) continue;
    const h = calcularHoras({
      horaEntrada: s.hora_entrada,
      horaSalida: s.hora_salida,
      fecha,
      horasOrdinariasAcumuladas: acumulado,
      jornadaContinua,
      recargoFestivo,
      sumarNocturnasFestivo,
    });
    totales.horas_ordinarias += h.horas_ordinarias;
    totales.horas_extra_diurnas += h.horas_extra_diurnas;
    totales.horas_extra_nocturnas += h.horas_extra_nocturnas;
    totales.horas_nocturnas += h.horas_nocturnas;
    totales.horas_festivo += h.horas_festivo;
    totales.es_festivo = h.es_festivo;
    // Mismo acumulador que marcarSalida(): ordinarias + nocturnas ya consumieron el tope semanal.
    acumulado += h.horas_ordinarias + h.horas_nocturnas;
  }
  return totales;
}

module.exports = { validarSesiones, calcularHorasSesiones };

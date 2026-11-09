'use strict';

/**
 * Resumen de costos de un grupo (evento) a partir de las asignaciones de sus turnos. Función pura: el modelo trae las
 * filas y aquí se suman, con las mismas reglas que la liquidación y la cuenta de cobro, para que el gestor pueda
 * comparar con su «saldo a pagar» sin dos cifras distintas:
 *  - Para pagar (`real`): turnos `completado` con el contrato firmado y los `fallido` (la compensación por fuerza mayor
 *    se paga sin firma). Es `pago_total` (la tarifa del puesto más el bono) menos los descuentos que el trabajador ya
 *    aceptó; los pendientes o rechazados no cuentan. Nunca queda negativo.
 *  - Sin firmar: turnos terminados cuyo contrato aún no firma el trabajador. Se pagarán, pero la liquidación los frena
 *    hasta que firme: van aparte y no suman a «para pagar».
 *  - En espera: turnos `completado` con una propuesta de compensación que el trabajador no ha respondido. No suman ni
 *    restan en ningún total hasta que decida: solo se cuentan.
 *  - Por hacer (`estimado`): turnos `confirmado` y `en_progreso`, a la tarifa de su puesto. Las postulaciones sin
 *    confirmar y los «por reconfirmar» no son un compromiso todavía.
 *  - Proyectado: lo que costará el evento si todo sigue como va = para pagar + sin firmar + por hacer (sin lo que está en espera).
 */

const redondear = (n) => Math.round(Number(n) * 100) / 100;
const num = (v) => Number(v) || 0;

const TERMINADOS = new Set(['completado', 'fallido']);
const COMPROMETIDOS = new Set(['confirmado', 'en_progreso']);

/** Lo que se le paga al trabajador por un turno terminado: bruto menos descuentos aceptados, sin bajar de cero. */
function pagoNeto(fila) {
  return Math.max(0, num(fila.pago_total) - num(fila.descuento));
}

function resumirCostos(filas) {
  const real = { total: 0, tarifas: 0, bonos: 0, descuentos: 0, turnos_pagados: 0 };
  const sinFirmar = { cantidad: 0, monto: 0 };
  const estimado = { total: 0, turnos: 0 };
  let enEspera = 0;
  const trabajadores = new Set();
  let horas = 0;

  for (const f of filas) {
    if (TERMINADOS.has(f.estado)) {
      if (f.estado === 'completado' && f.compensacion_decision === 'pendiente') {
        enEspera += 1;
        continue;
      }
      trabajadores.add(f.trabajador_id);
      horas += num(f.horas_trabajadas);
      const neto = pagoNeto(f);
      // Un fallido nunca tiene contrato que firmar: se paga igual.
      if (f.estado === 'completado' && !f.firmado) {
        sinFirmar.cantidad += 1;
        sinFirmar.monto += neto;
        continue;
      }
      const bono = Math.min(num(f.bono_monto), num(f.pago_total));
      real.total += neto;
      real.bonos += bono;
      real.tarifas += Math.max(0, num(f.pago_total) - bono);
      real.descuentos += Math.min(num(f.descuento), num(f.pago_total));
      real.turnos_pagados += 1;
    } else if (COMPROMETIDOS.has(f.estado)) {
      estimado.total += num(f.tarifa_dia);
      estimado.turnos += 1;
      trabajadores.add(f.trabajador_id);
    }
  }

  return {
    real: Object.fromEntries(Object.entries(real).map(([k, v]) => [k, k === 'turnos_pagados' ? v : redondear(v)])),
    sin_firmar: { cantidad: sinFirmar.cantidad, monto: redondear(sinFirmar.monto) },
    en_espera: { cantidad: enEspera },
    estimado: { total: redondear(estimado.total), turnos: estimado.turnos },
    proyectado: redondear(real.total + sinFirmar.monto + estimado.total),
    trabajadores: trabajadores.size,
    horas: redondear(horas),
  };
}

module.exports = { resumirCostos, pagoNeto };

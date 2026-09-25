'use strict';

/**
 * Helpers privados compartidos entre los submódulos de AsignacionesService
 * (no forman parte de la interfaz pública). Solo lo que usa más de un grupo
 * vive aquí — lo demás queda local a su propio archivo.
 */

const DIAS  = ['dom','lun','mar','mié','jue','vie','sáb'];
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

/** Formatea "YYYY-MM-DD" → "lun 5 jun" */
function fmtFechaCorta(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

module.exports = { fmtFechaCorta };

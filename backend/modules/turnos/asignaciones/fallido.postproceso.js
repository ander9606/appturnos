'use strict';

const ContratosModel = require('../../contratos/contratos.model');
const CuentasCobroService = require('../../cuentas-cobro/cuentas-cobro.service');
const logger = require('../../../utils/logger');

/**
 * Quien ya había cerrado su turno (completado) tenía contrato y quizá cuenta de cobro con el valor anterior. Cuando
 * su turno pasa a 'fallido' (ver OfertasService.marcarFallida y AsignacionesService.autorizarCompensacion) se anula la
 * firma del contrato (ese valor ya no rige) y, si el período está cerrado, se genera la cuenta complementaria o de
 * ajuste con la compensación (ver CuentasCobroService).
 * Best-effort: un fallo aquí no debe deshacer el turno fallido ya guardado.
 */
async function ajustarContratoYCuenta(empresaId, asignacionId, trabajadorId) {
  try {
    const contrato = await ContratosModel.obtenerPorAsignacion(empresaId, asignacionId);
    if (contrato?.firmado_trabajador) await ContratosModel.resetearFirma(empresaId, contrato.id);
    await CuentasCobroService.actualizarPorTurnoFirmado(empresaId, asignacionId, trabajadorId);
  } catch (err) {
    logger.warn(`[fallido] no se pudo ajustar contrato/cuenta de cobro de la asignación ${asignacionId}: ${err.message}`);
  }
}

module.exports = { ajustarContratoYCuenta };

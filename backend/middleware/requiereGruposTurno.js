'use strict';

const AppError = require('../utils/AppError');
const EmpresasModel = require('../modules/empresas/empresas.model');

/**
 * Los grupos de turnos son una función que el super_admin enciende por empresa
 * (`empresas.usa_grupos_turno`). Sin ella, las rutas que lo usan responden 403 y para el
 * resto de clientes la función simplemente no existe. Se consulta en vivo en cada request,
 * igual que verificarSuscripcion: si se apaga, deja de funcionar de inmediato.
 */
async function requiereGruposTurno(req, _res, next) {
  try {
    if (await EmpresasModel.usaGruposTurno(req.empresa_id)) return next();
    return next(new AppError('Los grupos de turnos no están activados para tu empresa.', 403));
  } catch (err) {
    return next(err);
  }
}

module.exports = requiereGruposTurno;

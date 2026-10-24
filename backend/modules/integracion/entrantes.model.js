'use strict';

const { pool } = require('../../config/database');

/**
 * SQL de los handlers de eventos entrantes de logiq360 (entrantes.handlers.js).
 * Aparte de integracion.model.js: aquí viven solo las consultas que esos handlers
 * necesitan sobre usuarios, cargos, empresas y puestos de oferta.
 */
const EntrantesModel = {
  /** admin_empresa activos de la empresa — destinatarios de avisos de facturación. */
  async idsAdminsEmpresa(empresaId) {
    const [filas] = await pool.query(
      "SELECT id AS usuario_id FROM usuarios WHERE empresa_id = ? AND rol = 'admin_empresa' AND activo = 1",
      [empresaId]
    );
    return filas.map((f) => f.usuario_id);
  },

  /** Id del cargo de sistema (empresa_id NULL) con ese código, o undefined si no existe. */
  async idCargoSistema(codigo) {
    const [[row]] = await pool.query(
      'SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo = ? LIMIT 1',
      [codigo]
    );
    return row?.id;
  },

  /** Nombre de la empresa, o undefined si no existe. */
  async nombreEmpresa(empresaId) {
    const [[empresa]] = await pool.query('SELECT nombre FROM empresas WHERE id = ? LIMIT 1', [empresaId]);
    return empresa?.nombre;
  },

  /** Id del primer puesto de la oferta para ese cargo, o undefined si no tiene. */
  async idPuestoDeCargo(ofertaId, cargoId) {
    const [[existente]] = await pool.query(
      'SELECT id FROM oferta_puestos WHERE oferta_id = ? AND cargo_id = ? ORDER BY id LIMIT 1',
      [ofertaId, cargoId]
    );
    return existente?.id;
  },

  /** Fija las plazas del puesto y, solo si viene (no null/undefined), su tarifa diaria. */
  async actualizarPuesto(puestoId, plazas, tarifaDia) {
    const campos = ['plazas = ?'];
    const valores = [plazas];
    if (tarifaDia != null) {
      campos.push('tarifa_dia = ?');
      valores.push(tarifaDia);
    }
    valores.push(puestoId);
    await pool.query(`UPDATE oferta_puestos SET ${campos.join(', ')} WHERE id = ?`, valores);
  },

  async crearPuesto(ofertaId, cargoId, plazas, tarifaDia) {
    await pool.query(
      'INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, tarifa_dia) VALUES (?, ?, ?, ?)',
      [ofertaId, cargoId, plazas, tarifaDia]
    );
  },
};

module.exports = EntrantesModel;

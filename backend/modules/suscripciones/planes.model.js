'use strict';

const { pool } = require('../../config/database');

const COLUMNAS = 'codigo, nombre, orden, max_trabajadores, precio_cop, incluidos, precio_adicional_cop, updated_at';

const PlanesModel = {
  /** Planes ordenados de menor a mayor (orden). Tabla de plataforma, sin empresa_id. */
  async listar() {
    const [filas] = await pool.query(`SELECT ${COLUMNAS} FROM planes ORDER BY orden`);
    return filas;
  },

  async actualizar(codigo, { precio_cop, max_trabajadores, incluidos, precio_adicional_cop }, usuarioId) {
    const [res] = await pool.query(
      `UPDATE planes
          SET precio_cop = ?, max_trabajadores = ?, incluidos = ?, precio_adicional_cop = ?, updated_by = ?
        WHERE codigo = ?`,
      [precio_cop, max_trabajadores, incluidos, precio_adicional_cop, usuarioId, codigo]
    );
    return res.affectedRows > 0;
  },
};

/**
 * Precio mensual de un plan (fila de `planes`) para una empresa con
 * `activos` trabajadores activos: precio base + adicionales sobre `incluidos`.
 */
function precioPlanCop(plan, activos = 0) {
  if (!plan) throw new Error('Plan desconocido');
  const extra = plan.incluidos != null ? Math.max(0, activos - plan.incluidos) : 0;
  return plan.precio_cop + extra * (plan.precio_adicional_cop ?? 0);
}

const MESES_ANUAL = 12;
const MESES_PAGADOS_ANUAL = 10; // promo: pagas 10, usas 12

/** Monto a cobrar por `meses`: el año completo (12) vale 10 mensualidades; cualquier otra cantidad, precio lleno. */
function montoSuscripcionCop(plan, activos, meses = 1) {
  const mensual = precioPlanCop(plan, activos);
  return meses === MESES_ANUAL ? mensual * MESES_PAGADOS_ANUAL : mensual * meses;
}

/**
 * Plan más barato (por `orden`) cuyo tope admite `activos`. Si ninguno
 * alcanza (el super_admin puso tope a todos), el último — nunca undefined.
 */
function planParaTrabajadores(planes, activos) {
  return planes.find((p) => p.max_trabajadores == null || activos <= p.max_trabajadores)
    ?? planes[planes.length - 1];
}

module.exports = { PlanesModel, precioPlanCop, montoSuscripcionCop, planParaTrabajadores, MESES_ANUAL, MESES_PAGADOS_ANUAL };

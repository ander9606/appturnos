'use strict';

const { pool } = require('../../config/database');

const COLUMNAS = 'codigo, nombre, orden, max_trabajadores, precio_cop, precio_anual_cop, incluidos, precio_adicional_cop, updated_at';

const PlanesModel = {
  /** Planes ordenados de menor a mayor (orden). Tabla de plataforma, sin empresa_id. */
  async listar() {
    const [filas] = await pool.query(`SELECT ${COLUMNAS} FROM planes ORDER BY orden`);
    return filas;
  },

  async actualizar(codigo, { precio_cop, precio_anual_cop, max_trabajadores, incluidos, precio_adicional_cop }, usuarioId) {
    const [res] = await pool.query(
      `UPDATE planes
          SET precio_cop = ?, precio_anual_cop = COALESCE(?, precio_anual_cop), max_trabajadores = ?, incluidos = ?, precio_adicional_cop = ?, updated_by = ?
        WHERE codigo = ?`,
      [precio_cop, precio_anual_cop ?? null, max_trabajadores, incluidos, precio_adicional_cop, usuarioId, codigo]
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

const CODIGOS_PLAN = ['basico', 'profesional', 'empresarial', 'ilimitado'];
const MESES_ANUAL = 12;
const MESES_PAGADOS_ANUAL = 10; // si el plan no define precio_anual_cop: pagas 10, usas 12

/**
 * Monto a cobrar por `meses`. 12 meses = precio anual del plan (redondo, de la tabla
 * `planes`; sin él, 10 mensualidades) más 10 mensualidades por cada adicional;
 * cualquier otra cantidad, precio lleno.
 */
function montoSuscripcionCop(plan, activos, meses = 1) {
  if (meses !== MESES_ANUAL) return precioPlanCop(plan, activos) * meses;
  const extra = plan.incluidos != null ? Math.max(0, activos - plan.incluidos) : 0;
  return (plan.precio_anual_cop ?? plan.precio_cop * MESES_PAGADOS_ANUAL)
    + extra * (plan.precio_adicional_cop ?? 0) * MESES_PAGADOS_ANUAL;
}

/**
 * Cobro por subir de plan a mitad de vigencia: la diferencia entre lo que paga hoy por mes y lo
 * que costaría el plan nuevo (en su misma modalidad), por los días que le quedan (mes comercial de 30).
 * La fecha de vencimiento no cambia. 0 si el plan nuevo no cuesta más.
 */
function prorrateoCambioPlanCop({ valorMesActual, valorMesNuevo, diasRestantes }) {
  return Math.max(0, Math.round((valorMesNuevo - valorMesActual) * diasRestantes / 30));
}

/**
 * Plan más barato (por `orden`) cuyo tope admite `activos`. Si ninguno
 * alcanza (el super_admin puso tope a todos), el último — nunca undefined.
 */
function planParaTrabajadores(planes, activos) {
  return planes.find((p) => p.max_trabajadores == null || activos <= p.max_trabajadores)
    ?? planes[planes.length - 1];
}

module.exports = { PlanesModel, precioPlanCop, montoSuscripcionCop, prorrateoCambioPlanCop, planParaTrabajadores, CODIGOS_PLAN, MESES_ANUAL };

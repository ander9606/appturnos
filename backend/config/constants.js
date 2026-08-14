'use strict';

/**
 * Constantes globales de App Turnos.
 * Centraliza enums y valores de negocio para evitar strings mágicos.
 */

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_EMPRESA: 'admin_empresa',
  JEFE_TURNOS: 'jefe_turnos',
  JEFE_NOMINA: 'jefe_nomina',
  NOMINA: 'nomina',
  TRABAJADOR_TURNOS: 'trabajador_turnos',
  TRABAJADOR_NOMINA: 'trabajador_nomina',
};

const ROLES_VALIDOS = Object.values(ROLES);

// Agrupaciones útiles para verificarRol
const GRUPOS_ROLES = {
  ADMINS: [ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPRESA],
  JEFES: [ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA],
  TRACK_NOMINA: [ROLES.JEFE_NOMINA, ROLES.NOMINA, ROLES.TRABAJADOR_NOMINA],
  TRACK_TURNOS: [ROLES.JEFE_TURNOS, ROLES.TRABAJADOR_TURNOS],
};

const ESTADOS_OFERTA = ['borrador', 'abierta', 'publicada', 'en_proceso', 'cerrada', 'completada', 'cancelada'];

/**
 * Tope de ofertas activas (no canceladas/completadas) por empresa. Defensa de
 * negocio contra creación masiva por error o abuso — independiente del
 * rate-limit de la ruta, que solo frena el ritmo de peticiones.
 */
const MAX_OFERTAS_ACTIVAS_POR_EMPRESA = 500;

// Fuente de verdad en TS: packages/api-client/src/turnos.ts → ESTADOS_ASIGNACION
// Si añades un estado aquí, actualiza también ese array y el ESTADO_CONFIG
// en apps/mobile/features/turnos/turnosUtils.ts.
const ESTADOS_ASIGNACION = [
  'pendiente',
  'confirmado',
  'en_progreso',
  'completado',
  'no_presentado',
  'cancelado',
];

const ESTADOS_PERIODO = ['abierto', 'cerrado', 'liquidado'];

// Recargos de ley laboral colombiana
const RECARGOS = {
  EXTRA_DIURNA: 1.25,
  EXTRA_NOCTURNA: 1.75,
  NOCTURNA: 1.35,
  FESTIVO_DIURNO: 1.75,
  FESTIVO_NOCTURNO: 2.10,
};

// Jornada y horario nocturno
const JORNADA_ORDINARIA_HORAS = 8;        // referencia diaria (no usada para extras)
const JORNADA_SEMANAL_HORAS   = 42;       // umbral semanal ordinario → extra
const HORAS_EXTRA_MAX_SEMANA  = 12;       // límite legal de horas extra por semana
const HORA_INICIO_NOCTURNO = 21; // 21:00
const HORA_FIN_NOCTURNO = 6; // 06:00

// Divisor para convertir el salario mensual en valor de la hora ordinaria
// (convención laboral colombiana: 30 días × 8 h).
const HORAS_MES_NOMINA = 240;

// ── Descuentos de ley (solo aplican a empresas.tipo_contrato = 'laboral') ──

// Salario mínimo mensual legal vigente. Cambia cada 1-ene por decreto del
// Gobierno — actualizar aquí. Valor 2025; verificar el vigente antes de usar
// en producción para 2026.
const SMMLV_COP = 1423500;

// A cargo del trabajador (se descuentan de su pago). ARL y caja de
// compensación NO se incluyen: en Colombia corren 100% por cuenta del
// empleador, nunca se descuentan del trabajador.
const DEDUCCION_SALUD = 0.04;
const DEDUCCION_PENSION = 0.04;

// Aporte adicional al Fondo de Solidaridad Pensional (Ley 100/1993 art. 27-28),
// sobre el 100% del IBC, según cuántos SMMLV gana el trabajador. Solo aplica
// si el IBC ≥ 4 SMMLV.
const FONDO_SOLIDARIDAD_TRAMOS = [
  { desdeSmmlv: 4, tasa: 0.01 },
  { desdeSmmlv: 16, tasa: 0.012 },
  { desdeSmmlv: 17, tasa: 0.014 },
  { desdeSmmlv: 18, tasa: 0.016 },
  { desdeSmmlv: 19, tasa: 0.018 },
  { desdeSmmlv: 20, tasa: 0.02 },
];

// Auxilio de transporte (Ley 15/1959, decreto anual del Gobierno junto con el
// SMMLV). Aplica solo a contrato laboral, a trabajadores que devengan hasta
// SUBSIDIO_TRANSPORTE_TOPE_SMMLV salarios mínimos. No es salario para efectos
// de IBC — no se le calculan descuentos de salud/pensión.
// Valor 2025; verificar el vigente antes de usar en producción para 2026.
const SUBSIDIO_TRANSPORTE_COP = 200000;
const SUBSIDIO_TRANSPORTE_TOPE_SMMLV = 2;

// Seguridad de login
const LOGIN = {
  MAX_INTENTOS: 5,
  LOCKOUT_MINUTOS: 15,
};

/** Límites de trabajadores por plan (feature-gating). max_trabajadores null = ilimitado. */
const PLANES = {
  basico:      { max_trabajadores: 10 },
  profesional: { max_trabajadores: 30 },
  empresarial: { max_trabajadores: null },
};

/**
 * Precio mensual fijo para empresas sin integración activa con logiq360.
 * Empresas con integracion_config.activo=1 y api_key configurada no pagan
 * (ver middleware/verificarSuscripcion.js) — ya no hay precios escalonados por plan.
 */
const SUSCRIPCION_ESTANDAR_COP = 129000;

/** Días de acceso gratuito al registrarse antes de exigir el pago (empresas no-logiq360). */
const TRIAL_DIAS_GRATIS = 14;

/** Estados del vínculo trabajador ↔ empresa (tabla trabajador_empresa). */
const ESTADOS_TRABAJADOR_EMPRESA = {
  SOLICITADO_POR_TRABAJADOR: 'solicitado_por_trabajador',
  SOLICITADO_POR_EMPRESA: 'solicitado_por_empresa',
  ACTIVO: 'activo',
  RECHAZADO: 'rechazado',
  ARCHIVADO: 'archivado',
};

module.exports = {
  ROLES,
  ROLES_VALIDOS,
  GRUPOS_ROLES,
  ESTADOS_OFERTA,
  MAX_OFERTAS_ACTIVAS_POR_EMPRESA,
  ESTADOS_ASIGNACION,
  ESTADOS_PERIODO,
  RECARGOS,
  JORNADA_ORDINARIA_HORAS,
  JORNADA_SEMANAL_HORAS,
  HORAS_EXTRA_MAX_SEMANA,
  HORA_INICIO_NOCTURNO,
  HORA_FIN_NOCTURNO,
  HORAS_MES_NOMINA,
  SMMLV_COP,
  DEDUCCION_SALUD,
  DEDUCCION_PENSION,
  FONDO_SOLIDARIDAD_TRAMOS,
  SUBSIDIO_TRANSPORTE_COP,
  SUBSIDIO_TRANSPORTE_TOPE_SMMLV,
  LOGIN,
  ESTADOS_TRABAJADOR_EMPRESA,
  PLANES,
  SUSCRIPCION_ESTANDAR_COP,
  TRIAL_DIAS_GRATIS,
};

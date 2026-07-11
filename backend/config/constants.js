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
  ESTADOS_ASIGNACION,
  ESTADOS_PERIODO,
  RECARGOS,
  JORNADA_ORDINARIA_HORAS,
  JORNADA_SEMANAL_HORAS,
  HORAS_EXTRA_MAX_SEMANA,
  HORA_INICIO_NOCTURNO,
  HORA_FIN_NOCTURNO,
  HORAS_MES_NOMINA,
  LOGIN,
  ESTADOS_TRABAJADOR_EMPRESA,
  PLANES,
  SUSCRIPCION_ESTANDAR_COP,
  TRIAL_DIAS_GRATIS,
};

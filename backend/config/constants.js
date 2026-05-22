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

const ESTADOS_OFERTA = ['abierta', 'en_proceso', 'completada', 'cancelada'];

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
const JORNADA_ORDINARIA_HORAS = 8;
const HORA_INICIO_NOCTURNO = 21; // 21:00
const HORA_FIN_NOCTURNO = 6; // 06:00

// Seguridad de login
const LOGIN = {
  MAX_INTENTOS: 5,
  LOCKOUT_MINUTOS: 15,
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
  HORA_INICIO_NOCTURNO,
  HORA_FIN_NOCTURNO,
  LOGIN,
};

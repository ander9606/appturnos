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

// Rol con el que se activa/resincroniza la cuenta de un trabajador según
// trabajadores.tipo. 'ambos' usa el rol de Turnos por defecto (track
// principal en campo). Única fuente de verdad — auth.service.js (activación)
// y trabajadores.service.js (edición por el gestor) deben usar esta misma
// tabla para que el rol de la cuenta nunca quede desincronizado del tipo.
const ROL_POR_TIPO = {
  nomina: ROLES.TRABAJADOR_NOMINA,
  turnos: ROLES.TRABAJADOR_TURNOS,
  ambos: ROLES.TRABAJADOR_TURNOS,
};

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

// Recargos de ley laboral colombiana. El dominical/festivo cambia por fecha
// (ver RECARGO_FESTIVO_VIGENCIAS) — no está aquí.
const RECARGOS = {
  EXTRA_DIURNA: 1.25,
  EXTRA_NOCTURNA: 1.75,
  NOCTURNA: 1.35,
};

// Ley 2466 de 2025 (reforma laboral, sancionada 25-jun-2025). Tablas por
// vigencia, de la más reciente a la más antigua: aplica la primera cuya
// `desde` sea ≤ la fecha trabajada, así un período viejo se sigue liquidando
// con la regla de su época (ver vigenteEn() en laboralUtils.js).
//
// Art. 10 (modifica art. 160 CST): trabajo nocturno desde las 19:00, vigente
// 6 meses después de la sanción → 25-dic-2025. Antes: 21:00.
const HORA_INICIO_NOCTURNO_VIGENCIAS = [
  { desde: '2025-12-25', hora: 19 },
  { desde: '0000-01-01', hora: 21 },
];
// Art. 14 (modifica art. 179 CST): recargo dominical/festivo gradual —
// 80 % desde 1-jul-2025, 90 % desde 1-jul-2026, 100 % desde 1-jul-2027.
const RECARGO_FESTIVO_VIGENCIAS = [
  { desde: '2027-07-01', factor: 2.00 },
  { desde: '2026-07-01', factor: 1.90 },
  { desde: '2025-07-01', factor: 1.80 },
  { desde: '0000-01-01', factor: 1.75 },
];

// Jornada y horario nocturno
const JORNADA_ORDINARIA_HORAS = 8;        // referencia diaria (no usada para extras)
const JORNADA_SEMANAL_HORAS   = 42;       // umbral semanal ordinario → extra
const HORAS_EXTRA_MAX_SEMANA  = 12;       // límite legal de horas extra por semana
const HORA_FIN_NOCTURNO = 6; // 06:00 (inicio: HORA_INICIO_NOCTURNO_VIGENCIAS)

// Almuerzo: Art. 167 CST solo obliga descanso si la jornada continua supera
// 6h. Por defecto se asume que el trabajador lo tomó y se descuenta del
// cierre de jornada; `jornada_continua` (registros_diarios) permite marcar
// que NO lo tomó y omitir el descuento (ver calcularHoras en laboralUtils.js).
const JORNADA_CONTINUA_UMBRAL_HORAS = 6;
const DURACION_ALMUERZO_MIN = 60;

// Divisor para convertir el salario mensual en valor de la hora ordinaria:
// jornada de 42 h/semana (Ley 2101, desde 15-jul-2026) → 42 ÷ 6 días × 30 = 210.
// ponytail: valor único, no por fecha — no hay clientes con períodos
// anteriores (antes 240 = 30 × 8) — upgrade path: tabla *_VIGENCIAS.
const HORAS_MES_NOMINA = 210;

// Plazo (días corridos tras el domingo/festivo trabajado) dentro del cual el
// sistema debe ubicar automáticamente el descanso compensatorio (Art. 179
// CST: siguiente semana, ampliable hasta 4 semanas por acuerdo/política de
// la empresa). Si no hay día libre disponible dentro del plazo, el
// compensatorio queda 'pendiente' para asignación manual.
const COMPENSATORIO_PLAZO_DIAS = 28;

// ── Descuentos de ley (solo aplican a empresas.tipo_contrato = 'laboral') ──

// Salario mínimo mensual legal vigente. Cambia cada 1-ene por decreto del
// Gobierno — actualizar aquí. Valor 2026 (Decreto 1469 de 2025).
// ponytail: un solo valor vigente, no tabla por año — re-liquidar un período
// de un año anterior usa el SMMLV actual para descuentos y auxilio de
// transporte — upgrade path: tabla por vigencia como RECARGO_FESTIVO_VIGENCIAS.
const SMMLV_COP = 1750905;

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
// Valor 2026 (Decreto 1470 de 2025).
const SUBSIDIO_TRANSPORTE_COP = 249095;
const SUBSIDIO_TRANSPORTE_TOPE_SMMLV = 2;

// Seguridad de login
const LOGIN = {
  MAX_INTENTOS: 5,
  LOCKOUT_MINUTOS: 15,
};

/**
 * Planes de suscripción (COP/mes) para empresas sin integración activa con
 * logiq360 — las que tienen integracion_config.activo=1 y api_key no pagan
 * (ver middleware/verificarSuscripcion.js).
 * max_trabajadores: tope de trabajadores activos (null = sin tope).
 * Empresarial incluye `incluidos` trabajadores y cobra `precio_adicional_cop`
 * por cada trabajador activo por encima de ese número.
 */
const PLANES = {
  basico:      { max_trabajadores: 10,   precio_cop: 79000 },
  profesional: { max_trabajadores: 30,   precio_cop: 169000 },
  empresarial: { max_trabajadores: null, precio_cop: 299000, incluidos: 80, precio_adicional_cop: 3500 },
};

/** Precio mensual de un plan para una empresa con `trabajadoresActivos`. */
function precioPlanCop(plan, trabajadoresActivos = 0) {
  const p = PLANES[plan];
  if (!p) throw new Error(`Plan desconocido: ${plan}`);
  const extra = p.incluidos != null ? Math.max(0, trabajadoresActivos - p.incluidos) : 0;
  return p.precio_cop + extra * (p.precio_adicional_cop ?? 0);
}

/** Plan más barato cuyo tope admite `trabajadoresActivos`. */
function planParaTrabajadores(trabajadoresActivos) {
  return Object.keys(PLANES).find((k) => {
    const max = PLANES[k].max_trabajadores;
    return max === null || trabajadoresActivos <= max;
  });
}

/**
 * Días de acceso gratuito al registrarse antes de exigir el pago (empresas no-logiq360).
 * 30 y no 14: la prueba debe alcanzar a cerrar al menos una quincena para
 * que la empresa vea su primera liquidación antes de pagar.
 */
const TRIAL_DIAS_GRATIS = 30;

/** Estados del vínculo trabajador ↔ empresa (tabla trabajador_empresa). */
const ESTADOS_TRABAJADOR_EMPRESA = {
  SOLICITADO_POR_TRABAJADOR: 'solicitado_por_trabajador',
  SOLICITADO_POR_EMPRESA: 'solicitado_por_empresa',
  ACTIVO: 'activo',
  RECHAZADO: 'rechazado',
  ARCHIVADO: 'archivado',
};

/** Cumplimiento Legal — Contratos Diarios */
const TIPOS_CONTRATO = {
  LABORAL: 'LABORAL',
  PRESTACION_SERVICIOS: 'PRESTACION_SERVICIOS',
};

// Salario mínimo diario (SMMLV ÷ 30 días)
const SALARIO_MINIMO_DIARIO_COP = Math.ceil(SMMLV_COP / 30);

// Auditoría de acumulación: límite de contratos diarios por trabajador/año
// Sentencia C-013-20: >50 contratos en 12 meses = riesgo de recalificación
const CONTRATOS_ACUMULATIVOS_LIMITE = 50;
const CONTRATOS_ACUMULATIVOS_ALERTA = 40;

// Datos de la PERSONA, no del vínculo laboral — deben ser iguales sin importar
// con cuántas empresas trabaje. Cada vínculo (trabajador_empresa) tiene su
// propia fila en `trabajadores` (una por empresa) para poder tener cargo/tarifa
// distintos, pero estos campos puntuales se copian al crear una fila nueva y
// se propagan a las demás filas activas del mismo usuario_id cuando cambian.
const CAMPOS_PERSONALES_TRABAJADOR = [
  'cedula', 'tipo_documento', 'fecha_nacimiento', 'sexo',
  'contacto_emergencia_nombre', 'contacto_emergencia_tel',
  'eps', 'afp', 'banco', 'tipo_cuenta', 'numero_cuenta',
  'ant_judiciales_fecha', 'ant_disciplinarios_fecha', 'descripcion',
];

module.exports = {
  ROLES,
  ROLES_VALIDOS,
  ROL_POR_TIPO,
  GRUPOS_ROLES,
  ESTADOS_OFERTA,
  MAX_OFERTAS_ACTIVAS_POR_EMPRESA,
  ESTADOS_ASIGNACION,
  ESTADOS_PERIODO,
  RECARGOS,
  JORNADA_ORDINARIA_HORAS,
  JORNADA_SEMANAL_HORAS,
  HORAS_EXTRA_MAX_SEMANA,
  HORA_INICIO_NOCTURNO_VIGENCIAS,
  RECARGO_FESTIVO_VIGENCIAS,
  HORA_FIN_NOCTURNO,
  JORNADA_CONTINUA_UMBRAL_HORAS,
  DURACION_ALMUERZO_MIN,
  HORAS_MES_NOMINA,
  COMPENSATORIO_PLAZO_DIAS,
  SMMLV_COP,
  DEDUCCION_SALUD,
  DEDUCCION_PENSION,
  FONDO_SOLIDARIDAD_TRAMOS,
  SUBSIDIO_TRANSPORTE_COP,
  SUBSIDIO_TRANSPORTE_TOPE_SMMLV,
  LOGIN,
  ESTADOS_TRABAJADOR_EMPRESA,
  PLANES,
  precioPlanCop,
  planParaTrabajadores,
  TRIAL_DIAS_GRATIS,
  TIPOS_CONTRATO,
  SALARIO_MINIMO_DIARIO_COP,
  CONTRATOS_ACUMULATIVOS_LIMITE,
  CONTRATOS_ACUMULATIVOS_ALERTA,
  CAMPOS_PERSONALES_TRABAJADOR,
};

/**
 * destino() — a qué pantalla navegar al tocar una notificación.
 *
 * Vive fuera de app/ a propósito: expo-router trata cada archivo bajo app/
 * como una ruta con su propio ciclo de carga diferida. Si otro módulo
 * (app/_layout.tsx) importa un archivo de ruta directamente además del
 * router, Metro puede terminar registrando el mismo archivo con dos
 * identificadores de módulo distintos en el bundle de producción — uno de
 * los dos resuelve a `undefined` y expo-router revienta con
 * "Cannot read property 'ErrorBoundary' of undefined" al montar la escena.
 * Ver incidente: app/notificaciones.tsx importado desde _layout.tsx.
 */

// Notificaciones dirigidas al gestor que igual traen asignacion_id — deben
// abrir la vista de gestión de la oferta (postulantes/asignaciones), no la
// vista del trabajador (marcar ingreso/egreso) que es a donde manda asignacion_id.
// EXCEPTO para turno.ingreso/turno.egreso: el admin debe ver la asignación específica
// para poder visualizar detalles y corregir si es necesario.
const TIPOS_GESTOR = new Set(['postulacion.nueva']);

// nomina.entrada/salida ya tenían su propio caso — sospechoso y horas_extra_iniciadas
// son el mismo patrón (gestor revisa el registro de un trabajador) pero se les había
// quedado fuera, así que caían en el fallback de /nomina-ingreso (pantalla del propio
// trabajador_nomina, bloqueada por rol para un gestor).
const TIPOS_REGISTRO_GESTOR = new Set(['nomina.entrada', 'nomina.salida', 'nomina.sospechoso', 'nomina.horas_extra_iniciadas']);

/**
 * Resuelve a dónde navegar al tocar una notificación. Se usa tanto para el
 * inbox in-app (app/notificaciones.tsx) como para el tap de una push
 * notification (app/_layout.tsx), así que acepta cualquier objeto con
 * `tipo` + `data` (el payload de Expo push no trae los demás campos de
 * `Notificacion`).
 */
export function destino(n: { tipo: string; data: unknown }): string | null {
  const d = (n.data ?? {}) as Record<string, unknown>;
  if (TIPOS_GESTOR.has(n.tipo) && d.oferta_id) return `/oferta/${d.oferta_id}`;
  if (d.asignacion_id)   return `/turno/${d.asignacion_id}`;
  if (d.oferta_id)       return `/oferta/${d.oferta_id}`;
  // Invitación/conversión de empresa (trabajador-empresa.service.js: invitar,
  // aceptar) — solo traen empresa_id, no relacion_id, así que deben resolverse
  // antes del fallback de empresa_id de más abajo (ese es para super_admin).
  if (n.tipo === 'invitacion_empresa_nomina' || n.tipo === 'invitacion_empresa') return '/mis-empresas';
  if (n.tipo === 'trabajador_empresa.bienvenida_nomina') return '/(tabs)/nomina';
  // Solo presente en notificaciones dirigidas a super_admin (empresa_nueva,
  // pago_rechazado/integracion.desactivada duplicadas a super_admin, vencimiento).
  if (d.empresa_id)      return `/empresa/${d.empresa_id}`;
  // Copia propia del admin_empresa (no lleva data — es sobre su propia empresa,
  // a diferencia de la duplicada a super_admin de arriba, que sí trae empresa_id).
  if (n.tipo === 'integracion.activada' || n.tipo === 'integracion.desactivada') return '/integracion/config';
  if (d.ausencia_id)     return '/ausencias';
  // cuenta_cobro.pendiente_firma trae cuenta_cobro_id Y periodo_id — debe
  // resolverse antes del fallback genérico de periodo_id de abajo.
  if (d.cuenta_cobro_id) return `/cuenta-cobro/${d.cuenta_cobro_id}`;
  if (d.periodo_id)      return '/(tabs)/nomina';
  // Cierre de ciclo sin reapertura inmediata: no hay periodo_id nuevo que enlazar.
  if (n.tipo === 'nomina.ciclo_cambiado') return '/(tabs)/nomina';
  if (d.descuento_id)    return '/(tabs)/nomina';
  if (n.tipo === 'nomina.compensatorios_hoy') return '/gestor-compensatorios';
  // nomina.entrada / nomina.salida / nomina.sospechoso / nomina.horas_extra_iniciadas
  // → gestor ve el detalle del registro del trabajador para corregir o investigar.
  if (TIPOS_REGISTRO_GESTOR.has(n.tipo) && d.registro_id) return `/registro-detalle/${d.registro_id}`;
  // Recordatorio al propio trabajador_nomina de que su turno empieza — lo manda
  // directo a su pantalla de marcaje.
  if (n.tipo === 'nomina.recordatorio_ingreso' && d.trabajador_id) return '/nomina-ingreso';
  if (d.registro_id)     return '/nomina-ingreso';
  if (d.compensatorio_id) return '/(tabs)/nomina';
  // 'reingreso.solicitado' va al gestor (que aprueba/rechaza en /reingresos-pendientes);
  // 'reingreso.aprobado'/'reingreso.rechazado' van al trabajador (que marca en /nomina-ingreso).
  if (d.solicitud_id && n.tipo === 'reingreso.solicitado') return '/reingresos-pendientes';
  if (d.solicitud_id && n.tipo.startsWith('reingreso.')) return '/nomina-ingreso';
  // Solicitud de vinculación trabajador↔empresa. 'trabajador_empresa.aprobado' va
  // al trabajador (ve su nueva empresa); 'solicitud'/'aceptada' van al gestor que
  // debe revisar/aprobar en /solicitudes.
  if (d.relacion_id && n.tipo === 'trabajador_empresa.aprobado') return '/mis-empresas';
  if (d.relacion_id) return '/solicitudes';
  return null;
}

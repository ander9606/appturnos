// Types
export * from './types';

// Client initializer + TokenStore interface
export { initApiClient } from './client';
export type { TokenStore } from './client';

// API modules
export { authApi } from './auth';
export type {
  LoginResponse,
  ActivarCuentaResponse,
  UsuarioPerfil,
  UpdateProfileParams,
  ChangePasswordParams,
} from './types';
export { nominaApi, calcularResumenHoras } from './nomina';
export type {
  PeriodoNomina,
  RegistroDiario,
  LiquidacionResumen,
  LiquidacionLinea,
  EstadoPeriodo,
  TipoPeriodo,
  ResumenHoras,
} from './nomina';
export { turnosApi } from './turnos';
export type {
  Asignacion,
  CalificacionResponse,
  Oferta,
  OfertaDetalle,
  AsignacionResumen,
  EstadoAsignacion,
  EstadoOferta,
  TipoGeofence,
  GeofenceInfo,
  PaginatedResponse,
} from './turnos';
export { puntosMarcajeApi } from './puntos-marcaje';
export type {
  PuntoMarcaje,
  TipoPunto,
  CrearPuntoMarcajePayload,
  ActualizarPuntoMarcajePayload,
} from './puntos-marcaje';
export { trabajadoresApi } from './trabajadores';
export type {
  Trabajador,
  TrabajadoresListParams,
  TrabajadoresListResponse,
  CrearTrabajadorPayload,
  ActualizarTrabajadorPayload,
} from './trabajadores';
export { adminApi } from './admin';
export type {
  EmpresaAdmin,
  EmpresasListResponse,
  EmpresasListParams,
  CrearEmpresaPayload,
  ActualizarEmpresaPayload,
  ReportesGlobales,
  PlanEmpresa,
} from './admin';

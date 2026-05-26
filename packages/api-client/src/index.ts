// Types
export * from './types';

// Client initializer + TokenStore interface
export { initApiClient } from './client';
export type { TokenStore } from './client';

// API modules
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
  Oferta,
  OfertaDetalle,
  AsignacionResumen,
  EstadoAsignacion,
  EstadoOferta,
  PaginatedResponse,
} from './turnos';

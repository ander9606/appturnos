// Types
export * from './types';

// Client initializer + TokenStore interface
export { initApiClient } from './client';
export type { TokenStore } from './client';

// API modules
export { authApi } from './auth';
export type { CrearGestorPayload, CrearGestorResult, Gestor } from './auth';
export { empresasApi } from './empresas';
export type { EmpresaDirectorio, Empresa, ActualizarMiEmpresaPayload, DirectorioResponse } from './empresas';
export { trabajadorEmpresaApi } from './trabajador-empresa';
export type {
  Vinculo,
  MisEmpresasResponse,
  SolicitudAdmin,
  EstadoVinculo,
} from './trabajador-empresa';
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
  TipoMarcacion,
  TipoDia,
  TrabajadorNominaPerfil,
  DescansoCompensatorio,
  EstadoCompensatorio,
} from './nomina';
export { turnosApi, ESTADOS_ASIGNACION } from './turnos';
export type {
  Asignacion,
  CalificacionResponse,
  CrearOfertaPayload,
  Oferta,
  OfertaDetalle,
  AsignacionResumen,
  EstadoAsignacion,
  EstadoOferta,
  TipoGeofence,
  GeofenceInfo,
  PaginatedResponse,
  LiquidacionTurnoLinea,
  LiquidacionTurnosTrabajador,
} from './turnos';
export { cargosApi } from './cargos';
export type { Cargo, CrearCargoPayload, ActualizarCargoPayload, EliminarCargoResult } from './cargos';
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
  UpdateMePayload,
  Experiencia,
  Diploma,
  CargoAsignado,
  ExperienciaPayload,
  DiplomaPayload,
  TipoDocumento,
  SexoTrabajador,
  TipoCuenta,
} from './trabajadores';
export { notificacionesApi } from './notificaciones';
export { novedadesApi } from './novedades';
export type { Novedad, TipoNovedad, CrearNovedadPayload } from './novedades';
export { adminApi } from './admin';
export { reportesApi } from './reportes';
export { integracionApi } from './integracion';
export type {
  IntegracionConfig,
  ActualizarIntegracionPayload,
  EstadoIntegracion,
  ConteoEstado,
  EmparejarResultado,
  CandidatoLogiq360,
  TrabajadorPendiente,
  Conciliacion,
} from './integracion';
export type {
  ReporteParams,
  ReporteRango,
  AsistenciaResponse,
  AsistenciaTurno,
  AsistenciaNomina,
  CostosResponse,
  CostoNominaDetalle,
  HistorialTrabajadorResponse,
} from './reportes';
export type {
  EmpresaAdmin,
  EmpresasListResponse,
  EmpresasListParams,
  CrearEmpresaPayload,
  ActualizarEmpresaPayload,
  ReportesGlobales,
  PlanEmpresa,
} from './admin';

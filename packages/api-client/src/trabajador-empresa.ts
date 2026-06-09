import { api } from './client';

// ── Types ─────────────────────────────────────────────────────────────────

export type EstadoVinculo =
  | 'solicitado_por_trabajador'
  | 'solicitado_por_empresa'
  | 'activo'
  | 'rechazado'
  | 'archivado';

export interface Vinculo {
  id: number;
  usuario_id: number;
  empresa_id: number;
  trabajador_id: number | null;
  estado: EstadoVinculo;
  iniciado_por: 'trabajador' | 'empresa';
  fecha_solicitud: string;
  fecha_resuelto: string | null;
  motivo_rechazo: string | null;
  empresa_nombre: string;
  empresa_slug: string;
  empresa_logo: string | null;
  empresa_ciudad: string | null;
}

export interface MisEmpresasResponse {
  activas: Vinculo[];
  pendientes: Vinculo[];
  invitaciones: Vinculo[];
  archivadas: Vinculo[];
}

export interface SolicitudAdmin {
  id: number;
  usuario_id: number;
  empresa_id: number;
  trabajador_id: number | null;
  estado: EstadoVinculo;
  iniciado_por: 'trabajador' | 'empresa';
  fecha_solicitud: string;
  usuario_nombre: string;
  usuario_apellido: string | null;
  usuario_email: string;
}

// ── API ───────────────────────────────────────────────────────────────────

export const trabajadorEmpresaApi = {
  /** Trabajador: ver sus vínculos agrupados por estado */
  misEmpresas(): Promise<MisEmpresasResponse> {
    return api.get<MisEmpresasResponse>('/api/trabajador-empresa/mis-empresas');
  },

  /** Trabajador: solicitar unirse a una empresa */
  solicitar(empresa_id: number): Promise<Vinculo> {
    return api.post<Vinculo>('/api/trabajador-empresa/solicitar', { empresa_id });
  },

  /** Trabajador: aceptar una invitación de empresa */
  aceptar(id: number): Promise<Vinculo> {
    return api.post<Vinculo>(`/api/trabajador-empresa/${id}/aceptar`, {});
  },

  /** Trabajador o empresa: rechazar solicitud/invitación */
  rechazar(id: number, motivo?: string): Promise<Vinculo> {
    return api.post<Vinculo>(`/api/trabajador-empresa/${id}/rechazar`, { motivo });
  },

  /** Admin/Jefe: ver solicitudes pendientes de su empresa */
  solicitudes(estado?: string): Promise<SolicitudAdmin[]> {
    const suffix = estado ? `?estado=${encodeURIComponent(estado)}` : '';
    return api.get<SolicitudAdmin[]>(`/api/trabajador-empresa/solicitudes${suffix}`);
  },

  /** Admin/Jefe: aprobar solicitud de un trabajador */
  aprobar(id: number): Promise<Vinculo> {
    return api.post<Vinculo>(`/api/trabajador-empresa/${id}/aprobar`, {});
  },
};

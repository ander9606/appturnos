import { api } from './client';

// ── Types ─────────────────────────────────────────────────────────────────

export interface IntegracionConfig {
  empresa_id: number;
  activo: 0 | 1;
  webhook_url: string | null;
  tiene_webhook_secret: boolean;
  tiene_api_key: boolean;
  tiene_incoming_secret: boolean;
  configurado: boolean;
}

export interface ActualizarIntegracionPayload {
  activo?: boolean;
  webhook_url?: string | null;
  webhook_secret?: string | null;
  incoming_secret?: string | null;
}

export interface ConteoEstado {
  estado: string;
  total: number;
}

export interface EstadoIntegracion {
  activo: boolean;
  webhook_configurado: boolean;
  eventos: {
    salientes: ConteoEstado[];
    entrantes: ConteoEstado[];
  };
}

export interface EmparejarResultado {
  conectado: boolean;
  logiq360_tenant_id: number;
}

export interface CandidatoLogiq360 {
  id: number;
  nombre: string;
  apellido: string;
  email: string | null;
  tipo_contrato: string;
  estado: string;
  external_ref: string;
}

export interface TrabajadorPendiente {
  id: number;
  nombre: string;
  apellido: string;
  cedula: string | null;
  external_ref: string | null;
  sugerencia: { id: number; nombre: string } | null;
}

export interface Conciliacion {
  pendientes: TrabajadorPendiente[];
  candidatos: CandidatoLogiq360[];
}

// ── API ───────────────────────────────────────────────────────────────────

export const integracionApi = {
  obtenerConfig(): Promise<IntegracionConfig> {
    return api.get<IntegracionConfig>('/api/integracion/configuracion');
  },

  actualizarConfig(payload: ActualizarIntegracionPayload): Promise<IntegracionConfig> {
    return api.put<IntegracionConfig>('/api/integracion/configuracion', payload);
  },

  obtenerEstado(): Promise<EstadoIntegracion> {
    return api.get<EstadoIntegracion>('/api/integracion/estado');
  },

  /** Conecta con logiq360 usando un código de emparejamiento generado allá. */
  emparejar(codigo: string): Promise<EmparejarResultado> {
    return api.post<EmparejarResultado>('/api/integracion/emparejar', { codigo });
  },

  /** Personal sin vincular + candidatos de logiq360 + sugerencias de match. */
  conciliacion(): Promise<Conciliacion> {
    return api.get<Conciliacion>('/api/integracion/conciliacion');
  },

  /** Vincula un trabajador de App Turnos a un empleado de logiq360. */
  vincularEmpleado(trabajadorId: number, empleadoId: number): Promise<{ vinculado: boolean }> {
    return api.post('/api/integracion/conciliacion/vincular', {
      trabajador_id: trabajadorId,
      empleado_id: empleadoId,
    });
  },

  /** Re-encola todos los eventos fallidos para que el worker los reintente. */
  reintentarFallidos(): Promise<{ reintentados: number }> {
    return api.post('/api/integracion/reintentar-fallidos', {});
  },
};

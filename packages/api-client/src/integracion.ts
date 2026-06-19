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
};

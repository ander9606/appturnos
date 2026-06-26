export interface EstadoIntegracion {
  activo: boolean;
  webhook_configurado: boolean;
  eventos: {
    salientes: { estado: string; total: number }[];
    entrantes: { estado: string; total: number }[];
  };
}

export interface ConfigIntegracion {
  empresa_id: number;
  activo: boolean | number;
  webhook_url: string | null;
  tiene_webhook_secret: boolean;
  tiene_api_key: boolean;
  tiene_incoming_secret: boolean;
  configurado: boolean;
}

export interface TrabajadorPendiente {
  id: number;
  nombre: string;
  apellido: string;
  cedula: string | null;
  cargo: string | null;
  sugerencia: { id: number; nombre: string } | null;
}

export interface CandidatoLogiq360 {
  id: number;
  nombre: string;
  apellido: string;
}

export interface ConciliacionData {
  pendientes: TrabajadorPendiente[];
  candidatos: CandidatoLogiq360[];
}

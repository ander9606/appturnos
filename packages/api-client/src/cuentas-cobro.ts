import { api } from './client';

export interface CuentaCobroItem {
  asignacion_id: number;
  fecha: string;
  descripcion: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  horas: number;
  valor: number;
}

export interface CuentaCobroResumen {
  id: number;
  numero_cuenta: string;
  fecha_inicio: string;
  fecha_fin: string;
  total_turnos: number;
  total_horas: number;
  valor_total: number;
  firmado_trabajador: boolean;
  firmado_at: string | null;
}

export interface CuentaCobro extends CuentaCobroResumen {
  empresa_id: number;
  periodo_id: number;
  trabajador_id: number;
  items: CuentaCobroItem[];
  firma_b64: string | null;
  created_at: string;
  trabajador_nombre: string;
  trabajador_apellido: string;
  trabajador_cedula: string;
  empresa_nombre: string;
  empresa_nit: string | null;
  /** Última firma guardada del trabajador — atajo para firmar sin redibujar. */
  trabajador_firma_guardada: string | null;
}

export const cuentasCobroApi = {
  listar(): Promise<CuentaCobroResumen[]> {
    return api.get('/api/cuentas-cobro');
  },
  listarSinFirmar(): Promise<CuentaCobroResumen[]> {
    return api.get('/api/cuentas-cobro/sin-firmar');
  },
  obtener(id: number): Promise<CuentaCobro> {
    return api.get(`/api/cuentas-cobro/${id}`);
  },
  firmar(id: number, firma_b64: string): Promise<CuentaCobro> {
    return api.post(`/api/cuentas-cobro/${id}/firmar`, { firma_b64 });
  },
};

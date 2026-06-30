import { api } from './client';

export interface ContratoResumen {
  id: number;
  numero_contrato: string;
  fecha: string;
  valor_dia: number;
  firmado_trabajador: boolean;
  firmado_at: string | null;
  oferta_titulo: string;
  hora_inicio: string;
  hora_fin_estimada: string;
}

export interface Contrato extends ContratoResumen {
  empresa_id: number;
  asignacion_id: number;
  descripcion_labor: string | null;
  firma_b64: string | null;
  pdf_url: string | null;
  created_at: string;
  trabajador_nombre: string;
  trabajador_apellido: string;
  trabajador_cedula: string;
  lugar: string | null;
  empresa_nombre: string;
  empresa_nit: string | null;
}

export const contratosApi = {
  listar(): Promise<ContratoResumen[]> {
    return api.get('/api/contratos');
  },
  obtenerPorAsignacion(asignacionId: number): Promise<Contrato> {
    return api.get(`/api/contratos/asignacion/${asignacionId}`);
  },
  obtener(id: number): Promise<Contrato> {
    return api.get(`/api/contratos/${id}`);
  },
  firmar(id: number, firma_b64: string): Promise<Contrato> {
    return api.post(`/api/contratos/${id}/firmar`, { firma_b64 });
  },
};

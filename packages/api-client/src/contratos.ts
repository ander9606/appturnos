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

/** Descuento aceptado por el trabajador — es el único estado que cambia el pago pactado (ver descuentos-turno). */
export interface DescuentoAceptado {
  id: number;
  monto: number;
  motivo: string;
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
  trabajador_tipo_documento: string | null;
  /** Dirección de residencia del trabajador — null si aún no la registró. */
  trabajador_direccion: string | null;
  trabajador_eps: string | null;
  trabajador_afp: string | null;
  lugar: string | null;
  empresa_nombre: string;
  empresa_nit: string | null;
  empresa_ciudad: string | null;
  empresa_direccion: string | null;
  /** Nombre y cédula de quien firma por la empresa — null si aún no los registró. */
  empresa_representante_nombre: string | null;
  empresa_representante_cedula: string | null;
  /** Firma guardada del representante legal — SVG de trazos o imagen subida. null si aún no la cargó. */
  empresa_firma_representante_b64: string | null;
  /** Última firma guardada del trabajador — atajo para firmar sin redibujar. */
  trabajador_firma_guardada: string | null;
  /** Bono extra (ej. propina) asignado al turno — 0 si no tiene. */
  bono_monto: number;
  bono_motivo: string | null;
  /** Descuentos ya aceptados por el trabajador — solo estos cambian el pago pactado. */
  descuentos: DescuentoAceptado[];
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

export function obtenerContratoURL(asignacionId: number, token: string): string {
  const base = process.env.EXPO_PUBLIC_API_URL;
  return `${base}/api/contratos/asignacion/${asignacionId}/pdf?token=${token}`;
}

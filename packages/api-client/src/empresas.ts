import { api } from './client';

export interface EmpresaDirectorio {
  id: number;
  nombre: string;
  slug: string;
  ciudad: string | null;
  logo_url: string | null;
  descripcion: string | null;
  acepta_postulaciones: boolean;
}

export interface DirectorioResponse {
  data: EmpresaDirectorio[];
  pagination: { page: number; limit: number; total: number };
}

export const empresasApi = {
  async directorio(params: { busqueda?: string; ciudad?: string; page?: number; limit?: number } = {}): Promise<DirectorioResponse> {
    const qs = new URLSearchParams();
    if (params.busqueda) qs.set('busqueda', params.busqueda);
    if (params.ciudad)   qs.set('ciudad', params.ciudad);
    if (params.page)     qs.set('page', String(params.page));
    if (params.limit)    qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return api.get<DirectorioResponse>(`/api/empresas/directorio${suffix}`);
  },
};

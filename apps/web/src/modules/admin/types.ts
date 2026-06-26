export type Plan = 'basico' | 'profesional' | 'empresarial';

export interface EmpresaAdmin {
  id: number;
  nombre: string;
  slug: string;
  nit: string | null;
  ciudad: string | null;
  activo: boolean | number;
  plan: Plan;
  acepta_postulaciones: boolean | number;
  logo_url: string | null;
  descripcion: string | null;
  created_at: string;
  total_trabajadores: number;
  total_usuarios: number;
  total_ofertas?: number;
  total_periodos?: number;
}

export interface ReportesGlobales {
  empresas: { total: number; activas: number; inactivas: number };
  usuarios: { total: number };
  trabajadores: { total: number; activos: number };
  turnos: { ultimo_mes: number };
  nomina: { periodos_abiertos: number };
  distribucion_planes: Partial<Record<Plan, number>>;
}

import { useQuery } from '@tanstack/react-query';
import { reportesApi } from '../api/reportesApi';
import type { Rango } from '../types';

// Mismos datos para todas las secciones: react-query comparte la petición por llave
const opciones = { staleTime: 120_000 };

export const useResumen = (r: Rango) => useQuery({ queryKey: ['reportes', 'resumen', r.desde, r.hasta], queryFn: () => reportesApi.resumen(r), ...opciones });
export const usePersonas = (r: Rango) => useQuery({ queryKey: ['reportes', 'personas', r.desde, r.hasta], queryFn: () => reportesApi.personas(r), ...opciones });
export const useAsistencia = (r: Rango) => useQuery({ queryKey: ['reportes', 'asistencia', r.desde, r.hasta], queryFn: () => reportesApi.asistencia(r), ...opciones });
export const useCostos = (r: Rango) => useQuery({ queryKey: ['reportes', 'costos', r.desde, r.hasta], queryFn: () => reportesApi.costos(r), ...opciones });
// Solo se pide si la empresa usa grupos: para el resto de clientes el servidor respondería 403.
export const useReporteGrupos = (r: Rango, enabled: boolean) =>
  useQuery({ queryKey: ['reportes', 'grupos', r.desde, r.hasta], queryFn: () => reportesApi.grupos(r), enabled, ...opciones });

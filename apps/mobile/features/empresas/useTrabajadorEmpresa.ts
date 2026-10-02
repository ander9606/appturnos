import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trabajadorEmpresaApi } from '@api-client';

// ── Query keys ────────────────────────────────────────────────────────────

export const TE_KEYS = {
  misEmpresas: ['trabajador-empresa', 'mis-empresas'] as const,
  solicitudes:  (estado?: string) => ['trabajador-empresa', 'solicitudes', estado] as const,
};

// ── Worker hooks ──────────────────────────────────────────────────────────

export function useMisEmpresas({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: TE_KEYS.misEmpresas,
    queryFn: () => trabajadorEmpresaApi.misEmpresas(),
    staleTime: 30_000,
    enabled,
  });
}

export function useSolicitar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ empresaId, cargoIds }: { empresaId: number; cargoIds?: number[] }) =>
      trabajadorEmpresaApi.solicitar(empresaId, cargoIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: TE_KEYS.misEmpresas }),
  });
}

export function useAceptar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => trabajadorEmpresaApi.aceptar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: TE_KEYS.misEmpresas }),
  });
}

export function useRechazarVinculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo?: string }) =>
      trabajadorEmpresaApi.rechazar(id, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TE_KEYS.misEmpresas });
      qc.invalidateQueries({ queryKey: ['trabajador-empresa', 'solicitudes'] });
    },
  });
}

/** Trabajador: dejar de recibir ofertas de una empresa con la que tiene vínculo activo. */
export function useArchivarVinculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => trabajadorEmpresaApi.archivar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: TE_KEYS.misEmpresas }),
  });
}

// ── Admin hooks ───────────────────────────────────────────────────────────

export function useSolicitudes(estado?: string, enabled = true) {
  return useQuery({
    queryKey: TE_KEYS.solicitudes(estado),
    queryFn: () => trabajadorEmpresaApi.solicitudes(estado),
    staleTime: 30_000,
    enabled,
  });
}

export function useInvitar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cedula, tipo }: { cedula: string; tipo?: 'turnos' | 'nomina' }) =>
      trabajadorEmpresaApi.invitar(cedula, tipo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trabajador-empresa', 'solicitudes'] });
    },
  });
}

/** Admin/Jefe: dejar de ofrecerle turnos a un trabajador. */
export function useBloquearOfertas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trabajadorId: number) => trabajadorEmpresaApi.bloquearOfertas(trabajadorId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trabajadores'] }),
  });
}

export function useAprobar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => trabajadorEmpresaApi.aprobar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trabajador-empresa', 'solicitudes'] });
      qc.invalidateQueries({ queryKey: ['trabajadores'] });
    },
  });
}

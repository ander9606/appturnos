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
    mutationFn: (empresa_id: number) => trabajadorEmpresaApi.solicitar(empresa_id),
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
    mutationFn: (cedula: string) => trabajadorEmpresaApi.invitar(cedula),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trabajador-empresa', 'solicitudes'] });
    },
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

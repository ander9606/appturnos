import React from 'react';
import { useOpcionesGrupos } from '@/features/empresas/useOpcionesGrupos';
import { tieneGrupos } from '@/features/grupos/misGrupos';
import { useMisTurnos } from '@/features/turnos/useTurnos';
import { FilaAcceso } from './PerfilUi';

/**
 * Acceso a los grupos desde el Perfil, con el nombre que la empresa les puso. Solo si la empresa los activó:
 * - quien gestiona turnos (admin, jefe de turnos) abre la pantalla de grupos («Eventos»);
 * - el trabajador, si alguno de sus turnos tiene grupo, abre su pantalla «Mis eventos».
 * Cualquier otro rol no ve nada (y no consulta nada).
 */
export function FilaGrupos({ rol }: { rol: string | undefined }) {
  const gestiona = rol === 'admin_empresa' || rol === 'jefe_turnos';
  const esTrabajador = rol === 'trabajador_turnos';
  const { usa, etiquetaPlural } = useOpcionesGrupos(gestiona || esTrabajador);
  const { data: misTurnos } = useMisTurnos({ enabled: esTrabajador });
  if (!usa) return null;
  if (gestiona) return <FilaAcceso icon="albums-outline" label={etiquetaPlural} route="/grupos" />;
  if (esTrabajador && tieneGrupos(misTurnos ?? [])) {
    return <FilaAcceso icon="albums-outline" label={`Mis ${etiquetaPlural.toLowerCase()}`} route="/mis-grupos" />;
  }
  return null;
}

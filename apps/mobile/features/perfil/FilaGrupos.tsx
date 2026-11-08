import React from 'react';
import { useOpcionesGrupos } from '@/features/empresas/useOpcionesGrupos';
import { nombresDeMisGrupos, tieneGrupos } from '@/features/grupos/misGrupos';
import { useMisTurnos } from '@/features/turnos/useTurnos';
import { FilaAcceso } from './PerfilUi';

/**
 * Acceso a los grupos desde el Perfil, con el nombre que la empresa les puso:
 * - quien gestiona turnos (admin, jefe de turnos) abre la pantalla de grupos («Eventos») si su empresa los activó;
 * - el trabajador, si alguno de sus turnos tiene grupo, abre su pantalla «Mis eventos». El nombre sale de sus propios
 *   turnos, porque en dos empresas los grupos pueden llamarse distinto («Mis eventos y obras»).
 * Cualquier otro rol no ve nada (y no consulta nada).
 */
export function FilaGrupos({ rol }: { rol: string | undefined }) {
  const gestiona = rol === 'admin_empresa' || rol === 'jefe_turnos';
  const esTrabajador = rol === 'trabajador_turnos';
  const { usa, etiquetaPlural } = useOpcionesGrupos(gestiona);
  const { data: misTurnos } = useMisTurnos({ enabled: esTrabajador });
  if (gestiona) return usa ? <FilaAcceso icon="albums-outline" label={etiquetaPlural} route="/grupos" /> : null;
  if (esTrabajador && tieneGrupos(misTurnos ?? [])) {
    return <FilaAcceso icon="albums-outline" label={`Mis ${nombresDeMisGrupos(misTurnos ?? [])}`} route="/mis-grupos" />;
  }
  return null;
}

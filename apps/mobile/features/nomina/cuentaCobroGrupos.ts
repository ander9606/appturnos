import type { CuentaCobroItem } from '@api-client';

export interface SeccionCuenta {
  grupoId: number | null;
  /** null = turnos sin grupo. */
  nombre: string | null;
  items: CuentaCobroItem[];
  subtotal: number;
}

/**
 * Reparte los ítems de una cuenta de cobro por grupo de turnos, con el subtotal de cada uno (igual que el PDF del
 * backend: cuentaCobroPdf.js). Devuelve null si ningún ítem tiene grupo: la cuenta se muestra como siempre.
 * Cada grupo va según su primer ítem (ya vienen por fecha) y «sin grupo» al final; se distinguen por id.
 */
export function agruparItemsCuenta(items: CuentaCobroItem[]): SeccionCuenta[] | null {
  if (!items.some((i) => i.grupo_id)) return null;
  const porClave = new Map<number | null, SeccionCuenta>();
  for (const item of items) {
    const clave = item.grupo_id ?? null;
    let sec = porClave.get(clave);
    if (!sec) {
      sec = { grupoId: clave, nombre: clave === null ? null : (item.grupo_nombre || 'Grupo'), items: [], subtotal: 0 };
      porClave.set(clave, sec);
    }
    sec.items.push(item);
    sec.subtotal = Math.round((sec.subtotal + Number(item.valor)) * 100) / 100;
  }
  const lista = [...porClave.values()];
  return [...lista.filter((s) => s.grupoId !== null), ...lista.filter((s) => s.grupoId === null)];
}

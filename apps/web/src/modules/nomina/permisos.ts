import { useAuthStore } from '@/modules/auth/authStore';

/** Gestión de nómina. Lee el rol sin hook para poder usarlo dentro de JSX condicional. */
export function puedeGestionarNomina(): boolean {
  const rol = useAuthStore.getState().usuario?.rol;
  return rol === 'admin_empresa' || rol === 'jefe_nomina';
}

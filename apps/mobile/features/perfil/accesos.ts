import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export interface Acceso {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  route: string;
  /** Se anuncia como botón (`accessibilityRole`); hoy solo "Mi plan" e "Integración logiq360". */
  boton?: boolean;
}

// Accesos rápidos de la tarjeta "Cuenta", según el rol (en el orden en que se dibujan).

export const ACCESOS_TRABAJADOR_TURNOS: Acceso[] = [
  { icon: 'id-card-outline',        label: 'Perfil laboral',    route: '/mi-perfil-laboral' },
  { icon: 'list-outline',           label: 'Mis postulaciones', route: '/mis-postulaciones' },
  { icon: 'business-outline',       label: 'Mis empresas',      route: '/mis-empresas' },
  { icon: 'calendar-clear-outline', label: 'Mi disponibilidad', route: '/disponibilidad' },
];

export const ACCESOS_JEFE_TURNOS: Acceso[] = [
  { icon: 'people-outline',     label: 'Mi equipo',                route: '/(tabs)/equipo' },
  { icon: 'person-add-outline', label: 'Solicitudes de ingreso',   route: '/solicitudes' },
  { icon: 'calendar-outline',   label: 'Gestión de turnos',        route: '/(tabs)/turnos' },
  { icon: 'briefcase-outline',  label: 'Gestión de cargos',        route: '/cargos' },
  { icon: 'bar-chart-outline',  label: 'Reportes',                 route: '/reportes' },
  { icon: 'pulse-outline',      label: 'Estado de sincronización', route: '/integracion/estado' },
  { icon: 'location-outline',   label: 'Puntos de marcaje',        route: '/puntos-marcaje' },
];

export const ACCESOS_GESTOR_NOMINA: Acceso[] = [
  { icon: 'bar-chart-outline', label: 'Reportes', route: '/reportes' },
];

export const ACCESOS_ADMIN: Acceso[] = [
  { icon: 'business-outline',   label: 'Mi empresa',             route: '/mi-empresa' },
  { icon: 'pricetag-outline',   label: 'Mi plan',                route: '/mi-plan', boton: true },
  { icon: 'people-outline',     label: 'Gestores',               route: '/gestores' },
  { icon: 'bar-chart-outline',  label: 'Reportes',               route: '/reportes' },
  { icon: 'person-add-outline', label: 'Crear gestor',           route: '/crear-gestor' },
  { icon: 'person-add-outline', label: 'Solicitudes de ingreso', route: '/solicitudes' },
  { icon: 'briefcase-outline',  label: 'Gestión de cargos',      route: '/cargos' },
  { icon: 'location-outline',   label: 'Puntos de marcaje',      route: '/puntos-marcaje' },
  { icon: 'link-outline',       label: 'Integración logiq360',   route: '/integracion/config', boton: true },
];

// Tarjeta de ausencias y contratos (trabajadores). Los dos últimos solo los ve el trabajador de turnos.

export const ACCESO_AUSENCIAS: Acceso = { icon: 'calendar-clear-outline', label: 'Mis ausencias', route: '/ausencias' };

export const ACCESOS_CONTRATOS_TURNOS: Acceso[] = [
  { icon: 'document-text-outline', label: 'Mis contratos',        route: '/mis-contratos' },
  { icon: 'receipt-outline',       label: 'Mis cuentas de cobro', route: '/mis-cuentas-cobro' },
];

export const ACCESOS_LEGAL: Acceso[] = [
  { icon: 'shield-checkmark-outline', label: 'Términos y condiciones', route: '/terminos' },
  { icon: 'lock-closed-outline',      label: 'Política de privacidad', route: '/privacidad' },
];

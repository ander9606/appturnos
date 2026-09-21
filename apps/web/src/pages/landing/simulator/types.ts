export type Role = 'trabajador' | 'jefe_turnos' | 'nomina';
export type Tab = 'inicio' | 'turnos' | 'nomina' | 'equipo';
export type Detail =
  | { kind: 'turno'; org: string; title: string; meta: string; pago?: string; cobertura?: string }
  | { kind: 'miembro'; nombre: string; rol: string; inicial: string; color: string }
  | { kind: 'crear' }
  | { kind: 'marcaje' }
  | { kind: 'acumulado' };

export type ScreenInfo = { tag: string; title: string; body: string; bullets: string[] };

export function isGestorRole(role: Role): role is 'jefe_turnos' | 'nomina' {
  return role === 'jefe_turnos' || role === 'nomina';
}

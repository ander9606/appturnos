'use strict';

export type NivelRanking = 'nuevo' | 'critico' | 'bajo' | 'medio' | 'alto' | 'elite';

export function nivelRanking(
  ranking: number | null | undefined,
  totalCalificaciones = 0,
): NivelRanking {
  if (ranking == null || totalCalificaciones === 0) return 'nuevo';
  const r = Number(ranking);
  if (r >= 4.5) return 'elite';
  if (r >= 3.5) return 'alto';
  if (r >= 2.5) return 'medio';
  if (r >= 1.0) return 'bajo';
  return 'critico';
}

export function rankingLabel(nivel: NivelRanking): string {
  const labels: Record<NivelRanking, string> = {
    nuevo:   'Nuevo',
    critico: 'Crítico',
    bajo:    'Bajo',
    medio:   'Medio',
    alto:    'Alto',
    elite:   'Elite',
  };
  return labels[nivel];
}

export function rankingColor(nivel: NivelRanking): string {
  const colors: Record<NivelRanking, string> = {
    nuevo:   '#6B7280', // gray
    critico: '#EF4444', // red
    bajo:    '#F97316', // orange
    medio:   '#EAB308', // yellow
    alto:    '#22C55E', // green
    elite:   '#8B5CF6', // purple
  };
  return colors[nivel];
}

export function rankingDescription(nivel: NivelRanking): string {
  const descriptions: Record<NivelRanking, string> = {
    nuevo:   'Sin historial de calificaciones',
    critico: 'Calificación crítica — acceso muy limitado a ofertas',
    bajo:    'Calificación baja — acceso reducido a ofertas (60 min de espera)',
    medio:   'Calificación media — 30 min de espera para ver ofertas',
    alto:    'Calificación alta — 15 min de espera para ver ofertas',
    elite:   'Calificación élite — acceso inmediato a todas las ofertas',
  };
  return descriptions[nivel];
}

/** Cuántos minutos de retraso tiene este nivel de ranking. */
export function delayMinutos(nivel: NivelRanking): number {
  const delays: Record<NivelRanking, number> = {
    nuevo:   15,
    critico: 60,
    bajo:    60,
    medio:   30,
    alto:    15,
    elite:   0,
  };
  return delays[nivel];
}

export function delayLabel(nivel: NivelRanking): string {
  const min = delayMinutos(nivel);
  if (min === 0) return 'Acceso inmediato';
  return `${min} min de espera`;
}

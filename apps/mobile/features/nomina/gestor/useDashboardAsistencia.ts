/**
 * useDashboardAsistencia — datos para el dashboard de asistencia del gestor.
 *
 * Hace 3 queries en paralelo y los combina en una vista plana por trabajador:
 *   1. Trabajadores nomina activos de la empresa
 *   2. Registros de HOY (estado actual del marcaje)
 *   3. Registros de la semana actual (horas acumuladas vs límite legal)
 */

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { trabajadoresApi, nominaApi } from '@api-client';
import type { Trabajador, RegistroDiario } from '@api-client';
import { getJornadaLegalSemanal } from '../trabajador/nominaTrabajadorUtils';
import { toISODate, bogotaToday } from '@/lib/formatters';

// ── Helpers de fecha ───────────────────────────────────────────────────────

function hoyISO() { return bogotaToday(); }

function lunesDeSemanaISO() {
  const d = new Date();
  const dia = d.getDay();
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
  return toISODate(d);
}

function domingoDeSemanaISO() {
  const d = new Date();
  const dia = d.getDay();
  d.setDate(d.getDate() + (dia === 0 ? 0 : 7 - dia));
  return toISODate(d);
}

// ── Tipos del dashboard ────────────────────────────────────────────────────

export type EstadoAsistencia =
  | 'en_jornada'        // marcó entrada, sin salida
  | 'completo'          // marcó entrada y salida
  | 'especial'          // descanso, vacación, compensatorio, etc.
  | 'ausente';          // no hay registro hoy

export interface FilaDashboard {
  trabajador:      Trabajador;
  registroHoy:     RegistroDiario | null;
  estado:          EstadoAsistencia;
  horaEntrada:     string | null;
  horaSalida:      string | null;
  horasSemana:     number;
  limiteSemana:    number;
  horasExtra:      number;
  horasNocturnas:  number; // always carry recargo ×1.35, shown separately
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useDashboardAsistencia() {
  const hoy     = hoyISO();
  const lunes   = lunesDeSemanaISO();
  const domingo = domingoDeSemanaISO();
  const year    = new Date().getFullYear();
  const limite  = getJornadaLegalSemanal(year);

  const [queryTrabajadores, queryHoy, querySemana] = useQueries({
    queries: [
      {
        queryKey: ['trabajadores', 'nomina', 'activos'],
        queryFn: () => trabajadoresApi.listar({ tipo: 'nomina', activo: true, limit: 100 }),
        staleTime: 5 * 60_000,
      },
      {
        queryKey: ['registros', 'hoy', hoy],
        queryFn: () => nominaApi.listarRegistros({ fecha: hoy, limit: 200 }),
        staleTime: 30_000,
        refetchInterval: 60_000, // refresca cada minuto (marcajes en tiempo real)
      },
      {
        queryKey: ['registros', 'semana', lunes],
        queryFn: () => nominaApi.listarRegistros({ fecha_desde: lunes, fecha_hasta: domingo, limit: 500 }),
        staleTime: 60_000,
      },
    ],
  });

  const filas: FilaDashboard[] = useMemo(() => {
    const trabajadores = queryTrabajadores.data?.data ?? [];
    const registrosHoy    = queryHoy.data?.data     ?? [];
    const registrosSemana = querySemana.data?.data  ?? [];

    // índice por trabajador_id para acceso O(1)
    const hoyPorTrabajador = new Map<number, RegistroDiario>(
      registrosHoy.map((r) => [r.trabajador_id, r])
    );
    const horasSemPorTrabajador = new Map<number, number>();
    const horasNocPorTrabajador = new Map<number, number>();
    for (const r of registrosSemana) {
      const total =
        Number(r.horas_ordinarias) + Number(r.horas_extra_diurnas) +
        Number(r.horas_extra_nocturnas) + Number(r.horas_nocturnas) +
        Number(r.horas_festivo);
      horasSemPorTrabajador.set(
        r.trabajador_id,
        (horasSemPorTrabajador.get(r.trabajador_id) ?? 0) + total
      );
      horasNocPorTrabajador.set(
        r.trabajador_id,
        (horasNocPorTrabajador.get(r.trabajador_id) ?? 0) + Number(r.horas_nocturnas)
      );
    }

    return trabajadores.map((t) => {
      const reg = hoyPorTrabajador.get(t.id) ?? null;
      const horasSemana = Math.round((horasSemPorTrabajador.get(t.id) ?? 0) * 10) / 10;

      let estado: EstadoAsistencia;
      if (!reg || !reg.hora_entrada) {
        estado = reg?.tipo_dia && reg.tipo_dia !== 'ordinario' ? 'especial' : 'ausente';
      } else if (!reg.hora_salida) {
        estado = 'en_jornada';
      } else {
        estado = 'completo';
      }

      const horasNocturnas = Math.round((horasNocPorTrabajador.get(t.id) ?? 0) * 10) / 10;
      return {
        trabajador:    t,
        registroHoy:   reg,
        estado,
        horaEntrada:   reg?.hora_entrada?.slice(0, 5) ?? null,
        horaSalida:    reg?.hora_salida?.slice(0, 5)  ?? null,
        horasSemana,
        limiteSemana:  limite,
        horasExtra:    Math.max(0, Math.round((horasSemana - limite) * 10) / 10),
        horasNocturnas,
      };
    }).sort((a, b) => {
      // Orden: en_jornada → ausente → completo → especial
      const order = { en_jornada: 0, ausente: 1, completo: 2, especial: 3 };
      const diff = order[a.estado] - order[b.estado];
      if (diff !== 0) return diff;
      return a.trabajador.apellido.localeCompare(b.trabajador.apellido);
    });
  }, [
    queryTrabajadores.data,
    queryHoy.data,
    querySemana.data,
    limite,
  ]);

  const contadores = useMemo(() => ({
    total:      filas.length,
    enJornada:  filas.filter((f) => f.estado === 'en_jornada').length,
    completos:  filas.filter((f) => f.estado === 'completo').length,
    ausentes:   filas.filter((f) => f.estado === 'ausente').length,
    especiales: filas.filter((f) => f.estado === 'especial').length,
  }), [filas]);

  return {
    filas,
    contadores,
    hoy,
    limiteSemana: limite,
    isLoading:    queryTrabajadores.isLoading || queryHoy.isLoading,
    isRefetching: queryHoy.isRefetching || querySemana.isRefetching,
    refetch: () => { queryHoy.refetch(); querySemana.refetch(); },
  };
}

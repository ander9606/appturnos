import { useState } from 'react';
import { toast } from 'sonner';
import { useAsignarCompensatorio, useReasignarCompensatorio, useRangoCompensatorio } from '../hooks/useNomina';
import type { DescansoCompensatorio, RangoDiaCompensatorio } from '../types';
import { Modal } from '@/shared/components/Modal';
import { fmtDiaSemana } from '@/shared/lib/format';

/** "22 sep" — compacto para una pastilla de 28 candidatos. */
function fmtDiaCorto(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00`));
}

const ZONA_CLASE: Record<RangoDiaCompensatorio['zona'], string> = {
  verde: 'bg-success-light text-success border-success/30',
  ambar: 'bg-warning-light text-warning border-warning/30',
  rojo:  'bg-danger-light text-danger border-danger/30',
};

/** Los 28 días candidatos (plazo legal, Art. 179 CST) coloreados por cercanía al día
 *  trabajado. El backend calcula el rango completo — el cliente nunca puede elegir
 *  una fecha fuera de ley ni un día ya ocupado. */
function RangoCompensatorioPicker({
  compensatorioId, seleccionada, onSeleccionar,
}: { compensatorioId: number; seleccionada: string; onSeleccionar: (fecha: string) => void }) {
  const { data: rangoData, isLoading, isError, refetch } = useRangoCompensatorio(compensatorioId, true);
  const dias: RangoDiaCompensatorio[] = rangoData?.data ?? [];
  const disponibles = dias.filter(d => d.disponible);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Cargando fechas disponibles...</p>;
  }
  if (isError) {
    return (
      <div className="py-2 flex flex-col gap-1.5">
        <p className="text-xs text-danger">No se pudieron cargar las fechas disponibles.</p>
        <button type="button" onClick={() => refetch()} className="self-start text-xs font-semibold text-success hover:underline">
          Reintentar
        </button>
      </div>
    );
  }
  if (dias.length > 0 && disponibles.length === 0) {
    return (
      <p className="text-xs text-danger py-2">
        No quedan fechas disponibles dentro del plazo legal de 28 días — revisa los registros del trabajador.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-0.5">
        {dias.map(d => {
          const activa = d.fecha === seleccionada;
          return (
            <button
              key={d.fecha}
              type="button"
              disabled={!d.disponible}
              onClick={() => onSeleccionar(d.fecha)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                !d.disponible
                  ? 'bg-muted text-muted-foreground border-border opacity-50 cursor-not-allowed'
                  : activa
                  ? 'bg-success text-white border-success'
                  : ZONA_CLASE[d.zona]
              }`}
            >
              {fmtDiaCorto(d.fecha)}
            </button>
          );
        })}
      </div>
      <div className="flex gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" />Pronto</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" />Intermedio</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger" />Cerca del límite</span>
      </div>
    </div>
  );
}

export function AsignarCompensatorioModal({ compensatorio, onClose }: { compensatorio: DescansoCompensatorio; onClose: () => void }) {
  const asignar = useAsignarCompensatorio();
  const [fecha, setFecha] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fecha) return;
    await asignar.mutateAsync({ id: compensatorio.id, fecha });
    onClose();
  };

  return (
    <Modal onClose={onClose} size="sm">
      <h2 className="text-lg font-semibold text-foreground mb-1">Asignar descanso compensatorio</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {compensatorio.trabajador_nombre} {compensatorio.trabajador_apellido} · por trabajo el {fmtDiaSemana(compensatorio.origen_fecha)}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <RangoCompensatorioPicker compensatorioId={compensatorio.id} seleccionada={fecha ?? ''} onSeleccionar={setFecha} />
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={asignar.isPending || !fecha} className="flex-1 bg-success hover:bg-success-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            {asignar.isPending ? 'Guardando...' : fecha ? `Asignar ${fmtDiaCorto(fecha)}` : 'Elige una fecha'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ReasignarCompensatorioModal({ compensatorio, onClose }: { compensatorio: DescansoCompensatorio; onClose: () => void }) {
  const reasignar = useReasignarCompensatorio();
  const [fecha, setFecha] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fecha) return;
    if (fecha === compensatorio.fecha_asignada) {
      toast.error('Esa ya es la fecha asignada actual');
      return;
    }
    await reasignar.mutateAsync({ id: compensatorio.id, fecha });
    onClose();
  };

  return (
    <Modal onClose={onClose} size="sm">
      <h2 className="text-lg font-semibold text-foreground mb-1">Reasignar descanso compensatorio</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {compensatorio.trabajador_nombre} {compensatorio.trabajador_apellido} · actualmente el {fmtDiaSemana(compensatorio.fecha_asignada!)} · por trabajo el {fmtDiaSemana(compensatorio.origen_fecha)}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <RangoCompensatorioPicker compensatorioId={compensatorio.id} seleccionada={fecha ?? ''} onSeleccionar={setFecha} />
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={reasignar.isPending || !fecha} className="flex-1 bg-success hover:bg-success-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            {reasignar.isPending ? 'Guardando...' : fecha ? `Mover a ${fmtDiaCorto(fecha)}` : 'Elige una fecha'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

import { useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/Modal';
import { useDuplicarOferta } from '@/modules/turnos/hooks/useTurnos';
import { bogotaToday, fmtDate } from '@/shared/lib/format';
import type { TurnoDeGrupo } from '../types';

const INPUT_CLS = 'w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

/** Copia un turno a otra fecha (y hora): la copia conserva el grupo, el lugar, los puestos y las tarifas. */
export function DuplicarTurnoModal({ turno, onClose }: { turno: TurnoDeGrupo; onClose: () => void }) {
  const duplicar = useDuplicarOferta();
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState(turno.hora_inicio.slice(0, 5));

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fecha) return;
    if (fecha < bogotaToday()) { toast.error('La fecha del turno no puede ser en el pasado'); return; }
    duplicar.mutate(
      { ofertaId: turno.id, fecha, hora_inicio: `${hora}:00` },
      { onSuccess: () => { toast.success(`Turno copiado para el ${fmtDate(fecha)}`); onClose(); } },
    );
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={enviar}>
        <h2 className="text-lg font-semibold text-foreground mb-1">Duplicar turno</h2>
        <p className="text-sm text-muted-foreground mb-4 truncate">«{turno.titulo}»</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label htmlFor="dup-fecha" className="block text-sm font-medium text-foreground mb-1">Nueva fecha</label>
            <input id="dup-fecha" type="date" required min={bogotaToday()} value={fecha} onChange={e => setFecha(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label htmlFor="dup-hora" className="block text-sm font-medium text-foreground mb-1">Hora de inicio</label>
            <input id="dup-hora" type="time" required value={hora} onChange={e => setHora(e.target.value)} className={INPUT_CLS} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
          <button type="submit" disabled={duplicar.isPending || !fecha} className="flex-1 bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            {duplicar.isPending ? 'Duplicando…' : 'Duplicar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

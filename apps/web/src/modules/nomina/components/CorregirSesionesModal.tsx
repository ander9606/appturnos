import { useState } from 'react';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { useCorregirRegistro } from '../hooks/useNomina';
import type { Registro } from '../types';
import { sesionesDelRegistro } from '../utils';
import { Modal } from '@/shared/components/Modal';
import { fmtDiaSemana } from '@/shared/lib/format';

const INPUT_CLASS = 'w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40';

/** '22:53:00' → '22:53' (el input type="time" trabaja a nivel de minuto). */
const aHHMM = (hora: string | null) => (hora ?? '').slice(0, 5);

/**
 * Corrige un día con reingreso (varias sesiones). Los horas_* del registro son la suma de todas las
 * sesiones, así que no se edita "un par de horas": se corrigen las sesiones y el backend recalcula el
 * día completo, igual que al marcar. No se agregan ni se quitan sesiones.
 */
export function CorregirSesionesModal({ registro, onClose }: { registro: Registro; onClose: () => void }) {
  const corregir = useCorregirRegistro();
  const ultimaAbierta = !registro.hora_salida; // el reingreso quedó sin salida: se le puede poner o dejarlo en curso
  const [sesiones, setSesiones] = useState(() =>
    sesionesDelRegistro(registro).map(s => ({ hora_entrada: aHHMM(s.hora_entrada), hora_salida: aHHMM(s.hora_salida) })),
  );
  const [novedad, setNovedad] = useState(registro.novedad ?? '');

  function cambiar(i: number, campo: 'hora_entrada' | 'hora_salida', valor: string) {
    setSesiones(prev => prev.map((s, j) => (j === i ? { ...s, [campo]: valor } : s)));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const incompleta = sesiones.some(
      (s, i) => !s.hora_entrada || (!(ultimaAbierta && i === sesiones.length - 1) && !s.hora_salida),
    );
    if (incompleta) {
      toast.error('Completa todas las horas');
      return;
    }
    try {
      await corregir.mutateAsync({
        id: registro.id,
        // La última, si seguía abierta y no se le puso salida, sigue en curso (null).
        sesiones: sesiones.map(s => ({ hora_entrada: s.hora_entrada, hora_salida: s.hora_salida || null })),
        novedad: novedad || undefined,
      });
      onClose();
    } catch {
      // El hook ya muestra el motivo que da el backend (sesiones solapadas, período cerrado, etc.).
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-foreground mb-1">Corregir sesiones ({sesiones.length})</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {fmtDiaSemana(registro.fecha)}
        {registro.trabajador_nombre ? ` · ${registro.trabajador_nombre} ${registro.trabajador_apellido ?? ''}` : ''}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {sesiones.map((s, i) => {
          const enCurso = ultimaAbierta && i === sesiones.length - 1 && !s.hora_salida;
          return (
            <fieldset key={i} className="border border-border rounded-lg px-3 py-2.5">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sesión {i + 1}</legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Hora entrada</label>
                  <input type="time" value={s.hora_entrada} onChange={e => cambiar(i, 'hora_entrada', e.target.value)} className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Hora salida{enCurso && <span className="text-muted-foreground font-normal"> (en curso)</span>}
                  </label>
                  <input type="time" value={s.hora_salida} onChange={e => cambiar(i, 'hora_salida', e.target.value)} className={INPUT_CLASS} />
                </div>
              </div>
            </fieldset>
          );
        })}
        <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs bg-info-light text-info">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            Al guardar se recalculan las horas de todo el día. Las sesiones deben ir en orden y sin solaparse.
            {ultimaAbierta ? ' Si la última quedó sin salida, ponle la hora para cerrarla.' : ''}
          </span>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Novedad</label>
          <input type="text" value={novedad} onChange={e => setNovedad(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={corregir.isPending} className="flex-1 bg-success hover:bg-success-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            {corregir.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

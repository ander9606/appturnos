import { Modal } from '@/shared/components/Modal';
import { UbicacionLink } from '@/shared/components/UbicacionLink';
import { fmtDiaSemana } from '@/shared/lib/format';
import type { Registro } from '../types';

export function UbicacionMarcajeModal({ registro, onClose }: { registro: Registro; onClose: () => void }) {
  return (
    <Modal onClose={onClose} size="sm" closeOnBackdrop>
      <h2 className="text-lg font-semibold text-foreground mb-1">Ubicación de marcaje</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {registro.trabajador_nombre} {registro.trabajador_apellido} · {fmtDiaSemana(registro.fecha)}
      </p>
      <div className="flex flex-col gap-2.5">
        {registro.latitud_entrada != null && (
          <UbicacionLink lat={registro.latitud_entrada} lng={registro.longitud_entrada!} label="Entrada" />
        )}
        {registro.latitud_salida != null && (
          <UbicacionLink lat={registro.latitud_salida} lng={registro.longitud_salida!} label="Salida" />
        )}
      </div>
      <button
        onClick={onClose}
        className="mt-5 w-full border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors"
      >
        Cerrar
      </button>
    </Modal>
  );
}

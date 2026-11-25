import { useState } from 'react';
import { useCorregirRegistro } from '../hooks/useNomina';
import type { Registro } from '../types';
import { Modal } from '@/shared/components/Modal';
import { fmtDiaSemana } from '@/shared/lib/format';
import { CompensatorioSelector } from './CompensatorioSelector';

/**
 * Marcar un día directamente como «compensatorio» descuenta un descanso pendiente del trabajador: el gestor elige
 * cuál (el más antiguo viene preseleccionado). Reemplaza la confirmación del navegador, que no dejaba elegir.
 */
export function MarcarCompensatorioModal({ registro, onClose }: { registro: Registro; onClose: () => void }) {
  const corregir = useCorregirRegistro();
  const [compensatorioId, setCompensatorioId] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (compensatorioId === null) return;
    await corregir.mutateAsync({ id: registro.id, tipo_dia: 'compensatorio', compensatorio_id: compensatorioId });
    onClose();
  };

  return (
    <Modal onClose={onClose} size="sm">
      <h2 className="text-lg font-semibold text-foreground mb-1">Marcar como compensatorio</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {registro.trabajador_nombre} {registro.trabajador_apellido} · {fmtDiaSemana(registro.fecha)}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <CompensatorioSelector
          trabajadorId={registro.trabajador_id}
          fecha={registro.fecha}
          value={compensatorioId}
          onChange={setCompensatorioId}
        />
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={corregir.isPending || compensatorioId === null}
            className="flex-1 bg-success hover:bg-success-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            {corregir.isPending ? 'Guardando...' : 'Marcar día'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

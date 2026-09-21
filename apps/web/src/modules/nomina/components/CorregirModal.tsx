import { useState } from 'react';
import { toast } from 'sonner';
import { useCorregirRegistro } from '../hooks/useNomina';
import type { Registro, TipoDia } from '../types';
import { Modal } from '@/shared/components/Modal';
import { fmtDiaSemana } from '@/shared/lib/format';
import { TIPO_DIA_OPTIONS } from '../constants';

export function CorregirModal({ registro, onClose }: { registro: Registro; onClose: () => void }) {
  const corregir = useCorregirRegistro();
  const [form, setForm] = useState({
    hora_entrada: registro.hora_entrada ?? '',
    hora_salida: registro.hora_salida ?? '',
    tipo_dia: registro.tipo_dia,
    novedad: registro.novedad ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.hora_entrada && form.hora_salida && form.hora_entrada === form.hora_salida) {
      toast.error('La hora de salida no puede ser igual a la de entrada');
      return;
    }
    await corregir.mutateAsync({
      id: registro.id,
      hora_entrada: form.hora_entrada || undefined,
      hora_salida: form.hora_salida || undefined,
      tipo_dia: form.tipo_dia,
      novedad: form.novedad || undefined,
    });
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-foreground mb-1">Corregir registro</h2>
      <p className="text-sm text-muted-foreground mb-4">{fmtDiaSemana(registro.fecha)}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Hora entrada</label>
            <input
              type="time"
              value={form.hora_entrada}
              onChange={e => setForm(f => ({ ...f, hora_entrada: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Hora salida</label>
            <input
              type="time"
              value={form.hora_salida}
              onChange={e => setForm(f => ({ ...f, hora_salida: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Tipo día</label>
          <select
            value={form.tipo_dia}
            onChange={e => setForm(f => ({ ...f, tipo_dia: e.target.value as TipoDia }))}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
          >
            {TIPO_DIA_OPTIONS.map(o => (
              <option key={o} value={o} className="capitalize">{o.charAt(0).toUpperCase() + o.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Novedad</label>
          <input
            type="text"
            value={form.novedad}
            onChange={e => setForm(f => ({ ...f, novedad: e.target.value }))}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
          />
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

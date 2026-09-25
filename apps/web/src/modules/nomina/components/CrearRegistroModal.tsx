import { useState } from 'react';
import { toast } from 'sonner';
import { useCrearRegistro, useTrabajadoresNomina } from '../hooks/useNomina';
import type { Trabajador } from '../types';
import { Modal } from '@/shared/components/Modal';

export function CrearRegistroModal({ periodoId, onClose }: { periodoId: number; onClose: () => void }) {
  const crear = useCrearRegistro();
  const { data: trabData } = useTrabajadoresNomina();
  const trabajadores: Trabajador[] = trabData?.data?.data ?? [];
  const hoy = new Date().toLocaleDateString('en-CA');
  const [form, setForm] = useState({
    trabajador_id: '',
    fecha: '',
    hora_entrada: '',
    hora_salida: '',
    novedad: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.hora_salida && form.hora_salida <= form.hora_entrada) {
      toast.error('La hora de salida debe ser posterior a la de entrada');
      return;
    }
    await crear.mutateAsync({
      periodo_id: periodoId,
      trabajador_id: Number(form.trabajador_id),
      fecha: form.fecha,
      hora_entrada: form.hora_entrada,
      hora_salida: form.hora_salida || undefined,
      novedad: form.novedad || undefined,
    });
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-foreground mb-4">Agregar registro</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Trabajador *</label>
          <select
            required
            value={form.trabajador_id}
            onChange={e => setForm(f => ({ ...f, trabajador_id: e.target.value }))}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
          >
            <option value="">Seleccionar...</option>
            {trabajadores.map(t => (
              <option key={t.id} value={t.id}>{t.nombre} {t.apellido}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Fecha *</label>
          <input
            type="date"
            required
            max={hoy}
            value={form.fecha}
            onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Hora entrada *</label>
            <input
              type="time"
              required
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
          <button type="submit" disabled={crear.isPending} className="flex-1 bg-success hover:bg-success-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            {crear.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

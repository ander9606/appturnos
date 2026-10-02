import { useState } from 'react';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { useCrearRegistro, useCrearRegistroRango, useTrabajadoresNomina } from '../hooks/useNomina';
import type { Trabajador, TipoDia } from '../types';
import { Modal } from '@/shared/components/Modal';
import { TIPO_DIA_OPTIONS, TIPOS_DIA_SIN_HORARIO } from '../constants';

// 'licencia' y 'vacacion' se marcan por rango — a diferencia de los demás
// tipos, que son un día puntual sin horario que registrar.
const TIPOS_RANGO: TipoDia[] = ['licencia', 'vacacion'];

export function CrearRegistroModal({ periodoId, onClose }: { periodoId: number; onClose: () => void }) {
  const crear = useCrearRegistro();
  const crearRango = useCrearRegistroRango();
  const { data: trabData } = useTrabajadoresNomina();
  const trabajadores: Trabajador[] = trabData?.data?.data ?? [];
  const hoy = new Date().toLocaleDateString('en-CA');
  const [form, setForm] = useState({
    trabajador_id: '',
    tipo_dia: 'ordinario' as TipoDia,
    fecha: '',
    fecha_hasta: '',
    hora_entrada: '',
    hora_salida: '',
    novedad: '',
  });

  const esRango = TIPOS_RANGO.includes(form.tipo_dia);
  const esAusencia = form.tipo_dia === 'ausencia';
  const sinHorario = esAusencia || TIPOS_DIA_SIN_HORARIO.includes(form.tipo_dia);
  const pendiente = crear.isPending || crearRango.isPending;

  function onChangeTipoDia(tipo_dia: TipoDia) {
    setForm(f => ({ ...f, tipo_dia, fecha: '', fecha_hasta: '', hora_entrada: '', hora_salida: '' }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sinHorario && form.hora_salida && form.hora_salida <= form.hora_entrada) {
      toast.error('La hora de salida debe ser posterior a la de entrada');
      return;
    }
    if (esRango) {
      if (form.fecha_hasta < form.fecha) {
        toast.error('"Hasta" no puede ser anterior a "Desde"');
        return;
      }
      await crearRango.mutateAsync({
        periodo_id: periodoId,
        trabajador_id: Number(form.trabajador_id),
        fecha_desde: form.fecha,
        fecha_hasta: form.fecha_hasta,
        tipo_dia: form.tipo_dia,
        novedad: form.novedad || undefined,
      });
    } else {
      await crear.mutateAsync({
        periodo_id: periodoId,
        trabajador_id: Number(form.trabajador_id),
        fecha: form.fecha,
        tipo_dia: form.tipo_dia,
        hora_entrada: sinHorario ? undefined : form.hora_entrada,
        hora_salida: sinHorario ? undefined : form.hora_salida || undefined,
        novedad: form.novedad || undefined,
      });
    }
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
          <label className="block text-sm font-medium text-foreground mb-1">Tipo día</label>
          <select
            value={form.tipo_dia}
            onChange={e => onChangeTipoDia(e.target.value as TipoDia)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
          >
            {TIPO_DIA_OPTIONS.map(o => (
              <option key={o} value={o} className="capitalize">{o.charAt(0).toUpperCase() + o.slice(1)}</option>
            ))}
          </select>
        </div>
        {esRango ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Desde *</label>
              <input
                type="date"
                required
                max={hoy}
                value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value, fecha_hasta: f.fecha_hasta < e.target.value ? e.target.value : f.fecha_hasta }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Hasta *</label>
              <input
                type="date"
                required
                min={form.fecha || undefined}
                max={hoy}
                value={form.fecha_hasta}
                onChange={e => setForm(f => ({ ...f, fecha_hasta: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
              />
            </div>
          </div>
        ) : (
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
        )}
        {sinHorario ? (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs ${esAusencia ? 'bg-danger-light text-danger' : 'bg-info-light text-info'}`}>
            <Info size={14} className="flex-shrink-0" />
            {esAusencia
              ? 'Se registrará como falta, sin horas trabajadas ni pago para este día.'
              : esRango
                ? 'Este tipo de día no requiere horario — se creará un registro igual para cada día del rango.'
                : 'Este tipo de día no requiere horario de entrada ni salida.'}
          </div>
        ) : (
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
        )}
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
          <button type="submit" disabled={pendiente} className="flex-1 bg-success hover:bg-success-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            {pendiente ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

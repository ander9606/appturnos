import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Download, Plus, Pencil } from 'lucide-react';
import {
  usePeriodos, useRegistros, useLiquidacion, useTrabajadoresNomina,
  useCorregirRegistro, useCrearRegistro,
} from '../hooks/useNomina';
import type { EstadoPeriodo, TipoDia, Registro, Trabajador, LiquidacionLinea } from '../types';

const ESTADO_BADGE: Record<EstadoPeriodo, string> = {
  abierto: 'bg-green-100 text-green-700',
  cerrado: 'bg-amber-100 text-amber-700',
  liquidado: 'bg-blue-100 text-blue-700',
};

const TIPO_DIA_OPTIONS: TipoDia[] = ['ordinario','descanso','compensatorio','incapacidad','vacacion','licencia'];

function fmtDate(s: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(s + 'T00:00:00'));
}

function fmtCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function fmtHrs(n: number) {
  return n.toFixed(1);
}

export function PeriodoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const periodoId = Number(id);
  const navigate = useNavigate();
  const [tab, setTab] = useState<'registros' | 'liquidacion'>('registros');
  const [filtroTrabajador, setFiltroTrabajador] = useState<number | undefined>(undefined);
  const [corrigiendoId, setCorrigiendoId] = useState<number | null>(null);
  const [showCrear, setShowCrear] = useState(false);

  const { data: periodosData } = usePeriodos();
  const periodo = (periodosData?.data ?? []).find((p: { id: number }) => p.id === periodoId);

  const { data: registrosData, isLoading: loadingReg } = useRegistros({ periodo_id: periodoId });
  const registros: Registro[] = registrosData?.data ?? [];

  const { data: liqData, isLoading: loadingLiq } = useLiquidacion(
    tab === 'liquidacion' && periodo?.estado !== 'abierto' ? periodoId : null
  );

  const registrosFiltrados = filtroTrabajador
    ? registros.filter(r => r.trabajador_id === filtroTrabajador)
    : registros;

  const trabajadoresEnPeriodo = Array.from(
    new Map(registros.map(r => [r.trabajador_id, r.trabajador])).entries()
  ).map(([tid, t]) => ({ id: tid, nombre: t?.nombre ?? '', apellido: t?.apellido ?? '' }));

  const handleExport = async () => {
    const res = await import('../api/nominaApi').then(m => m.nominaApi.exportarLiquidacion(periodoId));
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liquidacion-${periodoId}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const corrigiendo = corrigiendoId !== null ? registros.find(r => r.id === corrigiendoId) : null;

  return (
    <div>
      <button
        onClick={() => navigate('/nomina')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> Volver a Nómina
      </button>

      {periodo && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-0.5">Período</p>
            <p className="font-semibold text-gray-900">{fmtDate(periodo.fecha_inicio)} — {fmtDate(periodo.fecha_fin)}</p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[periodo.estado as EstadoPeriodo]}`}>
            {periodo.estado.charAt(0).toUpperCase() + periodo.estado.slice(1)}
          </span>
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['registros', 'liquidacion'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'registros' ? 'Registros' : 'Liquidación'}
          </button>
        ))}
      </div>

      {tab === 'registros' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <select
              value={filtroTrabajador ?? ''}
              onChange={e => setFiltroTrabajador(e.target.value ? Number(e.target.value) : undefined)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los trabajadores</option>
              {trabajadoresEnPeriodo.map(t => (
                <option key={t.id} value={t.id}>{t.nombre} {t.apellido}</option>
              ))}
            </select>
            <button
              onClick={() => setShowCrear(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={14} /> Agregar registro
            </button>
          </div>

          {loadingReg ? (
            <p className="text-gray-500 text-sm py-8 text-center">Cargando...</p>
          ) : registrosFiltrados.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">Sin registros</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <th className="text-left px-3 py-3 font-medium">Trabajador</th>
                    <th className="text-left px-3 py-3 font-medium">Fecha</th>
                    <th className="text-left px-3 py-3 font-medium">Entrada</th>
                    <th className="text-left px-3 py-3 font-medium">Salida</th>
                    <th className="text-right px-3 py-3 font-medium">Hrs Ord</th>
                    <th className="text-right px-3 py-3 font-medium">Hrs Extra</th>
                    <th className="text-left px-3 py-3 font-medium">Tipo día</th>
                    <th className="text-left px-3 py-3 font-medium">Novedad</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.map(r => (
                    <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-gray-900">
                        {r.trabajador ? `${r.trabajador.nombre} ${r.trabajador.apellido}` : r.trabajador_id}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{fmtDate(r.fecha)}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.hora_entrada ?? '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.hora_salida ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{fmtHrs(r.horas_ordinarias)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">
                        {fmtHrs(r.horas_extra_diurnas + r.horas_extra_nocturnas)}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 capitalize">{r.tipo_dia}</td>
                      <td className="px-3 py-2.5 text-gray-500 max-w-32 truncate">{r.novedad ?? ''}</td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => setCorrigiendoId(r.id)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'liquidacion' && (
        <div>
          {periodo?.estado === 'abierto' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm">
              El período debe estar cerrado para ver la liquidación.
            </div>
          ) : loadingLiq ? (
            <p className="text-gray-500 text-sm py-8 text-center">Cargando...</p>
          ) : liqData?.data ? (
            <div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Trabajadores</p>
                  <p className="text-2xl font-bold text-gray-900">{liqData.data.totales.trabajadores}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Total a pagar</p>
                  <p className="text-2xl font-bold text-gray-900">{fmtCOP(liqData.data.totales.total_general)}</p>
                </div>
              </div>

              <div className="flex justify-end mb-3">
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download size={14} /> Exportar XLSX
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <th className="text-left px-3 py-3 font-medium">Trabajador</th>
                      <th className="text-right px-3 py-3 font-medium">Días</th>
                      <th className="text-right px-3 py-3 font-medium">Hrs Ord</th>
                      <th className="text-right px-3 py-3 font-medium">H.Ext D</th>
                      <th className="text-right px-3 py-3 font-medium">H.Ext N</th>
                      <th className="text-right px-3 py-3 font-medium">Noct</th>
                      <th className="text-right px-3 py-3 font-medium">Fest</th>
                      <th className="text-right px-3 py-3 font-medium">Valor/h</th>
                      <th className="text-right px-3 py-3 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(liqData.data.lineas as LiquidacionLinea[]).map(l => (
                      <tr key={l.trabajador_id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-900">{l.nombre} {l.apellido}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{l.dias_registrados}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{fmtHrs(l.horas_ordinarias)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{fmtHrs(l.horas_extra_diurnas)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{fmtHrs(l.horas_extra_nocturnas)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{fmtHrs(l.horas_nocturnas)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{fmtHrs(l.horas_festivo)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{fmtCOP(l.valor_hora)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{fmtCOP(l.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {corrigiendo && (
        <CorregirModal
          registro={corrigiendo}
          onClose={() => setCorrigiendoId(null)}
        />
      )}

      {showCrear && (
        <CrearRegistroModal
          periodoId={periodoId}
          onClose={() => setShowCrear(false)}
        />
      )}
    </div>
  );
}

function CorregirModal({ registro, onClose }: { registro: Registro; onClose: () => void }) {
  const corregir = useCorregirRegistro();
  const [form, setForm] = useState({
    hora_entrada: registro.hora_entrada ?? '',
    hora_salida: registro.hora_salida ?? '',
    tipo_dia: registro.tipo_dia,
    novedad: registro.novedad ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Corregir registro</h2>
        <p className="text-sm text-gray-500 mb-4">{fmtDate(registro.fecha)}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora entrada</label>
              <input
                type="time"
                value={form.hora_entrada}
                onChange={e => setForm(f => ({ ...f, hora_entrada: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora salida</label>
              <input
                type="time"
                value={form.hora_salida}
                onChange={e => setForm(f => ({ ...f, hora_salida: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo día</label>
            <select
              value={form.tipo_dia}
              onChange={e => setForm(f => ({ ...f, tipo_dia: e.target.value as TipoDia }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TIPO_DIA_OPTIONS.map(o => (
                <option key={o} value={o} className="capitalize">{o.charAt(0).toUpperCase() + o.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Novedad</label>
            <input
              type="text"
              value={form.novedad}
              onChange={e => setForm(f => ({ ...f, novedad: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 hover:bg-gray-50 text-sm font-medium py-2 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={corregir.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {corregir.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CrearRegistroModal({ periodoId, onClose }: { periodoId: number; onClose: () => void }) {
  const crear = useCrearRegistro();
  const { data: trabData } = useTrabajadoresNomina();
  const trabajadores: Trabajador[] = trabData?.data ?? [];
  const [form, setForm] = useState({
    trabajador_id: '',
    fecha: '',
    hora_entrada: '',
    hora_salida: '',
    novedad: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Agregar registro</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trabajador</label>
            <select
              required
              value={form.trabajador_id}
              onChange={e => setForm(f => ({ ...f, trabajador_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar...</option>
              {trabajadores.map(t => (
                <option key={t.id} value={t.id}>{t.nombre} {t.apellido}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              required
              value={form.fecha}
              onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora entrada</label>
              <input
                type="time"
                required
                value={form.hora_entrada}
                onChange={e => setForm(f => ({ ...f, hora_entrada: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora salida</label>
              <input
                type="time"
                value={form.hora_salida}
                onChange={e => setForm(f => ({ ...f, hora_salida: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Novedad</label>
            <input
              type="text"
              value={form.novedad}
              onChange={e => setForm(f => ({ ...f, novedad: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 hover:bg-gray-50 text-sm font-medium py-2 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={crear.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {crear.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, UserX } from 'lucide-react';
import { useTrabajadores, useCrearTrabajador, useDesactivarTrabajador } from '../hooks/useEquipo';
import { useAuthStore } from '@/modules/auth/authStore';
import type { TipoTrabajador, Trabajador } from '../types';

const TIPO_BADGE: Record<TipoTrabajador, string> = {
  nomina: 'bg-purple-100 text-purple-700',
  turnos: 'bg-blue-100 text-blue-700',
  ambos: 'bg-green-100 text-green-700',
};

const TIPO_LABEL: Record<TipoTrabajador, string> = {
  nomina: 'Nómina',
  turnos: 'Turnos',
  ambos: 'Ambos',
};

function fmtCOP(n: number | null) {
  if (n === null) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

type EstadoFiltro = true | false | undefined;

export function EquipoPage() {
  const navigate = useNavigate();
  const { usuario } = useAuthStore();
  const isAdmin = usuario?.rol === 'admin_empresa';
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>(true);
  const [tipoFiltro, setTipoFiltro] = useState<TipoTrabajador | undefined>(undefined);
  const [showCrear, setShowCrear] = useState(false);

  const { data, isLoading } = useTrabajadores({ activo: estadoFiltro, tipo: tipoFiltro, limit: 200 });
  const trabajadores: Trabajador[] = data?.data ?? [];
  const desactivar = useDesactivarTrabajador();

  const estadoTabs: { label: string; value: EstadoFiltro }[] = [
    { label: 'Activos', value: true },
    { label: 'Inactivos', value: false },
    { label: 'Todos', value: undefined },
  ];

  const tipoTabs: { label: string; value: TipoTrabajador | undefined }[] = [
    { label: 'Todos', value: undefined },
    { label: 'Nómina', value: 'nomina' },
    { label: 'Turnos', value: 'turnos' },
    { label: 'Ambos', value: 'ambos' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
        {isAdmin && (
          <button
            onClick={() => setShowCrear(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Nuevo trabajador
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex gap-1 border-b border-gray-200">
          {estadoTabs.map(t => (
            <button
              key={String(t.value)}
              onClick={() => setEstadoFiltro(t.value)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                estadoFiltro === t.value
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          value={tipoFiltro ?? ''}
          onChange={e => setTipoFiltro((e.target.value as TipoTrabajador) || undefined)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {tipoTabs.map(t => (
            <option key={String(t.value)} value={t.value ?? ''}>{t.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Cargando...</p>
      ) : trabajadores.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">No hay trabajadores</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Cédula</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
                <th className="text-left px-4 py-3 font-medium">Cargo</th>
                <th className="text-right px-4 py-3 font-medium">Tarifa/hora</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {trabajadores.map(t => (
                <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.nombre} {t.apellido}</td>
                  <td className="px-4 py-3 text-gray-600">{t.cedula ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_BADGE[t.tipo]}`}>
                      {TIPO_LABEL[t.tipo]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.cargo ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmtCOP(t.tarifa_hora)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${t.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {isAdmin && Boolean(t.activo) && (
                        <button
                          onClick={() => {
                            if (window.confirm(`¿Desactivar a ${t.nombre} ${t.apellido}?`)) {
                              desactivar.mutate(t.id);
                            }
                          }}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Desactivar"
                        >
                          <UserX size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/equipo/${t.id}`)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        Ver →
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCrear && <TrabajadorFormModal onClose={() => setShowCrear(false)} />}
    </div>
  );
}

function TrabajadorFormModal({ onClose }: { onClose: () => void }) {
  const crear = useCrearTrabajador();
  const [form, setForm] = useState({
    nombre: '', apellido: '', tipo: 'nomina' as TipoTrabajador,
    email: '', cedula: '', telefono: '', cargo: '',
    tarifa_hora: '', salario_base: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await crear.mutateAsync({
      nombre: form.nombre,
      apellido: form.apellido,
      tipo: form.tipo,
      email: form.email || undefined,
      cedula: form.cedula || undefined,
      telefono: form.telefono || undefined,
      cargo: form.cargo || undefined,
      tarifa_hora: form.tarifa_hora ? Number(form.tarifa_hora) : undefined,
      salario_base: form.salario_base ? Number(form.salario_base) : undefined,
    });
    onClose();
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Nuevo trabajador</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input required type="text" {...field('nombre')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
              <input required type="text" {...field('apellido')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select {...field('tipo')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="nomina">Nómina</option>
              <option value="turnos">Turnos</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cédula</label>
              <input type="text" {...field('cedula')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input type="text" {...field('telefono')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" {...field('email')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
            <input type="text" {...field('cargo')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa/hora (COP)</label>
              <input type="number" min="0" step="any" {...field('tarifa_hora')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salario base (COP)</label>
              <input type="number" min="0" step="any" {...field('salario_base')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 hover:bg-gray-50 text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={crear.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {crear.isPending ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  useEmpresa, useUpdateEmpresa,
  usePuntos, useCreatePunto, useUpdatePunto, useDeletePunto,
  useCargos, useCreateCargo, useUpdateCargo, useDeleteCargo,
  useGestores, useCreateGestor, useToggleGestor,
} from '../hooks/useConfiguracion';
import type { PuntoMarcaje, Cargo, Gestor } from '../types';

type Tab = 'empresa' | 'puntos' | 'cargos' | 'gestores';

const ROLES_GESTOR = ['admin_empresa', 'jefe_turnos', 'jefe_nomina', 'nomina'];

export function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>('empresa');
  const tabs: { label: string; value: Tab }[] = [
    { label: 'Empresa', value: 'empresa' },
    { label: 'Puntos de marcaje', value: 'puntos' },
    { label: 'Cargos', value: 'cargos' },
    { label: 'Gestores', value: 'gestores' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Configuración</h1>
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.value ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'empresa' && <EmpresaTab />}
      {tab === 'puntos' && <PuntosTab />}
      {tab === 'cargos' && <CargosTab />}
      {tab === 'gestores' && <GestoresTab />}
    </div>
  );
}

/* ── Empresa ── */
function EmpresaTab() {
  const { data, isLoading } = useEmpresa();
  const update = useUpdateEmpresa();
  const empresa = data?.data;
  const [form, setForm] = useState<Record<string, string> | null>(null);

  if (isLoading) return <p className="text-gray-500 text-sm py-8 text-center">Cargando...</p>;
  if (!empresa) return null;

  const editing = form !== null;
  const val = editing ? form : {
    nombre: empresa.nombre ?? '',
    nit: empresa.nit ?? '',
    direccion: empresa.direccion ?? '',
    telefono: empresa.telefono ?? '',
    email: empresa.email ?? '',
  };

  const handleSave = async () => {
    if (!form) return;
    await update.mutateAsync(form);
    setForm(null);
  };

  const field = (k: string) => ({
    value: val[k] ?? '',
    disabled: !editing,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f!, [k]: e.target.value })),
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Datos de la empresa</h2>
        {!editing
          ? <button onClick={() => setForm({ ...val })} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"><Pencil size={14} /> Editar</button>
          : <div className="flex gap-2">
              <button onClick={() => setForm(null)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 border border-gray-200 rounded-lg">Cancelar</button>
              <button onClick={handleSave} disabled={update.isPending} className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg">
                {update.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
        }
      </div>
      <div className="flex flex-col gap-4">
        {(['nombre', 'nit', 'direccion', 'telefono', 'email'] as const).map(k => (
          <div key={k}>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{k}</label>
            <input
              type={k === 'email' ? 'email' : 'text'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
              {...field(k)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Puntos de marcaje ── */
type PuntoForm = { nombre: string; latitud: string; longitud: string; radio_metros: string };
const emptyPunto: PuntoForm = { nombre: '', latitud: '', longitud: '', radio_metros: '100' };

function PuntosTab() {
  const { data, isLoading } = usePuntos();
  const puntos: PuntoMarcaje[] = data?.data ?? [];
  const create = useCreatePunto();
  const update = useUpdatePunto();
  const del = useDeletePunto();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PuntoMarcaje | null>(null);
  const [form, setForm] = useState<PuntoForm>(emptyPunto);

  const openCreate = () => { setEditing(null); setForm(emptyPunto); setShowForm(true); };
  const openEdit = (p: PuntoMarcaje) => {
    setEditing(p);
    setForm({ nombre: p.nombre, latitud: String(p.latitud), longitud: String(p.longitud), radio_metros: String(p.radio_metros) });
    setShowForm(true);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { nombre: form.nombre, latitud: Number(form.latitud), longitud: Number(form.longitud), radio_metros: Number(form.radio_metros) };
    if (editing) await update.mutateAsync({ id: editing.id, ...payload });
    else await create.mutateAsync(payload);
    setShowForm(false);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Nuevo punto
        </button>
      </div>
      {isLoading ? <p className="text-gray-500 text-sm py-8 text-center">Cargando...</p> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-right px-4 py-3 font-medium">Latitud</th>
                <th className="text-right px-4 py-3 font-medium">Longitud</th>
                <th className="text-right px-4 py-3 font-medium">Radio (m)</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {puntos.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">Sin puntos de marcaje</td></tr>
              )}
              {puntos.map(p => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{p.nombre}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.latitud}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.longitud}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.radio_metros}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => { if (window.confirm('¿Eliminar punto?')) del.mutate(p.id); }} className="text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && (
        <Modal title={editing ? 'Editar punto' : 'Nuevo punto'} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input required type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitud *</label>
                <input required type="number" step="any" value={form.latitud} onChange={e => setForm(f => ({ ...f, latitud: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitud *</label>
                <input required type="number" step="any" value={form.longitud} onChange={e => setForm(f => ({ ...f, longitud: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Radio (metros) *</label>
              <input required type="number" min="10" max="5000" value={form.radio_metros} onChange={e => setForm(f => ({ ...f, radio_metros: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 hover:bg-gray-50 text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
              <button type="submit" disabled={create.isPending || update.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ── Cargos ── */
function CargosTab() {
  const { data, isLoading } = useCargos();
  const cargos: Cargo[] = data?.data ?? [];
  const create = useCreateCargo();
  const update = useUpdateCargo();
  const del = useDeleteCargo();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cargo | null>(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '' });

  const openCreate = () => { setEditing(null); setForm({ nombre: '', descripcion: '' }); setShowForm(true); };
  const openEdit = (c: Cargo) => { setEditing(c); setForm({ nombre: c.nombre, descripcion: c.descripcion ?? '' }); setShowForm(true); };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { nombre: form.nombre, descripcion: form.descripcion || undefined };
    if (editing) await update.mutateAsync({ id: editing.id, ...payload });
    else await create.mutateAsync(payload);
    setShowForm(false);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Nuevo cargo
        </button>
      </div>
      {isLoading ? <p className="text-gray-500 text-sm py-8 text-center">Cargando...</p> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Descripción</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cargos.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-sm">Sin cargos</td></tr>
              )}
              {cargos.map(c => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.nombre}</td>
                  <td className="px-4 py-3 text-gray-500">{c.descripcion ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => { if (window.confirm(`¿Eliminar cargo "${c.nombre}"?`)) del.mutate(c.id); }} className="text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && (
        <Modal title={editing ? 'Editar cargo' : 'Nuevo cargo'} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input required type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <input type="text" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 hover:bg-gray-50 text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
              <button type="submit" disabled={create.isPending || update.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ── Gestores ── */
function GestoresTab() {
  const { data, isLoading } = useGestores();
  const gestores: Gestor[] = data?.data ?? [];
  const create = useCreateGestor();
  const toggle = useToggleGestor();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', rol: 'jefe_turnos', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync(form);
    setShowForm(false);
    setForm({ nombre: '', apellido: '', email: '', rol: 'jefe_turnos', password: '' });
  };

  const ROL_LABEL: Record<string, string> = {
    admin_empresa: 'Admin', jefe_turnos: 'Jefe Turnos', jefe_nomina: 'Jefe Nómina', nomina: 'Nómina',
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Nuevo gestor
        </button>
      </div>
      {isLoading ? <p className="text-gray-500 text-sm py-8 text-center">Cargando...</p> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Rol</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {gestores.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">Sin gestores</td></tr>
              )}
              {gestores.map(g => (
                <tr key={g.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{g.nombre} {g.apellido}</td>
                  <td className="px-4 py-3 text-gray-500">{g.email}</td>
                  <td className="px-4 py-3 text-gray-600">{ROL_LABEL[g.rol] ?? g.rol}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${g.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {g.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle.mutate({ id: g.id, activo: !g.activo })}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title={g.activo ? 'Desactivar' : 'Activar'}
                    >
                      {g.activo ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && (
        <Modal title="Nuevo gestor" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input required type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
                <input required type="text" value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
              <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ROLES_GESTOR.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña temporal *</label>
              <input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 hover:bg-gray-50 text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
              <button type="submit" disabled={create.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                {create.isPending ? 'Creando...' : 'Crear gestor'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ── Shared modal ── */
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

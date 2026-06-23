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
      <h1 className="text-2xl font-bold text-foreground mb-6">Configuración</h1>
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
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
const EMPRESA_FIELDS: { key: string; label: string; type?: string; full?: boolean; textarea?: boolean }[] = [
  { key: 'nombre',         label: 'Nombre de la empresa *' },
  { key: 'nit',            label: 'NIT' },
  { key: 'ciudad',         label: 'Ciudad' },
  { key: 'actividad',      label: 'Actividad económica' },
  { key: 'descripcion',    label: 'Descripción', textarea: true, full: true },
  { key: 'telefono',       label: 'Teléfono' },
  { key: 'email_empresa',  label: 'Email de la empresa', type: 'email' },
  { key: 'direccion',      label: 'Dirección', full: true },
  { key: 'logo_url',       label: 'URL del logo', type: 'url', full: true },
];

function EmpresaTab() {
  const { data, isLoading } = useEmpresa();
  const update = useUpdateEmpresa();
  const empresa = data?.data;
  const [form, setForm] = useState<Record<string, string> | null>(null);

  if (isLoading) return <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>;
  if (!empresa) return null;

  const editing = form !== null;
  const base: Record<string, string> = {};
  for (const { key } of EMPRESA_FIELDS) base[key] = ((empresa as unknown as Record<string, unknown>)[key] as string) ?? '';
  const val = editing ? form : base;

  const handleSave = async () => {
    if (!form) return;
    await update.mutateAsync(form);
    setForm(null);
  };

  const INPUT_CLS = 'w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted disabled:text-muted-foreground';

  return (
    <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-foreground">Datos de la empresa</h2>
        {!editing
          ? <button onClick={() => setForm({ ...val })} className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-600"><Pencil size={14} /> Editar</button>
          : <div className="flex gap-2">
              <button onClick={() => setForm(null)} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1 border border-border rounded-lg">Cancelar</button>
              <button onClick={handleSave} disabled={update.isPending} className="text-sm bg-primary hover:bg-primary-600 disabled:opacity-50 text-white px-3 py-1 rounded-lg">
                {update.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
        }
      </div>
      <div className="grid grid-cols-2 gap-4">
        {EMPRESA_FIELDS.map(({ key, label, type = 'text', full, textarea }) => (
          <div key={key} className={full ? 'col-span-2' : ''}>
            <label className="block text-xs font-medium text-muted-foreground uppercase mb-1">{label}</label>
            {textarea
              ? <textarea
                  rows={3}
                  disabled={!editing}
                  value={val[key] ?? ''}
                  onChange={e => setForm(f => ({ ...f!, [key]: e.target.value }))}
                  className={INPUT_CLS + ' resize-none'}
                />
              : <input
                  type={type}
                  disabled={!editing}
                  value={val[key] ?? ''}
                  onChange={e => setForm(f => ({ ...f!, [key]: e.target.value }))}
                  className={INPUT_CLS}
                />
            }
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
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-primary hover:bg-primary-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Nuevo punto
        </button>
      </div>
      {isLoading ? <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p> : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground text-xs uppercase">
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
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground/60 text-sm">Sin puntos de marcaje</td></tr>
              )}
              {puntos.map(p => (
                <tr key={p.id} className="border-t border-border/60 hover:bg-muted">
                  <td className="px-4 py-3 text-foreground">{p.nombre}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{p.latitud}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{p.longitud}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{p.radio_metros}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.activo ? 'bg-success-light text-success' : 'bg-muted text-muted-foreground'}`}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(p)} className="text-muted-foreground/60 hover:text-primary transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => { if (window.confirm('¿Eliminar punto?')) del.mutate(p.id); }} className="text-muted-foreground/60 hover:text-danger transition-colors"><Trash2 size={14} /></button>
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
              <label className="block text-sm font-medium text-foreground mb-1">Nombre *</label>
              <input required type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Latitud *</label>
                <input required type="number" step="any" value={form.latitud} onChange={e => setForm(f => ({ ...f, latitud: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Longitud *</label>
                <input required type="number" step="any" value={form.longitud} onChange={e => setForm(f => ({ ...f, longitud: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Radio (metros) *</label>
              <input required type="number" min="10" max="5000" value={form.radio_metros} onChange={e => setForm(f => ({ ...f, radio_metros: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
              <button type="submit" disabled={create.isPending || update.isPending} className="flex-1 bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">Guardar</button>
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
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-primary hover:bg-primary-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Nuevo cargo
        </button>
      </div>
      {isLoading ? <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p> : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Descripción</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cargos.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground/60 text-sm">Sin cargos</td></tr>
              )}
              {cargos.map(c => (
                <tr key={c.id} className="border-t border-border/60 hover:bg-muted">
                  <td className="px-4 py-3 font-medium text-foreground">{c.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.descripcion ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.activo ? 'bg-success-light text-success' : 'bg-muted text-muted-foreground'}`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(c)} className="text-muted-foreground/60 hover:text-primary transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => { if (window.confirm(`¿Eliminar cargo "${c.nombre}"?`)) del.mutate(c.id); }} className="text-muted-foreground/60 hover:text-danger transition-colors"><Trash2 size={14} /></button>
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
              <label className="block text-sm font-medium text-foreground mb-1">Nombre *</label>
              <input required type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Descripción</label>
              <input type="text" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
              <button type="submit" disabled={create.isPending || update.isPending} className="flex-1 bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">Guardar</button>
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
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-primary hover:bg-primary-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Nuevo gestor
        </button>
      </div>
      {isLoading ? <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p> : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Rol</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {gestores.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground/60 text-sm">Sin gestores</td></tr>
              )}
              {gestores.map(g => (
                <tr key={g.id} className="border-t border-border/60 hover:bg-muted">
                  <td className="px-4 py-3 text-foreground">{g.nombre} {g.apellido}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ROL_LABEL[g.rol] ?? g.rol}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${g.activo ? 'bg-success-light text-success' : 'bg-muted text-muted-foreground'}`}>
                      {g.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle.mutate({ id: g.id, activo: !g.activo })}
                      className="text-muted-foreground/60 hover:text-primary transition-colors"
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
                <label className="block text-sm font-medium text-foreground mb-1">Nombre *</label>
                <input required type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Apellido *</label>
                <input required type="text" value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email *</label>
              <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Rol *</label>
              <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                {ROLES_GESTOR.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Contraseña temporal *</label>
              <input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
              <button type="submit" disabled={create.isPending} className="flex-1 bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
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
      <div className="bg-card rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

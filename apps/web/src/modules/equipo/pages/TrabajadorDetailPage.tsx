import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useTrabajador, useActualizarTrabajador } from '../hooks/useEquipo';
import { useAuthStore } from '@/modules/auth/authStore';
import type { TipoTrabajador, TipoDocumento, Sexo, TipoCuenta, Trabajador } from '../types';

const TIPO_BADGE: Record<TipoTrabajador, string> = {
  nomina: 'bg-purple-100 text-purple-700',
  turnos: 'bg-blue-100 text-blue-700',
  ambos: 'bg-green-100 text-green-700',
};

function getInitials(nombre: string, apellido: string) {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

type FormState = {
  nombre: string; apellido: string; cedula: string; tipo_documento: TipoDocumento;
  email: string; telefono: string; sexo: Sexo | ''; fecha_nacimiento: string;
  tipo: TipoTrabajador; cargo: string; tarifa_hora: string; salario_base: string;
  eps: string; afp: string; banco: string; tipo_cuenta: TipoCuenta | ''; numero_cuenta: string;
};

function fromTrabajador(t: Trabajador): FormState {
  return {
    nombre: t.nombre,
    apellido: t.apellido,
    cedula: t.cedula ?? '',
    tipo_documento: t.tipo_documento,
    email: t.email ?? '',
    telefono: t.telefono ?? '',
    sexo: t.sexo ?? '',
    fecha_nacimiento: t.fecha_nacimiento?.slice(0, 10) ?? '',
    tipo: t.tipo,
    cargo: t.cargo ?? '',
    tarifa_hora: t.tarifa_hora != null ? String(t.tarifa_hora) : '',
    salario_base: t.salario_base != null ? String(t.salario_base) : '',
    eps: t.eps ?? '',
    afp: t.afp ?? '',
    banco: t.banco ?? '',
    tipo_cuenta: t.tipo_cuenta ?? '',
    numero_cuenta: t.numero_cuenta ?? '',
  };
}

export function TrabajadorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const trabajadorId = Number(id);
  const navigate = useNavigate();
  const { usuario } = useAuthStore();
  const isAdmin = usuario?.rol === 'admin_empresa';

  const { data, isLoading } = useTrabajador(trabajadorId);
  const trabajador: Trabajador | null = data?.data ?? null;
  const actualizar = useActualizarTrabajador();

  const [form, setForm] = useState<FormState>({
    nombre: '', apellido: '', cedula: '', tipo_documento: 'CC',
    email: '', telefono: '', sexo: '', fecha_nacimiento: '',
    tipo: 'nomina', cargo: '', tarifa_hora: '', salario_base: '',
    eps: '', afp: '', banco: '', tipo_cuenta: '', numero_cuenta: '',
  });

  useEffect(() => {
    if (trabajador) setForm(fromTrabajador(trabajador));
  }, [trabajador]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await actualizar.mutateAsync({
      id: trabajadorId,
      nombre: form.nombre,
      apellido: form.apellido,
      cedula: form.cedula || undefined,
      tipo_documento: form.tipo_documento,
      email: form.email || undefined,
      telefono: form.telefono || undefined,
      sexo: form.sexo || undefined,
      fecha_nacimiento: form.fecha_nacimiento || undefined,
      tipo: form.tipo,
      cargo: form.cargo || undefined,
      tarifa_hora: form.tarifa_hora ? Number(form.tarifa_hora) : undefined,
      salario_base: form.salario_base ? Number(form.salario_base) : undefined,
      eps: form.eps || undefined,
      afp: form.afp || undefined,
      banco: form.banco || undefined,
      tipo_cuenta: form.tipo_cuenta || undefined,
      numero_cuenta: form.numero_cuenta || undefined,
    });
  };

  const inp = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
    disabled: !isAdmin,
    className:
      'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500',
  });

  if (isLoading) return <p className="text-gray-500 text-sm py-8 text-center">Cargando...</p>;
  if (!trabajador) return <p className="text-gray-500 text-sm py-8 text-center">Trabajador no encontrado</p>;

  return (
    <div>
      <button
        onClick={() => navigate('/equipo')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> Volver a Equipo
      </button>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg flex-shrink-0">
          {getInitials(trabajador.nombre, trabajador.apellido)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-lg">{trabajador.nombre} {trabajador.apellido}</p>
          <p className="text-sm text-gray-500">{trabajador.cargo ?? 'Sin cargo'}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_BADGE[trabajador.tipo]}`}>
            {trabajador.tipo.charAt(0).toUpperCase() + trabajador.tipo.slice(1)}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${trabajador.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {trabajador.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Datos personales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input type="text" required {...inp('nombre')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
              <input type="text" required {...inp('apellido')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo documento</label>
              <select {...inp('tipo_documento')}>
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="PAS">PAS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cédula</label>
              <input type="text" {...inp('cedula')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" {...inp('email')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input type="text" {...inp('telefono')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
              <select {...inp('sexo')}>
                <option value="">—</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha nacimiento</label>
              <input type="date" {...inp('fecha_nacimiento')} />
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Datos laborales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select {...inp('tipo')}>
                <option value="nomina">Nómina</option>
                <option value="turnos">Turnos</option>
                <option value="ambos">Ambos</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
              <input type="text" {...inp('cargo')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa/hora (COP)</label>
              <input type="number" min="0" step="any" {...inp('tarifa_hora')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salario base (COP)</label>
              <input type="number" min="0" step="any" {...inp('salario_base')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">EPS</label>
              <input type="text" {...inp('eps')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AFP</label>
              <input type="text" {...inp('afp')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
              <input type="text" {...inp('banco')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo cuenta</label>
              <select {...inp('tipo_cuenta')}>
                <option value="">—</option>
                <option value="ahorros">Ahorros</option>
                <option value="corriente">Corriente</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Número cuenta</label>
              <input type="text" {...inp('numero_cuenta')} />
            </div>
          </div>
        </section>

        {isAdmin && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={actualizar.isPending}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {actualizar.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

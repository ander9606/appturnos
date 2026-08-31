import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useTrabajador, useActualizarTrabajador, useInvitarTrabajador } from '../hooks/useEquipo';
import { useAuthStore } from '@/modules/auth/authStore';
import { DeduccionesChecklist } from '@/shared/components/DeduccionesChecklist';
import { ErrorState } from '@/shared/components/ErrorState';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { useConfirm } from '@/shared/hooks/useConfirm';
import type { TipoTrabajador, TipoDocumento, Sexo, TipoCuenta, Trabajador } from '../types';

/** Mismo código de colores que el resto de la app: Turnos = naranja, Nómina = verde, Ambos = azul. */
const TIPO_BADGE: Record<TipoTrabajador, string> = {
  turnos: 'bg-primary-100 text-primary-600',
  nomina: 'bg-success-light text-success',
  ambos: 'bg-info-light text-info',
};

function getInitials(nombre: string, apellido: string) {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

type FormState = {
  nombre: string; apellido: string; cedula: string; tipo_documento: TipoDocumento;
  email: string; telefono: string; sexo: Sexo | ''; fecha_nacimiento: string;
  tipo: TipoTrabajador; cargo: string; tarifa_hora: string; salario_base: string;
  hora_entrada_esperada: string;
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
    hora_entrada_esperada: t.hora_entrada_esperada?.slice(0, 5) ?? '',
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

  const { data, isLoading, isError, error, refetch } = useTrabajador(trabajadorId);
  const trabajador: Trabajador | null = data?.data ?? null;
  const actualizar = useActualizarTrabajador();
  const invitar = useInvitarTrabajador();
  const { confirmState, confirm, close } = useConfirm();

  const [form, setForm] = useState<FormState>({
    nombre: '', apellido: '', cedula: '', tipo_documento: 'CC',
    email: '', telefono: '', sexo: '', fecha_nacimiento: '',
    tipo: 'nomina', cargo: '', tarifa_hora: '', salario_base: '', hora_entrada_esperada: '',
    eps: '', afp: '', banco: '', tipo_cuenta: '', numero_cuenta: '',
  });

  useEffect(() => {
    if (trabajador) setForm(fromTrabajador(trabajador));
  }, [trabajador]);

  // Guarda la ficha con el `tipo` indicado (no siempre form.tipo — ver
  // handleSubmit: el paso a nómina no se guarda acá, se envía como invitación).
  const guardar = async (tipo: TipoTrabajador) => {
    try {
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
        tipo,
        cargo: form.cargo || undefined,
        tarifa_hora: form.tarifa_hora ? Number(form.tarifa_hora) : undefined,
        salario_base: form.salario_base ? Number(form.salario_base) : undefined,
        hora_entrada_esperada: tipo !== 'turnos' ? (form.hora_entrada_esperada || undefined) : undefined,
        eps: form.eps || undefined,
        afp: form.afp || undefined,
        banco: form.banco || undefined,
        tipo_cuenta: form.tipo_cuenta || undefined,
        numero_cuenta: form.numero_cuenta || undefined,
      });
    } catch {
      // El backend rechaza cualquier otro intento de tocar tipo/rol por acá
      // (ver toast de error) pero el resto de los campos del mismo submit sí
      // se guardaron antes del rechazo — hay que refetch, no reusar el
      // `trabajador` en caché (quedaría desactualizado), para reflejar el
      // <select> de tipo revertido junto con esos otros cambios reales.
      const fresh = await refetch();
      if (fresh.data?.data) setForm(fromTrabajador(fresh.data.data));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // turnos/ambos → nómina no se guarda directo: nómina ata la cuenta a esta
    // empresa en exclusiva, así que el trabajador debe aceptar o rechazar
    // (igual que "Invitar por cédula"). Enviamos la invitación con la cédula
    // que ya está en la ficha, sin mandar al gestor a otra pantalla.
    if (trabajador && trabajador.tipo !== 'nomina' && form.tipo === 'nomina') {
      if (!form.cedula) {
        toast.error('Este trabajador no tiene cédula registrada. Agrégala y guarda antes de invitarlo a nómina.');
        setForm(f => ({ ...f, tipo: trabajador.tipo }));
        return;
      }
      confirm({
        title: 'Enviar solicitud de nómina',
        detail:
          `Nómina implica exclusividad: si ${form.nombre || 'el trabajador'} acepta, dejará de estar disponible ` +
          'para turnos en otras empresas (sus demás vínculos se archivan automáticamente). No se convierte de ' +
          'inmediato — se le envía la solicitud y debe aceptarla o rechazarla desde su cuenta.',
        confirmLabel: 'Enviar solicitud',
        onConfirm: async () => {
          close();
          try {
            await invitar.mutateAsync({ cedula: form.cedula, tipo: 'nomina' });
          } catch {
            // El toast de error ya lo muestra `useInvitarTrabajador`; seguimos
            // igual al guardado de abajo para no perder el resto de campos.
          }
          // El resto de campos editados en el mismo submit sí se guardan;
          // tipo se manda sin cambios porque la conversión la resuelve la
          // invitación cuando el trabajador la acepte, no este formulario.
          await guardar(trabajador.tipo);
        },
      });
      return;
    }

    await guardar(form.tipo);
  };

  const inp = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
    disabled: !isAdmin,
    className:
      'w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted disabled:text-muted-foreground',
  });

  if (isLoading) return <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!trabajador) return <p className="text-muted-foreground text-sm py-8 text-center">Trabajador no encontrado</p>;

  return (
    <div>
      <button
        onClick={() => navigate('/equipo')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> Volver a Equipo
      </button>

      <div className="bg-card border border-border rounded-2xl p-5 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-lg flex-shrink-0">
          {getInitials(trabajador.nombre, trabajador.apellido)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-lg">{trabajador.nombre} {trabajador.apellido}</p>
          <p className="text-sm text-muted-foreground">{trabajador.cargo ?? 'Sin cargo'}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_BADGE[trabajador.tipo]}`}>
            {trabajador.tipo.charAt(0).toUpperCase() + trabajador.tipo.slice(1)}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${trabajador.activo ? 'bg-success-light text-success' : 'bg-muted text-muted-foreground'}`}>
            {trabajador.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <section className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Datos personales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nombre</label>
              <input type="text" required {...inp('nombre')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Apellido</label>
              <input type="text" required {...inp('apellido')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Tipo documento</label>
              <select {...inp('tipo_documento')}>
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="PAS">PAS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Cédula</label>
              <input type="text" {...inp('cedula')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <input type="email" {...inp('email')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Teléfono</label>
              <input type="text" {...inp('telefono')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Sexo</label>
              <select {...inp('sexo')}>
                <option value="">—</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Fecha nacimiento</label>
              <input type="date" {...inp('fecha_nacimiento')} />
            </div>
          </div>
        </section>

        <section className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Datos laborales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Tipo</label>
              <select {...inp('tipo')}>
                <option value="nomina">Nómina</option>
                <option value="turnos">Turnos</option>
                <option value="ambos">Ambos</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Cargo</label>
              <input type="text" {...inp('cargo')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Tarifa/hora (COP)</label>
              <input type="number" min="0" step="any" {...inp('tarifa_hora')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Salario base (COP)</label>
              <input type="number" min="0" step="any" {...inp('salario_base')} />
            </div>
            {form.tipo !== 'turnos' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Hora habitual de entrada</label>
                <input type="time" {...inp('hora_entrada_esperada')} />
                <p className="text-xs text-muted-foreground mt-1">Le avisamos 15 min antes para que no se le olvide marcar ingreso.</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">EPS</label>
              <input type="text" {...inp('eps')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">AFP</label>
              <input type="text" {...inp('afp')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Banco</label>
              <input type="text" {...inp('banco')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Tipo cuenta</label>
              <select {...inp('tipo_cuenta')}>
                <option value="">—</option>
                <option value="ahorros">Ahorros</option>
                <option value="corriente">Corriente</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">Número cuenta</label>
              <input type="text" {...inp('numero_cuenta')} />
            </div>
          </div>

          <div className="mt-4">
            <DeduccionesChecklist tarifaHora={form.tarifa_hora} salarioBase={form.salario_base} />
          </div>
        </section>

        {isAdmin && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={actualizar.isPending}
              className="bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {actualizar.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </form>

      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          detail={confirmState.detail}
          confirmLabel={confirmState.confirmLabel ?? 'Confirmar'}
          onConfirm={confirmState.onConfirm}
          onCancel={() => {
            close();
            // No se envió la invitación — el <select> vuelve a "Turnos"/"Ambos" en vez
            // de quedarse en "Nómina" mostrando un cambio que no se hizo.
            if (trabajador) setForm(f => ({ ...f, tipo: trabajador.tipo }));
          }}
          pending={invitar.isPending}
        />
      )}
    </div>
  );
}

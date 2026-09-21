import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { Phone } from './PhoneChrome';
import { isGestorRole, type Role, type Tab, type Detail, type ScreenInfo } from './types';
import {
  DashboardScreen, TurnosScreen, CrearTurnoScreen, MarcarIngresoScreen,
  OfertaDetalleScreen, NominaScreen, AcumuladoScreen, EquipoScreen,
} from './TrabajadorScreens';
import { GestorDashboardScreen, GestorTurnosScreen, NominaGestorScreen, MiembroDetalleScreen } from './GestorScreens';

const ROLES: { value: Role; label: string }[] = [
  { value: 'trabajador', label: 'Trabajador' },
  { value: 'jefe_turnos', label: 'Jefe de turnos' },
  { value: 'nomina', label: 'Nómina / Admin' },
];

export function RolePills({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <div role="radiogroup" aria-label="Tipo de usuario a simular" className="inline-flex flex-wrap justify-center gap-1.5 rounded-full border border-border bg-card p-1.5">
      {ROLES.map((r) => {
        const active = r.value === value;
        return (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(r.value)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              active ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Un solo iPhone, interactivo: la barra inferior cambia de pestaña y tocar
 * una tarjeta abre su detalle (con volver) — igual que en la app real, pero
 * 100% visual, sin llamadas a la API. `role` decide qué ve cada tipo de
 * usuario, tal como en la app real (ver Role Matrix en CLAUDE.md). Al lado
 * (o debajo, en móvil) siempre hay una descripción de qué se puede hacer en
 * la pantalla que está mostrando en ese momento.
 */
export function PhoneSimulator({ role }: { role: Role }) {
  const [tab, setTab] = useState<Tab>('inicio');
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    setTab('inicio');
    setDetail(null);
  }, [role]);

  const openDetail = (d: Detail) => setDetail(d);
  const closeDetail = () => setDetail(null);
  const goTab = (t: Tab) => {
    setDetail(null);
    setTab(t);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-center">
      <Phone>
        {detail ? (
          <DetailScreen detail={detail} onBack={closeDetail} />
        ) : (
          <TabScreen role={role} tab={tab} onTabSelect={goTab} onOpenDetail={openDetail} />
        )}
      </Phone>
      <ScreenInfoPanel info={getScreenInfo(role, tab, detail)} />
    </div>
  );
}

const SCREEN_INFO: Record<string, ScreenInfo> = {
  'inicio-trabajador': {
    tag: 'Inicio · Trabajador',
    title: 'Tu turno de un vistazo',
    body: 'Ves tu turno activo, tus próximos turnos y accesos directos a lo que más usás — sin buscar en menús.',
    bullets: ['Marcar ingreso o salida con un toque', 'Ver cuántos turnos llevas completados', 'Saltar directo a tu quincena'],
  },
  'inicio-jefe': {
    tag: 'Inicio · Jefe de turnos',
    title: 'El estado de tu operación, hoy',
    body: 'De un vistazo sabés cuántos turnos hay hoy y cuáles siguen sin cubrir, para reaccionar antes de que sea tarde.',
    bullets: ['Crear un turno nuevo en segundos', 'Ver qué turnos faltan por cubrir', 'Saltar al equipo completo'],
  },
  'inicio-nomina': {
    tag: 'Inicio · Nómina / Admin',
    title: 'Cuánto falta para liquidar',
    body: 'Ves los días que quedan del período y cuánto llevas acumulado en nómina, antes de entrar al detalle.',
    bullets: ['Saltar directo a liquidar el período', 'Ver el acumulado de cada empleado', 'Revisar el equipo completo'],
  },
  'turnos-trabajador': {
    tag: 'Turnos · Trabajador',
    title: 'Tus turnos y los disponibles',
    body: "Revisás los turnos que ya tenés asignados y, en la pestaña \"Disponibles\", te postulás a turnos de otras empresas que también usan zaturno.",
    bullets: ['Ver fecha, hora y lugar de cada turno', 'Tocar un turno para ver el pago exacto', 'Postularte a turnos abiertos'],
  },
  'turnos-gestor': {
    tag: 'Turnos · Gestor',
    title: 'Todos los turnos, con su cobertura',
    body: 'Cada turno muestra cuántas plazas tiene cubiertas, para saber de un vistazo dónde falta gente.',
    bullets: ['Crear un turno nuevo con el botón +', 'Ver cuántas plazas faltan por cubrir', 'Tocar un turno para editarlo'],
  },
  'nomina-trabajador': {
    tag: 'Nómina · Trabajador',
    title: 'Lo que llevas acumulado',
    body: 'Ves el total del período desglosado por tipo de hora — ordinarias, nocturnas, festivas — y el detalle día a día.',
    bullets: ['Ver el total acumulado del período', 'Tocar el resumen para ver el detalle', 'Revisar cada registro diario'],
  },
  'nomina-gestor': {
    tag: 'Nómina · Admin',
    title: 'Liquidación de todo el equipo',
    body: 'Ves cuánto se le debe a cada empleado antes de cerrar el período, con los recargos de ley ya calculados.',
    bullets: ['Liquidar el período con un toque', 'Ver el acumulado de cada empleado', 'Tocar a alguien para ver su detalle'],
  },
  'equipo-trabajador': {
    tag: 'Equipo · Trabajador',
    title: 'Quién más está en tu equipo',
    body: 'Una vista de solo lectura de tus compañeros — no accedés a su nómina ni a sus datos privados.',
    bullets: ['Ver quién está activo hoy', 'Buscar a un compañero', 'Sin acceso a la nómina ajena'],
  },
  'equipo-gestor': {
    tag: 'Equipo · Gestor',
    title: 'Tu equipo completo',
    body: 'Administrás quién está activo y accedés al perfil de cada trabajador con un toque.',
    bullets: ['Buscar a cualquier trabajador', 'Tocar un perfil para ver su detalle', 'Ver el rol y estado de cada uno'],
  },
  'turno-trabajador': {
    tag: 'Detalle de turno',
    title: 'Todo antes de aplicar',
    body: 'Fecha, lugar, plazas disponibles y el pago exacto — toda la info para decidir antes de postularte.',
    bullets: ['Ver el pago exacto del turno', 'Confirmar fecha, hora y lugar', 'Aplicar con un solo toque'],
  },
  'turno-gestor': {
    tag: 'Detalle de turno',
    title: 'Gestioná este turno',
    body: 'Ves cuántas plazas siguen libres y podés editar el turno sin salir de la pantalla.',
    bullets: ['Ver la cobertura de plazas', 'Editar fecha, hora o tarifa', 'Confirmar el lugar asignado'],
  },
  miembro: {
    tag: 'Perfil',
    title: 'Ficha del trabajador',
    body: 'Horas del mes, acumulado y acceso rápido a sus turnos asignados.',
    bullets: ['Ver horas y acumulado del mes', 'Revisar sus turnos asignados', 'Confirmar su rol y estado'],
  },
  crear: {
    tag: 'Nuevo turno',
    title: 'Publicar un turno toma segundos',
    body: 'Definís título, horario, lugar y plazas — el turno queda visible para tu equipo al instante.',
    bullets: ['Definir horario y lugar', 'Elegir cuántas plazas necesitás', 'Publicarlo para tu equipo'],
  },
  marcaje: {
    tag: 'Marcar ingreso',
    title: 'Geofencing en tiempo real',
    body: 'El trabajador solo puede fichar si está físicamente en el lugar de trabajo — validado por el servidor, no por el teléfono.',
    bullets: ['Verificar la distancia al punto de marcaje', 'Bloquear el fichaje fuera de rango', 'Registrar la hora exacta'],
  },
  acumulado: {
    tag: 'Resumen del período',
    title: 'Cuánto llevas y cuánto falta',
    body: 'Progreso del período en días y el desglose de horas ordinarias, extra y festivas.',
    bullets: ['Ver el acumulado en tiempo real', 'Revisar horas extra y festivas', 'Saber cuántos días faltan'],
  },
};

function getScreenInfo(role: Role, tab: Tab, detail: Detail | null): ScreenInfo {
  const isGestor = isGestorRole(role);
  const key = (() => {
    if (detail) {
      if (detail.kind === 'turno') return detail.cobertura ? 'turno-gestor' : 'turno-trabajador';
      return detail.kind;
    }
    if (tab === 'inicio') return isGestor ? (role === 'nomina' ? 'inicio-nomina' : 'inicio-jefe') : 'inicio-trabajador';
    if (tab === 'turnos') return isGestor ? 'turnos-gestor' : 'turnos-trabajador';
    if (tab === 'nomina') return role === 'nomina' ? 'nomina-gestor' : 'nomina-trabajador';
    return isGestor ? 'equipo-gestor' : 'equipo-trabajador';
  })();
  return SCREEN_INFO[key];
}

function ScreenInfoPanel({ info }: { info: ScreenInfo }) {
  return (
    <div className="w-full max-w-xs flex-shrink-0 rounded-2xl border border-border bg-card p-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{info.tag}</p>
      <h3 className="mt-2 text-lg font-extrabold text-foreground text-balance">{info.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{info.body}</p>
      <ul className="mt-5 flex flex-col gap-2.5">
        {info.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm font-medium text-foreground">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-primary" />
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabScreen({
  role,
  tab,
  onTabSelect,
  onOpenDetail,
}: {
  role: Role;
  tab: Tab;
  onTabSelect: (t: Tab) => void;
  onOpenDetail: (d: Detail) => void;
}) {
  const isGestor = isGestorRole(role);

  if (tab === 'inicio') {
    return isGestor ? (
      <GestorDashboardScreen role={role} onTabSelect={onTabSelect} onOpenDetail={onOpenDetail} />
    ) : (
      <DashboardScreen onTabSelect={onTabSelect} onOpenDetail={onOpenDetail} />
    );
  }
  if (tab === 'turnos') {
    return isGestor ? (
      <GestorTurnosScreen onTabSelect={onTabSelect} onOpenDetail={onOpenDetail} />
    ) : (
      <TurnosScreen onTabSelect={onTabSelect} onOpenDetail={onOpenDetail} />
    );
  }
  if (tab === 'nomina') {
    return role === 'nomina' ? (
      <NominaGestorScreen onTabSelect={onTabSelect} onOpenDetail={onOpenDetail} />
    ) : (
      <NominaScreen onTabSelect={onTabSelect} onOpenDetail={onOpenDetail} />
    );
  }
  return (
    <EquipoScreen
      onTabSelect={onTabSelect}
      onOpenDetail={isGestor ? onOpenDetail : undefined}
    />
  );
}

function DetailScreen({ detail, onBack }: { detail: Detail; onBack: () => void }) {
  switch (detail.kind) {
    case 'turno':
      return <OfertaDetalleScreen turno={detail} onBack={onBack} />;
    case 'miembro':
      return <MiembroDetalleScreen miembro={detail} onBack={onBack} />;
    case 'marcaje':
      return <MarcarIngresoScreen onBack={onBack} />;
    case 'acumulado':
      return <AcumuladoScreen onBack={onBack} />;
    case 'crear':
      return <CrearTurnoScreen onBack={onBack} />;
  }
}

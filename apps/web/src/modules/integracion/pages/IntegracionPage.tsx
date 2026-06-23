import { useState } from 'react';
import {
  Plug, CheckCircle, XCircle, AlertCircle, RefreshCw,
  Link2, Link2Off, ArrowRightLeft,
} from 'lucide-react';
import {
  useEstadoIntegracion, useConfigIntegracion,
  useUpdateConfigIntegracion, useEmparejar,
  useConciliacion, useVincular,
} from '../hooks/useIntegracion';
import type { TrabajadorPendiente, CandidatoLogiq360 } from '../types';

type Tab = 'estado' | 'configuracion' | 'conciliacion';

export function IntegracionPage() {
  const [tab, setTab] = useState<Tab>('estado');
  const { data: estadoData } = useEstadoIntegracion();
  const estado = estadoData?.data;
  const conectado = Boolean(estado?.activo && estado?.webhook_configurado);

  const tabs: { label: string; value: Tab }[] = [
    { label: 'Estado', value: 'estado' },
    { label: 'Configuración', value: 'configuracion' },
    { label: 'Conciliación de personal', value: 'conciliacion' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
          <Plug size={20} className="text-primary-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Integración logiq360</h1>
          <p className="text-sm text-muted-foreground">Sincronización de personal y órdenes de trabajo</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
          conectado ? 'bg-success-light text-success' : 'bg-muted text-muted-foreground'
        }`}>
          {conectado
            ? <><CheckCircle size={14} /> Conectado</>
            : <><XCircle size={14} /> Sin conexión</>
          }
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'estado' && <TabEstado conectado={conectado} onGoConfig={() => setTab('configuracion')} />}
      {tab === 'configuracion' && <TabConfiguracion />}
      {tab === 'conciliacion' && <TabConciliacion />}
    </div>
  );
}

/* ── Tab Estado ── */
function TabEstado({ conectado, onGoConfig }: { conectado: boolean; onGoConfig: () => void }) {
  const { data: estadoData, isLoading } = useEstadoIntegracion();
  const { data: cfgData } = useConfigIntegracion();
  const estado = estadoData?.data;
  const cfg = cfgData?.data;

  if (isLoading) return <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>;

  const salientes = estado?.eventos?.salientes ?? [];
  const entrantes = estado?.eventos?.entrantes ?? [];

  const count = (arr: { estado: string; total: number }[], key: string) =>
    arr.find(e => e.estado === key)?.total ?? 0;

  const salientesFallidos = count(salientes, 'fallido');
  const salientesPendientes = count(salientes, 'pendiente');
  const salientesEnviados = count(salientes, 'enviado');
  const entrantesError = count(entrantes, 'error');
  const entrantesProcesados = count(entrantes, 'procesado');

  if (!conectado) {
    return (
      <div className="max-w-lg">
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Link2Off size={28} className="text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">No conectado a logiq360</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Usa el código de emparejamiento generado en logiq360 para vincular esta empresa.
            Los secretos se configuran automáticamente.
          </p>
          <button
            onClick={onGoConfig}
            className="bg-primary hover:bg-primary-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
          >
            Conectar con logiq360
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-5">
      {/* Left: connection info */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground uppercase font-medium mb-3">Conexión</p>
          <div className="flex flex-col gap-2.5">
            <StatusRow label="Estado" ok={Boolean(cfg?.activo)} okLabel="Activo" koLabel="Inactivo" />
            <StatusRow label="Webhook URL" ok={Boolean(cfg?.webhook_url)} okLabel="Configurada" koLabel="Sin URL" />
            <StatusRow label="Webhook secret" ok={Boolean(cfg?.tiene_webhook_secret)} okLabel="Configurado" koLabel="Falta" />
            <StatusRow label="API Key (saliente)" ok={Boolean(cfg?.tiene_api_key)} okLabel="Configurada" koLabel="Falta" />
            <StatusRow label="API Key (entrante)" ok={Boolean(cfg?.tiene_incoming_secret)} okLabel="Configurada" koLabel="Falta" />
          </div>
          {cfg?.webhook_url && (
            <p className="text-xs text-muted-foreground mt-3 break-all">{cfg.webhook_url}</p>
          )}
        </div>
      </div>

      {/* Right: event stats */}
      <div className="flex-1 flex flex-col gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase font-medium mb-3">Eventos salientes (Zaturno → logiq360)</p>
          <div className="grid grid-cols-3 gap-3">
            <EventCard label="Enviados" value={salientesEnviados} color="success" icon={CheckCircle} />
            <EventCard label="Pendientes" value={salientesPendientes} color="warning" icon={RefreshCw} />
            <EventCard label="Fallidos" value={salientesFallidos} color={salientesFallidos > 0 ? 'danger' : 'muted'} icon={AlertCircle} />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase font-medium mb-3">Eventos entrantes (logiq360 → Zaturno)</p>
          <div className="grid grid-cols-2 gap-3">
            <EventCard label="Procesados" value={entrantesProcesados} color="success" icon={CheckCircle} />
            <EventCard label="Con error" value={entrantesError} color={entrantesError > 0 ? 'danger' : 'muted'} icon={AlertCircle} />
          </div>
        </div>
        {salientesFallidos > 0 && (
          <div className="bg-danger-light border border-danger/20 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-danger flex-shrink-0 mt-0.5" />
            <p className="text-sm text-danger">
              Hay {salientesFallidos} evento{salientesFallidos > 1 ? 's' : ''} fallido{salientesFallidos > 1 ? 's' : ''}.
              Verifica que logiq360 esté activo y la URL de webhook sea correcta.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusRow({ label, ok, okLabel, koLabel }: { label: string; ok: boolean; okLabel: string; koLabel: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`flex items-center gap-1 text-xs font-medium ${ok ? 'text-success' : 'text-danger'}`}>
        {ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
        {ok ? okLabel : koLabel}
      </span>
    </div>
  );
}

type EventColor = 'success' | 'warning' | 'danger' | 'muted';

function EventCard({ label, value, color, icon: Icon }: {
  label: string; value: number; color: EventColor;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  const colors: Record<EventColor, string> = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    muted: 'text-muted-foreground',
  };
  return (
    <div className="bg-card border border-border rounded-xl p-3.5">
      <Icon size={16} className={`${colors[color]} mb-2`} />
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/* ── Tab Configuración ── */
function TabConfiguracion() {
  const { data: cfgData, isLoading } = useConfigIntegracion();
  const cfg = cfgData?.data;
  const update = useUpdateConfigIntegracion();
  const emparejar = useEmparejar();

  const [webhookUrl, setWebhookUrl] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);
  const [codigo, setCodigo] = useState('');

  if (isLoading) return <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>;

  const activo = Boolean(cfg?.activo);

  return (
    <div className="max-w-lg flex flex-col gap-5">
      {/* Pairing */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
            <Link2 size={16} className="text-primary-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Emparejamiento</h2>
            <p className="text-xs text-muted-foreground">Conecta con logiq360 usando el código de un solo uso</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Pegar código de logiq360..."
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
            className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
          />
          <button
            onClick={() => { if (codigo.trim()) { emparejar.mutate(codigo.trim()); setCodigo(''); } }}
            disabled={!codigo.trim() || emparejar.isPending}
            className="bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            {emparejar.isPending ? 'Conectando...' : 'Conectar'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Los secretos se configuran automáticamente. No es necesario copiarlos manualmente.
        </p>
      </div>

      {/* Toggle activo */}
      {cfg?.configurado && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Estado de la integración</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activo ? 'Los eventos se sincronizan con logiq360' : 'La sincronización está pausada'}
              </p>
            </div>
            <button
              onClick={() => update.mutate({ activo: !activo })}
              disabled={update.isPending}
              className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
                activo ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                activo ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'
              }`} />
            </button>
          </div>
        </div>
      )}

      {/* Webhook URL */}
      {cfg?.configurado && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">URL de webhook (saliente)</h2>
          {editingUrl ? (
            <div className="flex gap-2">
              <input
                type="url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="https://logiq360.example.com/webhook"
              />
              <button
                onClick={async () => {
                  await update.mutateAsync({ webhook_url: webhookUrl });
                  setEditingUrl(false);
                }}
                disabled={update.isPending}
                className="bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
              >
                Guardar
              </button>
              <button
                onClick={() => setEditingUrl(false)}
                className="border border-border hover:bg-muted text-sm px-3 py-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground font-mono break-all flex-1">
                {cfg?.webhook_url ?? <span className="italic">Sin URL</span>}
              </p>
              <button
                onClick={() => { setWebhookUrl(cfg?.webhook_url ?? ''); setEditingUrl(true); }}
                className="text-xs text-primary hover:text-primary-600 font-medium flex-shrink-0 transition-colors"
              >
                Editar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Secrets status */}
      {cfg?.configurado && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Secretos</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Los secretos se configuran vía emparejamiento y nunca se muestran en claro.
          </p>
          <div className="flex flex-col gap-2">
            <StatusRow label="Webhook secret" ok={Boolean(cfg?.tiene_webhook_secret)} okLabel="Configurado" koLabel="Falta — re-empareja" />
            <StatusRow label="API Key saliente" ok={Boolean(cfg?.tiene_api_key)} okLabel="Configurada" koLabel="Falta — re-empareja" />
            <StatusRow label="API Key entrante" ok={Boolean(cfg?.tiene_incoming_secret)} okLabel="Configurada" koLabel="Falta — re-empareja" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tab Conciliación ── */
function TabConciliacion() {
  const { data, isLoading, refetch } = useConciliacion();
  const conciliacion = data?.data;
  const pendientes: TrabajadorPendiente[] = conciliacion?.pendientes ?? [];
  const candidatos: CandidatoLogiq360[] = conciliacion?.candidatos ?? [];
  const vincular = useVincular();
  const [seleccion, setSeleccion] = useState<Record<number, string>>({});

  const getEmpleadoId = (trabajadorId: number): number | null => {
    const val = seleccion[trabajadorId];
    if (val !== undefined) return val ? Number(val) : null;
    const t = pendientes.find(p => p.id === trabajadorId);
    return t?.sugerencia?.id ?? null;
  };

  if (isLoading) return <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>;

  if (pendientes.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-lg">
        <div className="w-12 h-12 rounded-xl bg-success-light flex items-center justify-center mx-auto mb-3">
          <CheckCircle size={24} className="text-success" />
        </div>
        <h2 className="text-base font-semibold text-foreground mb-1">Todo vinculado</h2>
        <p className="text-sm text-muted-foreground">No hay trabajadores pendientes de vincular con logiq360.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {pendientes.length} trabajador{pendientes.length !== 1 ? 'es' : ''} sin vincular
        </p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-muted-foreground text-xs uppercase">
              <th className="text-left px-4 py-3 font-medium">Trabajador</th>
              <th className="text-left px-4 py-3 font-medium">Cédula</th>
              <th className="text-left px-4 py-3 font-medium">Cargo</th>
              <th className="text-left px-4 py-3 font-medium">Empleado logiq360</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {pendientes.map(t => {
              const empleadoId = getEmpleadoId(t.id);
              const tieneSugerencia = Boolean(t.sugerencia);
              const seleccionManual = seleccion[t.id] !== undefined;

              return (
                <tr key={t.id} className="border-t border-border/60">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {t.nombre} {t.apellido}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.cedula ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.cargo ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={seleccion[t.id] ?? (t.sugerencia ? String(t.sugerencia.id) : '')}
                        onChange={e => setSeleccion(s => ({ ...s, [t.id]: e.target.value }))}
                        className="border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 max-w-52"
                      >
                        <option value="">Sin vincular</option>
                        {candidatos.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>
                        ))}
                      </select>
                      {tieneSugerencia && !seleccionManual && (
                        <span className="text-xs text-primary bg-primary-50 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                          sugerido
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {empleadoId && (
                      <button
                        onClick={() => vincular.mutate({ trabajador_id: t.id, empleado_id: empleadoId })}
                        disabled={vincular.isPending}
                        className="flex items-center gap-1.5 text-xs bg-primary hover:bg-primary-600 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <ArrowRightLeft size={12} />
                        Vincular
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import {
  usePeriodos, useRegistros, useLiquidacion, useDescuentosPeriodo, useCompensatorios,
} from '../hooks/useNomina';
import type { EstadoPeriodo, Registro, DescuentoNomina, DescansoCompensatorio } from '../types';
import { ErrorState } from '@/shared/components/ErrorState';
import { fmtPeriodo } from '@/shared/lib/format';
import { ESTADO_BADGE } from '../constants';
import { PendientesCompensatoriosBanner } from '../components/PendientesCompensatoriosBanner';
import { RegistrosTab } from '../components/RegistrosTab';
import { LiquidacionTab } from '../components/LiquidacionTab';
import { CorregirModal } from '../components/CorregirModal';
import { CrearRegistroModal } from '../components/CrearRegistroModal';
import { DescuentoModal } from '../components/DescuentoModal';
import { AsignarCompensatorioModal, ReasignarCompensatorioModal } from '../components/CompensatorioAsignarModals';

export function PeriodoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const periodoId = Number(id);
  const navigate = useNavigate();
  const [tab, setTab] = useState<'liquidacion' | 'registros'>('liquidacion');
  const [corrigiendoId, setCorrigiendoId] = useState<number | null>(null);
  const [showCrear, setShowCrear] = useState(false);
  const [descuentoTrabajador, setDescuentoTrabajador] = useState<{ id: number; nombre: string } | null>(null);
  const [reasignando, setReasignando] = useState<DescansoCompensatorio | null>(null);
  const [asignando, setAsignando] = useState<DescansoCompensatorio | null>(null);

  const { data: periodosData, isLoading: loadingPeriodos, isError: errorPeriodos, error: errPeriodos, refetch: refetchPeriodos } = usePeriodos();
  const periodo = (periodosData?.data?.data ?? []).find((p: { id: number }) => p.id === periodoId);

  const { data: descuentosData } = useDescuentosPeriodo(periodoId);
  const descuentos: DescuentoNomina[] = descuentosData?.data ?? [];

  const { data: registrosData, isLoading: loadingReg, error: errReg, refetch: refetchReg } = useRegistros({ periodo_id: periodoId });
  const registros: Registro[] = registrosData?.data?.data ?? [];

  const { data: compensatoriosData } = useCompensatorios();
  const compensatorios: DescansoCompensatorio[] = compensatoriosData?.data ?? [];
  const compensatorioPorDia = new Map<string, DescansoCompensatorio>();
  for (const c of compensatorios) {
    if (c.fecha_asignada) compensatorioPorDia.set(`${c.trabajador_id}|${c.fecha_asignada}`, c);
  }
  // Solo los de este período — un compensatorio pendiente de un período anterior
  // se asigna desde la página de ese período, no desde aquí.
  const pendientesEnPeriodo = compensatorios.filter(c => c.estado === 'pendiente' && c.periodo_id === periodoId);
  /** El registro del día 'compensatorio' no guarda el id del descanso — se cruza por trabajador_id + fecha, mismo criterio que usa el backend en compensatorios.service.js. */
  function compensatorioDe(r: Registro): DescansoCompensatorio | undefined {
    return r.tipo_dia === 'compensatorio' ? compensatorioPorDia.get(`${r.trabajador_id}|${r.fecha}`) : undefined;
  }

  const { data: liqData, isLoading: loadingLiq, error: errLiq, refetch: refetchLiq } = useLiquidacion(
    tab === 'liquidacion' ? periodoId : null
  );

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

  const volverBtn = (
    <button
      onClick={() => navigate('/nomina')}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
    >
      <ArrowLeft size={16} /> Volver a Nómina
    </button>
  );

  if (errorPeriodos) {
    return (
      <div>
        {volverBtn}
        <ErrorState error={errPeriodos} onRetry={refetchPeriodos} />
      </div>
    );
  }

  if (!loadingPeriodos && !periodo) {
    return (
      <div>
        {volverBtn}
        <p className="text-muted-foreground text-sm py-8 text-center">
          Este período no existe o fue eliminado.
        </p>
      </div>
    );
  }

  return (
    <div>
      {volverBtn}

      {periodo && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-0.5">Período</p>
            <p className="font-semibold text-foreground">{fmtPeriodo(periodo.fecha_inicio, periodo.fecha_fin)}</p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[periodo.estado as EstadoPeriodo]}`}>
            {periodo.estado.charAt(0).toUpperCase() + periodo.estado.slice(1)}
          </span>
        </div>
      )}

      <PendientesCompensatoriosBanner pendientes={pendientesEnPeriodo} onAsignar={setAsignando} />

      <div className="flex gap-1 mb-6 border-b border-border">
        {(['liquidacion', 'registros'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? 'border-success text-success' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'registros' ? 'Registros' : 'Liquidación'}
          </button>
        ))}
      </div>

      {tab === 'registros' && (
        <RegistrosTab
          registros={registros}
          loading={loadingReg}
          error={errReg}
          onRetry={refetchReg}
          compensatorioDe={compensatorioDe}
          onCorregir={setCorrigiendoId}
          onReasignar={setReasignando}
          onShowCrear={() => setShowCrear(true)}
        />
      )}

      {tab === 'liquidacion' && (
        <LiquidacionTab
          periodoEstado={periodo?.estado as EstadoPeriodo | undefined}
          liqData={liqData?.data}
          loading={loadingLiq}
          error={errLiq}
          onRetry={refetchLiq}
          registros={registros}
          descuentos={descuentos}
          compensatorioDe={compensatorioDe}
          onExport={handleExport}
          onCorregir={setCorrigiendoId}
          onReasignar={setReasignando}
          onAbrirDescuentos={(id, nombre) => setDescuentoTrabajador({ id, nombre })}
        />
      )}

      {corrigiendo && (
        <CorregirModal
          registro={corrigiendo}
          onClose={() => setCorrigiendoId(null)}
        />
      )}

      {asignando && (
        <AsignarCompensatorioModal
          compensatorio={asignando}
          onClose={() => setAsignando(null)}
        />
      )}

      {reasignando && (
        <ReasignarCompensatorioModal
          compensatorio={reasignando}
          onClose={() => setReasignando(null)}
        />
      )}

      {showCrear && (
        <CrearRegistroModal
          periodoId={periodoId}
          onClose={() => setShowCrear(false)}
        />
      )}

      {descuentoTrabajador && (
        <DescuentoModal
          periodoId={periodoId}
          trabajadorId={descuentoTrabajador.id}
          trabajadorNombre={descuentoTrabajador.nombre}
          descuentos={descuentos.filter(d => d.trabajador_id === descuentoTrabajador.id)}
          onClose={() => setDescuentoTrabajador(null)}
        />
      )}
    </div>
  );
}

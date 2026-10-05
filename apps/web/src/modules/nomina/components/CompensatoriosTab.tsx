import { useState } from 'react';
import { useCompensatorios } from '../hooks/useNomina';
import type { DescansoCompensatorio } from '../types';
import { ErrorState } from '@/shared/components/ErrorState';
import { PendientesCompensatoriosBanner } from './PendientesCompensatoriosBanner';
import { AsignarCompensatorioModal } from './CompensatorioAsignarModals';

export function CompensatoriosTab() {
  const { data, isLoading, isError, error, refetch } = useCompensatorios();
  const [asignando, setAsignando] = useState<DescansoCompensatorio | null>(null);

  if (isLoading) return <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const todos: DescansoCompensatorio[] = data?.data ?? [];
  const pendientes = todos.filter(c => c.estado === 'pendiente');

  return (
    <>
      {pendientes.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">No hay compensatorios pendientes de asignar.</p>
      ) : (
        <PendientesCompensatoriosBanner pendientes={pendientes} onAsignar={setAsignando} />
      )}
      {asignando && (
        <AsignarCompensatorioModal compensatorio={asignando} onClose={() => setAsignando(null)} />
      )}
    </>
  );
}

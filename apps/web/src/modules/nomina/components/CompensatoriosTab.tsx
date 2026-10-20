import { SkeletonList } from '@/shared/components/Skeleton';
import { useState } from 'react';
import { useCompensatorios } from '../hooks/useNomina';
import type { DescansoCompensatorio } from '../types';
import { ErrorState } from '@/shared/components/ErrorState';
import { PendientesCompensatoriosBanner } from './PendientesCompensatoriosBanner';
import { AsignarCompensatorioModal } from './CompensatorioAsignarModals';
import { EmptyState } from '@/shared/components/EmptyState';

export function CompensatoriosTab() {
  const { data, isLoading, isError, error, refetch } = useCompensatorios();
  const [asignando, setAsignando] = useState<DescansoCompensatorio | null>(null);

  if (isLoading) return <SkeletonList count={3} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const todos: DescansoCompensatorio[] = data?.data ?? [];
  const pendientes = todos.filter(c => c.estado === 'pendiente');

  return (
    <>
      {pendientes.length === 0 ? (
        <EmptyState title="No hay compensatorios pendientes de asignar." />
      ) : (
        <PendientesCompensatoriosBanner pendientes={pendientes} onAsignar={setAsignando} />
      )}
      {asignando && (
        <AsignarCompensatorioModal compensatorio={asignando} onClose={() => setAsignando(null)} />
      )}
    </>
  );
}

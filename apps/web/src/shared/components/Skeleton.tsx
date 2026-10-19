/** Bloque gris pulsante que ocupa el lugar de un texto, imagen o avatar mientras cargan los datos. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-border ${className}`} />;
}

/** Tarjeta de lista genérica: avatar + dos líneas + etiqueta. */
export function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <Skeleton className="h-11 w-11 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/5" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

/** Lista de N tarjetas skeleton. Se anuncia como "Cargando" para lectores de pantalla. */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div role="status" aria-label="Cargando" className="space-y-3">
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

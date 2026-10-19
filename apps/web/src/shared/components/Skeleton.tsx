/** Bloque gris pulsante que ocupa el lugar de un texto, imagen o avatar mientras cargan los datos. */
export function Skeleton({ className = '' }: { className?: string }) {
  // `rounded-md` solo si no se pide otro radio (si no, le ganaría a `rounded-full` en el CSS).
  const radio = /\brounded/.test(className) ? '' : 'rounded-md';
  return <div aria-hidden="true" className={`animate-pulse bg-border ${radio} ${className}`} />;
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

/** Tabla: cabecera gris y N filas. La primera columna es más ancha (suele ser el nombre). */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  const celdas = (alto: string) =>
    Array.from({ length: cols }, (_, c) => <Skeleton key={c} className={`${alto} ${c === 0 ? 'flex-[2]' : 'flex-1'}`} />);
  return (
    <div role="status" aria-label="Cargando" className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex gap-6 bg-muted px-4 py-3">{celdas('h-3')}</div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-6 border-t border-border px-4 py-4">{celdas('h-3.5')}</div>
      ))}
    </div>
  );
}

/** Página de detalle: tarjeta de cabecera (avatar + título) y dos tarjetas de datos (etiqueta + valor). */
export function SkeletonDetail() {
  const tarjeta = (filas: number) => (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className={`h-4 ${i % 2 ? 'w-1/2' : 'w-3/4'}`} />
        </div>
      ))}
    </div>
  );
  return (
    <div role="status" aria-label="Cargando" className="space-y-4">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/5" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{tarjeta(4)}{tarjeta(3)}</div>
    </div>
  );
}

/** Panel de métricas: 4 tarjetas con un número grande y una tabla debajo. */
export function SkeletonStats() {
  return (
    <div role="status" aria-label="Cargando" className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-7 w-2/3" />
          </div>
        ))}
      </div>
      <SkeletonTable rows={4} />
    </div>
  );
}

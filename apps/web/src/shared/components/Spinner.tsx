interface SpinnerProps {
  /** Diámetro en px. */
  size?: number;
  className?: string;
}

/**
 * Spinner de marca: anillo tenue + arco que gira. Toma el color del texto (currentColor),
 * así en un botón blanco se ve blanco y en un fondo claro se ve del color que le des con `text-*`.
 */
export function Spinner({ size = 20, className = '' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`inline-block shrink-0 animate-spin rounded-full border-current/25 border-t-current ${className}`}
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 9)) }}
    />
  );
}

/** Carga de página o sección completa: spinner naranja centrado con texto. */
export function PageLoading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
      <Spinner size={32} className="text-primary" />
      <span>{label}</span>
    </div>
  );
}

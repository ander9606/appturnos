/** Un renglón del recibo: etiqueta a la izquierda, monto/valor a la derecha. */
export function Renglon({
  label, valor, fuerte, grande, tono,
}: {
  label: string;
  valor: string;
  fuerte?: boolean;
  grande?: boolean;
  tono?: 'danger' | 'success' | 'warning';
}) {
  const colorValor = tono === 'danger' ? 'text-danger' : tono === 'success' ? 'text-success' : tono === 'warning' ? 'text-warning' : 'text-foreground';
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={fuerte ? 'font-medium text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className={`tabular-nums ${fuerte ? 'font-semibold' : ''} ${grande ? 'text-base' : ''} ${colorValor}`}>{valor}</span>
    </div>
  );
}

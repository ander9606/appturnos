import type { SugerenciaLugar } from '../api/geocodingApi';

interface Props {
  sugerencias: SugerenciaLugar[];
  searched: boolean;
  highlightedIndex: number;
  onHover: (i: number) => void;
  onSelect: (s: SugerenciaLugar) => void;
  className?: string;
}

/** Dropdown de sugerencias de dirección — compartido entre LugarInput y MapaSelector. */
export function SugerenciasDropdown({ sugerencias, searched, highlightedIndex, onHover, onSelect, className }: Props) {
  if (sugerencias.length === 0 && !searched) return null;

  return (
    <div className={className ?? 'absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden'}>
      {sugerencias.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground/60">Sin resultados</p>
      ) : (
        sugerencias.map((s, i) => (
          <button
            type="button"
            key={s.place_id}
            onMouseDown={() => onSelect(s)}
            onMouseEnter={() => onHover(i)}
            className={`w-full text-left px-3 py-2 text-xs border-b border-border last:border-0 ${
              i === highlightedIndex ? 'bg-muted text-foreground' : 'text-foreground hover:bg-muted'
            }`}
          >
            {s.display_name}
          </button>
        ))
      )}
    </div>
  );
}

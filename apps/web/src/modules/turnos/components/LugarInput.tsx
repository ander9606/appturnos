import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Search, X, LocateFixed, CheckCircle2 } from 'lucide-react';

interface Sugerencia {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  value: string;
  latitud: number | null;
  longitud: number | null;
  onChange: (lugar: string, lat: number | null, lng: number | null) => void;
}

/** Búsqueda de dirección con geocoding vía Nominatim (OpenStreetMap) — mismo servicio que usa mobile. */
export function LugarInput({ value, latitud, longitud, onChange }: Props) {
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscar = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setSugerencias([]);
      setOpen(false);
      return;
    }
    setBuscando(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=co`,
        { headers: { 'Accept-Language': 'es' } },
      );
      const data: Sugerencia[] = await res.json();
      setSugerencias(data);
      setOpen(data.length > 0);
    } catch {
      setSugerencias([]);
      setOpen(false);
    } finally {
      setBuscando(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    onChange(text, null, null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(text), 400);
  };

  const handleSelect = (s: Sugerencia) => {
    onChange(s.display_name, parseFloat(s.lat), parseFloat(s.lon));
    setSugerencias([]);
    setOpen(false);
  };

  const usarUbicacion = () => {
    if (!navigator.geolocation) return;
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'es' } },
          );
          const data = await res.json();
          onChange(data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng);
        } catch {
          onChange(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng);
        } finally {
          setLocLoading(false);
        }
      },
      () => {
        setLocLoading(false);
        toast.error('No se pudo obtener tu ubicación. Revisa los permisos del navegador o busca el lugar por texto.');
      },
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary/40">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={value}
            onChange={e => handleChangeText(e.target.value)}
            onFocus={() => sugerencias.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Buscar dirección o lugar…"
            className="flex-1 text-sm focus:outline-none"
          />
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => { onChange('', null, null); setSugerencias([]); setOpen(false); }}
              className="text-muted-foreground/60 hover:text-foreground flex-shrink-0"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {open && sugerencias.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            {sugerencias.map(s => (
              <button
                type="button"
                key={s.place_id}
                onMouseDown={() => handleSelect(s)}
                className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted border-b border-border last:border-0"
              >
                {s.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={usarUbicacion}
          disabled={locLoading}
          className="flex items-center gap-1 text-xs text-info hover:text-primary-600 font-medium disabled:opacity-50"
        >
          <LocateFixed size={13} /> {locLoading ? 'Obteniendo…' : 'Usar mi ubicación'}
        </button>
        {buscando && <span className="text-xs text-muted-foreground">Buscando…</span>}
        {latitud != null && longitud != null && (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle2 size={13} /> {latitud.toFixed(5)}, {longitud.toFixed(5)}
          </span>
        )}
      </div>
    </div>
  );
}

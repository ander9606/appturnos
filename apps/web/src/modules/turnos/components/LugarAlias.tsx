import { useState } from 'react';
import { toast } from 'sonner';
import { BookmarkPlus, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { useCreatePunto, usePuntosParaTurnos } from '@/modules/configuracion/hooks/useConfiguracion';
import { sugerirAlias } from '../lugarAlias';

interface Props {
  /** Dirección que eligió el usuario (la del buscador, el GPS o el mapa). */
  lugar: string;
  latitud: number | null;
  longitud: number | null;
  alias: string;
  onChange: (alias: string) => void;
}

const INPUT_CLS = 'w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

/**
 * "Nombre corto" opcional de un lugar, para las tarjetas y la cuenta de cobro (la dirección completa queda para el
 * mapa y el contrato). Solo aparece cuando hay una dirección que no es de la biblioteca: un lugar de la biblioteca ya
 * tiene nombre corto. Con coordenadas, ofrece guardar el lugar en la biblioteca con ese nombre (opcional: lo decide
 * quien lo crea), para elegirlo ya corto la próxima vez.
 */
export function LugarAlias({ lugar, latitud, longitud, alias, onChange }: Props) {
  const { data } = usePuntosParaTurnos();
  const crearPunto = useCreatePunto();
  const [guardando, setGuardando] = useState(false);
  const puntos = data?.data ?? [];
  const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

  if (!lugar.trim() || puntos.some(p => igual(p.nombre, lugar))) return null;

  const nombre = alias.trim();
  const enBiblioteca = nombre !== '' && puntos.some(p => igual(p.nombre, nombre));
  const sugerencia = nombre === '' ? sugerirAlias(lugar) : null;
  const puedeGuardar = nombre !== '' && !enBiblioteca && latitud != null && longitud != null;

  const guardarEnBiblioteca = async () => {
    setGuardando(true);
    try {
      await crearPunto.mutateAsync({ nombre, latitud: latitud!, longitud: longitud!, radio_metros: 100, alcance: 'todos', tipo: 'fijo' });
    } catch (err) {
      // useCreatePunto ya avisa con un toast; aquí solo se evita dejar el botón colgado.
      if (!axios.isAxiosError(err)) toast.error('No se pudo guardar en la biblioteca.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mt-2">
      <label htmlFor="lugar-alias" className="block text-sm font-medium text-foreground mb-1">Nombre corto (opcional)</label>
      <input
        id="lugar-alias"
        type="text"
        maxLength={80}
        placeholder="Ej.: Corferias"
        value={alias}
        onChange={e => onChange(e.target.value)}
        className={INPUT_CLS}
      />
      <p className="text-xs text-muted-foreground mt-1">
        Se usa en las tarjetas y en la cuenta de cobro. La dirección completa queda para el mapa y el contrato.
      </p>
      <div className="flex flex-wrap items-center gap-2 mt-1.5">
        {sugerencia && (
          <button type="button" onClick={() => onChange(sugerencia)} className="text-xs font-medium text-primary-600 border border-primary/30 bg-primary-50 hover:bg-primary-100 rounded-lg px-2.5 py-1 transition-colors">
            {`Usar «${sugerencia}»`}
          </button>
        )}
        {puedeGuardar && (
          <button type="button" onClick={guardarEnBiblioteca} disabled={guardando} className="flex items-center gap-1 text-xs font-medium text-foreground border border-border hover:bg-muted disabled:opacity-50 rounded-lg px-2.5 py-1 transition-colors">
            <BookmarkPlus size={13} aria-hidden="true" /> {guardando ? 'Guardando…' : 'Guardar en mi biblioteca'}
          </button>
        )}
        {enBiblioteca && (
          <span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 size={13} aria-hidden="true" /> En tu biblioteca</span>
        )}
      </div>
    </div>
  );
}

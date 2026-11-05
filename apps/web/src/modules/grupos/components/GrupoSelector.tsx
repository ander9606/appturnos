import { useState } from 'react';
import { ChevronDown, Layers, X } from 'lucide-react';
import { useOpcionesGrupos } from '@/modules/configuracion/hooks/useConfiguracion';
import { ElegirGrupoModal } from './ElegirGrupoModal';
import { CrearGrupoModal } from './CrearGrupoModal';
import { aElegido } from '../grupoUtils';
import type { GrupoElegido } from '../types';

interface Props {
  grupo: GrupoElegido | null;
  onChange: (g: GrupoElegido | null) => void;
}

/**
 * Campo opcional "a qué grupo pertenece este turno". Solo aparece si la empresa usa grupos. Usa la etiqueta
 * de la empresa como título del campo ("Evento", "Obra"…) y textos sin artículo, para que funcione igual con
 * cualquier nombre (en español "un evento" pero "una obra").
 */
export function GrupoSelector({ grupo, onChange }: Props) {
  const { usa, etiqueta } = useOpcionesGrupos();
  const [lista, setLista] = useState(false);
  const [crear, setCrear] = useState(false);
  if (!usa) return null;

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">{etiqueta}</label>

      {grupo ? (
        <div className="flex items-center gap-2 border border-primary bg-primary-50 rounded-lg pl-3 pr-1.5 py-1.5">
          <Layers size={15} className="text-primary flex-shrink-0" />
          <span className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{grupo.nombre}</span>
          <button type="button" onClick={() => setLista(true)} aria-label={`Cambiar ${etiqueta}`} className="text-xs font-semibold text-primary-600 hover:underline px-1.5 py-1">
            Cambiar
          </button>
          <button type="button" onClick={() => onChange(null)} aria-label={`Quitar ${etiqueta}`} className="text-muted-foreground hover:text-foreground p-1">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLista(true)}
            aria-label={`Elegir ${etiqueta}`}
            className="flex-1 flex items-center justify-between border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Elegir… <ChevronDown size={15} />
          </button>
          <button
            type="button"
            onClick={() => setCrear(true)}
            className="border border-primary/30 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap"
          >
            + Crear
          </button>
        </div>
      )}

      {lista && (
        <ElegirGrupoModal
          etiqueta={etiqueta}
          seleccionadoId={grupo?.id}
          onSelect={g => { onChange(aElegido(g)); setLista(false); }}
          onCrear={() => { setLista(false); setCrear(true); }}
          onClose={() => setLista(false)}
        />
      )}
      {crear && (
        <CrearGrupoModal
          etiqueta={etiqueta}
          onCreado={g => { onChange(aElegido(g)); setCrear(false); }}
          onClose={() => setCrear(false)}
        />
      )}
    </div>
  );
}

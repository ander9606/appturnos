import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/Modal';
import { LugarInput } from '@/modules/turnos/components/LugarInput';
import { LugarAlias } from '@/modules/turnos/components/LugarAlias';
import { useActualizarGrupo } from '../hooks/useGrupos';
import { cambiosDeGrupo, formularioDeGrupo } from '../grupoUtils';
import type { GrupoTurno } from '../types';

interface Props {
  grupo: GrupoTurno;
  /** Cómo llama la empresa a un grupo ("Evento", "Obra"…): va de título, sin artículo. */
  etiqueta: string;
  onClose: () => void;
}

const INPUT_CLS = 'w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

/**
 * Editar un grupo: nombre, descripción y el lugar por defecto de sus turnos nuevos (con su nombre corto). Se monta al
 * abrirlo, así que siempre parte de lo guardado. Cambiar el lugar no mueve los turnos que ya lo copiaron.
 */
export function EditarGrupoModal({ grupo, etiqueta, onClose }: Props) {
  const actualizar = useActualizarGrupo();
  const [f, setF] = useState(() => formularioDeGrupo(grupo));
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [errorLugar, setErrorLugar] = useState<string | null>(null);

  const guardar = async () => {
    setErrorNombre(null); setErrorLugar(null);
    const r = cambiosDeGrupo(f);
    if (!r.ok) {
      if (r.campo === 'nombre') setErrorNombre(r.mensaje); else setErrorLugar(r.mensaje);
      return;
    }
    try {
      await actualizar.mutateAsync({ id: grupo.id, data: r.data });
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        // El mensaje del servidor dice "grupo": aquí se arma con el nombre, para que sirva con la etiqueta de la empresa.
        setErrorNombre(`Ya existe «${f.nombre.trim()}».`);
      } else {
        toast.error(axios.isAxiosError(err) ? (err.response?.data?.message as string | undefined) ?? 'No se pudo guardar.' : 'No se pudo guardar.');
      }
    }
  };

  // Enter en el nombre guarda (no hay <form>: el buscador de direcciones también usa Enter para elegir una opción).
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).id === 'grupo-editar-nombre') { e.preventDefault(); void guardar(); }
  };

  return (
    <Modal onClose={onClose} size="md" scrollable>
      <h3 className="text-base font-semibold text-foreground mb-4">{`Editar ${etiqueta}`}</h3>
      <div onKeyDown={onEnter} className="flex flex-col gap-4">
        <div>
          <label htmlFor="grupo-editar-nombre" className="block text-sm font-medium text-foreground mb-1">Nombre *</label>
          <input
            id="grupo-editar-nombre"
            type="text"
            autoFocus
            maxLength={150}
            value={f.nombre}
            onChange={e => { setF(x => ({ ...x, nombre: e.target.value })); setErrorNombre(null); }}
            className={INPUT_CLS}
          />
          {errorNombre && <p role="alert" className="text-xs text-danger mt-1">{errorNombre}</p>}
        </div>

        <div>
          <label htmlFor="grupo-editar-descripcion" className="block text-sm font-medium text-foreground mb-1">Descripción (opcional)</label>
          <textarea
            id="grupo-editar-descripcion"
            rows={3}
            maxLength={5000}
            placeholder="Para qué es, quién lo pidió…"
            value={f.descripcion}
            onChange={e => setF(x => ({ ...x, descripcion: e.target.value }))}
            className={INPUT_CLS}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Lugar (opcional)</label>
          <LugarInput
            value={f.lugar}
            latitud={f.latitud}
            longitud={f.longitud}
            // Elegir otro lugar (con coordenadas) deja sin efecto el nombre corto del anterior.
            onChange={(l, lat, lng) => {
              setF(x => ({ ...x, lugar: l, latitud: lat, longitud: lng, ...(lat != null && l !== x.lugar ? { lugarAlias: '' } : {}) }));
              setErrorLugar(null);
            }}
          />
          <LugarAlias lugar={f.lugar} latitud={f.latitud} longitud={f.longitud} alias={f.lugarAlias} onChange={a => setF(x => ({ ...x, lugarAlias: a }))} />
          {errorLugar
            ? <p role="alert" className="text-xs text-danger mt-1">{errorLugar}</p>
            : <p className="text-xs text-muted-foreground mt-1">Es el lugar por defecto de los turnos nuevos. Los turnos que ya tiene no cambian.</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
          <button type="button" onClick={guardar} disabled={actualizar.isPending} className="flex-1 bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            {actualizar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

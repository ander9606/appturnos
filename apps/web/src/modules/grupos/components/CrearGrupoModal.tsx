import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/Modal';
import { LugarInput } from '@/modules/turnos/components/LugarInput';
import { gruposApi } from '../api/gruposApi';
import { useCrearGrupo } from '../hooks/useGrupos';
import type { GrupoTurno } from '../types';

interface Props {
  /** Cómo llama la empresa a un grupo ("Evento", "Obra"…): va de título, sin artículo, para que sirva con cualquier nombre. */
  etiqueta: string;
  /** Se llama con el grupo recién creado, o con el que ya existía si el usuario elige "Usar ese". */
  onCreado: (g: GrupoTurno) => void;
  onClose: () => void;
}

const INPUT_CLS = 'w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

/** Crear un grupo desde el formulario del turno: solo el nombre es obligatorio. */
export function CrearGrupoModal({ etiqueta, onCreado, onClose }: Props) {
  const crear = useCrearGrupo();
  const [nombre, setNombre] = useState('');
  const [lugar, setLugar] = useState('');
  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [errorLugar, setErrorLugar] = useState<string | null>(null);
  // Nombre repetido: el servidor trae el id del que ya lo usa, para ofrecer "Usar ese".
  const [repetido, setRepetido] = useState<{ id: number | null; mensaje: string } | null>(null);

  const guardar = async () => {
    const limpio = nombre.trim();
    setErrorNombre(null); setErrorLugar(null); setRepetido(null);
    if (!limpio) { setErrorNombre('Escribe un nombre.'); return; }
    // El servidor pide dirección y coordenadas juntas; escribir a mano borra las coordenadas.
    const conLugar = lugar.trim() !== '';
    if (conLugar && (latitud == null || longitud == null)) {
      setErrorLugar('Elige una dirección de la lista, o deja el lugar vacío.');
      return;
    }
    try {
      const res = await crear.mutateAsync({
        nombre: limpio,
        ...(conLugar ? { lugar: lugar.trim(), latitud: latitud!, longitud: longitud! } : {}),
      });
      onCreado(res.data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const data = err.response.data as { detalles?: { grupo_id?: number | null }[] };
        // El mensaje del servidor dice "grupo": aquí se arma con el nombre, para que sirva con la etiqueta de la empresa.
        setRepetido({ id: data.detalles?.[0]?.grupo_id ?? null, mensaje: `Ya existe «${limpio}».` });
      } else {
        toast.error(axios.isAxiosError(err) ? (err.response?.data?.message as string | undefined) ?? 'No se pudo crear.' : 'No se pudo crear.');
      }
    }
  };

  // Enter en un campo enviaría el formulario de la oferta (el modal está dentro de él): aquí crea el grupo.
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || (e.target as HTMLElement).tagName !== 'INPUT') return;
    e.preventDefault();
    if ((e.target as HTMLElement).id === 'grupo-nombre') void guardar();
  };

  const usarExistente = async () => {
    if (!repetido?.id) return;
    try {
      const res = await gruposApi.obtener(repetido.id);
      onCreado(res.data);
    } catch {
      toast.error('No se pudo cargar. Intenta de nuevo.');
    }
  };

  return (
    <Modal onClose={onClose} size="md" scrollable>
      <h3 className="text-base font-semibold text-foreground mb-4">{`Crear ${etiqueta}`}</h3>
      {/* Sin <form>: este modal vive dentro del formulario de la oferta y un formulario anidado enviaría también ese. */}
      <div onKeyDown={onEnter} className="flex flex-col gap-4">
        <div>
          <label htmlFor="grupo-nombre" className="block text-sm font-medium text-foreground mb-1">Nombre *</label>
          <input
            id="grupo-nombre"
            type="text"
            autoFocus
            maxLength={150}
            placeholder="Ej.: Feria del Libro 2026"
            value={nombre}
            onChange={e => { setNombre(e.target.value); setErrorNombre(null); setRepetido(null); }}
            className={INPUT_CLS}
          />
          {errorNombre && <p role="alert" className="text-xs text-danger mt-1">{errorNombre}</p>}
        </div>

        {repetido && (
          <div role="alert" className="border border-warning bg-warning-light rounded-lg px-3 py-2 flex flex-col gap-2">
            <p className="text-sm text-foreground">{repetido.mensaje}</p>
            {repetido.id != null && (
              <button type="button" onClick={usarExistente} className="self-start text-sm font-medium text-primary-600 border border-primary/30 bg-primary-50 hover:bg-primary-100 rounded-lg px-3 py-1 transition-colors">
                Usar ese
              </button>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Lugar (opcional)</label>
          <LugarInput
            value={lugar}
            latitud={latitud}
            longitud={longitud}
            onChange={(l, lat, lng) => { setLugar(l); setLatitud(lat); setLongitud(lng); setErrorLugar(null); }}
          />
          {errorLugar
            ? <p role="alert" className="text-xs text-danger mt-1">{errorLugar}</p>
            : <p className="text-xs text-muted-foreground mt-1">Los turnos nuevos usarán este lugar por defecto; podrás cambiarlo en cada turno.</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
          <button type="button" onClick={guardar} disabled={crear.isPending} className="flex-1 bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            {crear.isPending ? 'Creando...' : 'Crear y usar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

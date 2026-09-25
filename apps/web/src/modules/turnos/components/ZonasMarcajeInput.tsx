import { useState } from 'react';
import { MapPin, X, Plus, Library } from 'lucide-react';
import { usePuntosParaTurnos, useCreatePunto } from '@/modules/configuracion/hooks/useConfiguracion';
import type { PuntoParaTurno } from '@/modules/configuracion/types';
import { LugarInput } from './LugarInput';

export interface ZonaMarcaje {
  id: number;
  nombre: string;
  latitud: number;
  longitud: number;
  radio_metros: number;
}

interface Props {
  zonas: ZonaMarcaje[];
  onChange: (zonas: ZonaMarcaje[]) => void;
}

/**
 * Zonas de marcaje válidas para un turno con geofence 'zonal' (migración 099).
 * Vacío = sin acotar, cae al comportamiento de siempre (cualquier punto zonal
 * de la empresa). Dos formas de agregar una zona: elegir una ya guardada, o
 * capturar una nueva con el mismo mecanismo de LugarInput (búsqueda / GPS /
 * mapa) — al confirmar, se crea como punto tipo='zonal' reutilizable.
 */
export function ZonasMarcajeInput({ zonas, onChange }: Props) {
  const [bibliotecaAbierta, setBibliotecaAbierta] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [nuevoLugar, setNuevoLugar] = useState('');
  const [nuevoLat, setNuevoLat] = useState<number | null>(null);
  const [nuevoLng, setNuevoLng] = useState<number | null>(null);

  const { data: puntosData } = usePuntosParaTurnos();
  const puntos = puntosData?.data ?? [];
  const crearPunto = useCreatePunto();

  const idsElegidos = new Set(zonas.map(z => z.id));
  const disponiblesBiblioteca = puntos.filter(p => !idsElegidos.has(p.id));

  function agregarExistente(p: PuntoParaTurno) {
    onChange([...zonas, { id: p.id, nombre: p.nombre, latitud: p.latitud, longitud: p.longitud, radio_metros: p.radio_metros }]);
    setBibliotecaAbierta(false);
  }

  function quitar(id: number) {
    onChange(zonas.filter(z => z.id !== id));
  }

  async function confirmarNueva() {
    if (!nuevoLugar || nuevoLat == null || nuevoLng == null) return;
    const creado = await crearPunto.mutateAsync({
      nombre: nuevoLugar, latitud: nuevoLat, longitud: nuevoLng, radio_metros: 100, alcance: 'todos', tipo: 'zonal',
    });
    onChange([...zonas, {
      id: creado.data.id, nombre: creado.data.nombre,
      latitud: creado.data.latitud, longitud: creado.data.longitud, radio_metros: creado.data.radio_metros,
    }]);
    setNuevoLugar(''); setNuevoLat(null); setNuevoLng(null);
    setAgregando(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {zonas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {zonas.map(z => (
            <span key={z.id} className="flex items-center gap-1 bg-primary-50 text-primary-600 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full">
              <MapPin size={11} /> {z.nombre}
              <button type="button" onClick={() => quitar(z.id)} className="hover:text-primary-900">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {disponiblesBiblioteca.length > 0 && (
          <button
            type="button"
            onClick={() => setBibliotecaAbierta(v => !v)}
            className="flex items-center gap-1 text-xs text-info hover:text-primary-600 font-medium"
          >
            <Library size={13} /> De la biblioteca de ubicaciones
          </button>
        )}
        <button
          type="button"
          onClick={() => setAgregando(v => !v)}
          className="flex items-center gap-1 text-xs text-info hover:text-primary-600 font-medium"
        >
          <Plus size={13} /> Agregar nueva ubicación
        </button>
      </div>

      {bibliotecaAbierta && (
        <div className="border border-border rounded-lg overflow-hidden">
          {disponiblesBiblioteca.map(p => (
            <button
              type="button"
              key={p.id}
              onClick={() => agregarExistente(p)}
              className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted border-b border-border last:border-0"
            >
              {p.nombre} <span className="text-muted-foreground">· radio {p.radio_metros} m</span>
            </button>
          ))}
        </div>
      )}

      {agregando && (
        <div className="border border-border rounded-lg p-3 flex flex-col gap-2">
          <LugarInput
            value={nuevoLugar}
            latitud={nuevoLat}
            longitud={nuevoLng}
            onChange={(lugar, lat, lng) => { setNuevoLugar(lugar); setNuevoLat(lat); setNuevoLng(lng); }}
          />
          <button
            type="button"
            onClick={confirmarNueva}
            disabled={!nuevoLugar || nuevoLat == null || crearPunto.isPending}
            className="self-start text-xs font-semibold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            {crearPunto.isPending ? 'Agregando…' : 'Agregar esta zona'}
          </button>
        </div>
      )}
    </div>
  );
}

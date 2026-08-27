import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Check, X } from 'lucide-react';
import { equipoApi } from '@/modules/equipo/api/equipoApi';
import { Modal } from '@/shared/components/Modal';
import type { Trabajador } from '@/modules/equipo/types';

export interface DestinatarioSeleccionado {
  id: number;
  nombre: string;
  apellido: string;
}

interface Props {
  seleccionados: DestinatarioSeleccionado[];
  onConfirm: (destinatarios: DestinatarioSeleccionado[]) => void;
  onClose: () => void;
}

/** Selector de personas para un turno dirigido — reutiliza el mismo filtro
 *  client-side que EquipoPage.tsx (el backend no expone búsqueda por texto todavía). */
export function TrabajadorPickerModal({ seleccionados, onConfirm, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [elegidos, setElegidos] = useState<DestinatarioSeleccionado[]>(seleccionados);

  const { data, isLoading } = useQuery({
    queryKey: ['equipo', 'trabajadores', 'picker'],
    queryFn: () => equipoApi.listar({ activo: true, limit: 200 }),
  });
  const trabajadores: Trabajador[] = (data as { data?: { data?: Trabajador[] } } | undefined)?.data?.data ?? [];

  const elegidoIds = useMemo(() => new Set(elegidos.map(d => d.id)), [elegidos]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trabajadores;
    return trabajadores.filter(
      t => `${t.nombre} ${t.apellido}`.toLowerCase().includes(q) || (t.cedula ?? '').includes(q),
    );
  }, [trabajadores, search]);

  function toggle(t: Trabajador) {
    setElegidos(prev =>
      prev.some(d => d.id === t.id)
        ? prev.filter(d => d.id !== t.id)
        : [...prev, { id: t.id, nombre: t.nombre, apellido: t.apellido }],
    );
  }

  return (
    <Modal onClose={onClose} padded={false} className="flex flex-col max-h-[80vh]">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-base font-semibold text-foreground">Elegir personas</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="mx-5 mb-3 flex items-center gap-2 border border-border rounded-lg px-3 py-2">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o cédula…"
            className="flex-1 text-sm focus:outline-none"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Cargando…</p>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin resultados</p>
          ) : (
            filtrados.map(t => {
              const elegido = elegidoIds.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t)}
                  className="w-full flex items-center gap-3 py-2.5 border-b border-border last:border-0 text-left"
                >
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      elegido ? 'bg-primary border-primary text-white' : 'border-border'
                    }`}
                  >
                    {elegido && <Check size={13} />}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-foreground">{t.nombre} {t.apellido}</span>
                    {t.cedula && <span className="block text-xs text-muted-foreground">{t.cedula}</span>}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="px-5 py-4">
          <button
            type="button"
            onClick={() => { onConfirm(elegidos); onClose(); }}
            className="w-full bg-primary hover:bg-primary-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Listo{elegidos.length > 0 ? ` (${elegidos.length})` : ''}
          </button>
        </div>
    </Modal>
  );
}

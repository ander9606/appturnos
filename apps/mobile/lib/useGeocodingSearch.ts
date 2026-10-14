import { useCallback, useEffect, useRef, useState } from 'react';
import { geocodingApi, type SugerenciaLugar } from '@api-client';
import { createStaleGuard } from './staleGuard';

/**
 * Búsqueda de direcciones con debounce y cancelación de respuestas viejas
 * (red lenta + tipeo rápido) — compartida entre LugarInput y MapaSelector
 * para no reimplementar el mismo debounce/guard de secuencia en cada uno.
 */
export function useGeocodingSearch() {
  const [sugerencias, setSugerencias] = useState<SugerenciaLugar[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardRef = useRef(createStaleGuard());

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const buscar = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      guardRef.current.invalidate();
      setSugerencias([]);
      setSearched(false);
      setBuscando(false);
      return;
    }
    const token = guardRef.current.start();
    setBuscando(true);
    try {
      const data = await geocodingApi.buscar(q);
      if (guardRef.current.isCurrent(token)) {
        setSugerencias(data);
        setSearched(true);
      }
    } catch {
      if (guardRef.current.isCurrent(token)) {
        setSugerencias([]);
        setSearched(true);
      }
    } finally {
      if (guardRef.current.isCurrent(token)) setBuscando(false);
    }
  }, []);

  const buscarDebounced = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(q), 400);
  }, [buscar]);

  const limpiar = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    guardRef.current.invalidate();
    setSugerencias([]);
    setSearched(false);
    setBuscando(false);
  }, []);

  return { sugerencias, buscando, searched, buscarDebounced, limpiar };
}

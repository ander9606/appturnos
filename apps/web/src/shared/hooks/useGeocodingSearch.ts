import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { geocodingApi, type SugerenciaLugar } from '../api/geocodingApi';
import { createStaleGuard } from './staleGuard';

/**
 * Búsqueda de direcciones con debounce, cancelación de respuestas viejas
 * (red lenta + tipeo rápido) y navegación por teclado — compartida entre
 * LugarInput y MapaSelector para no reimplementar el mismo debounce/guard
 * de secuencia en cada uno.
 */
export function useGeocodingSearch() {
  const [sugerencias, setSugerencias] = useState<SugerenciaLugar[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [searched, setSearched] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
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
        setHighlightedIndex(-1);
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
    setHighlightedIndex(-1);
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent, onSelect: (s: SugerenciaLugar) => void) => {
      if (sugerencias.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(i => (i + 1) % sugerencias.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(i => (i <= 0 ? sugerencias.length - 1 : i - 1));
      } else if (e.key === 'Enter') {
        // Siempre prevenir el submit del form mientras hay sugerencias abiertas —
        // sin highlight (no se usó las flechas), Enter elige la primera.
        e.preventDefault();
        onSelect(sugerencias[highlightedIndex >= 0 ? highlightedIndex : 0]);
      } else if (e.key === 'Escape') {
        limpiar();
      }
    },
    [sugerencias, highlightedIndex, limpiar],
  );

  return { sugerencias, buscando, searched, highlightedIndex, setHighlightedIndex, buscarDebounced, limpiar, onKeyDown };
}

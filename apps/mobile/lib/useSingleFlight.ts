import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Núcleo puro: ejecuta `fn`; si devuelve una promesa, ignora llamadas nuevas hasta que termine
 * —bien o mal— y avisa con `onBusy`. Al fallar queda libre otra vez. El flag es una variable, no
 * estado de React, así que frena también dos toques en el mismo frame.
 */
export function crearUnVuelo(onBusy: (busy: boolean) => void) {
  let flying = false;
  return (fn: (() => unknown) | undefined) => {
    if (flying || !fn) return;
    const result = fn();
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      flying = true;
      onBusy(true);
      const done = () => { flying = false; onBusy(false); };
      (result as PromiseLike<unknown>).then(done, done);
    }
  };
}

/** Evita el doble toque mientras una acción async sigue en curso (red lenta, GPS, diálogos). */
export function useSingleFlight<A extends unknown[]>(fn: ((...args: A) => unknown) | undefined) {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const guard = useRef(crearUnVuelo((b) => { if (mounted.current) setBusy(b); })).current;
  const run = useCallback((...args: A) => guard(fn ? () => fn(...args) : undefined), [guard, fn]);
  return { run, busy };
}
